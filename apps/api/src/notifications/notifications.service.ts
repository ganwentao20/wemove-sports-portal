import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { isEmail } from 'class-validator';
import nodemailer from 'nodemailer';
import type { Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  mergedTemplates,
  NotificationTemplateError,
  renderTemplate,
  templateVariables,
  type NotificationTemplate,
  type TemplateVariables,
  type TemplateBody,
} from './notification-templates.js';

export type InternalRecipientGroup = 'dealer' | 'support' | 'orders';
export type NotificationInput = {
  kind: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  dedupeKey: string;
  availableAt?: Date;
  locale?: string;
  variables?: TemplateVariables;
  internalGroup?: InternalRecipientGroup | false;
};
export type InternalNotificationInput = Omit<
  NotificationInput,
  'to' | 'internalGroup'
> & { group?: InternalRecipientGroup };
type GroupConfig = Record<InternalRecipientGroup, string[]>;
const groups: InternalRecipientGroup[] = ['dealer', 'support', 'orders'];
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Durable outbox: encrypted source payloads, localized templates, database leases and retries. */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly prisma: PrismaService) {}
  private key() {
    return createHash('sha256')
      .update(
        process.env.NOTIFICATION_ENCRYPTION_KEY ??
          process.env.JWT_ACCESS_SECRET ??
          'local-notification-key',
      )
      .digest();
  }
  private seal(input: NotificationInput) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(input), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      'base64',
    );
  }
  private open(value: string): NotificationInput {
    const raw = Buffer.from(value, 'base64'),
      cipher = createDecipheriv('aes-256-gcm', this.key(), raw.subarray(0, 12));
    cipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString(
        'utf8',
      ),
    );
  }
  private async config(tx?: Prisma.TransactionClient) {
    const rows = await (tx ?? this.prisma).siteSetting.findMany({
      where: {
        key: { in: ['notificationTemplates', 'locale', 'notifications'] },
      },
    });
    const settings = Object.fromEntries(
      rows.map((row) => [row.key, row.value]),
    ) as Record<string, any>;
    return {
      templates: mergedTemplates(
        Array.isArray(settings.notificationTemplates?.templates)
          ? settings.notificationTemplates.templates
          : [],
      ),
      defaultLocale: String(
        settings.locale?.defaultLanguage ?? 'en',
      ).toLowerCase(),
      groups: settings.notifications ?? {},
    };
  }
  private normalizedLocale(value: string) {
    return value.toLowerCase().replace('_', '-');
  }
  private fallbackLink(kind: string) {
    const base = (
      process.env.APP_BASE_URL ??
      process.env.WEB_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    return (
      base +
      (kind.startsWith('dealer.')
        ? '/dealer/dashboard'
        : kind.startsWith('order.')
          ? '/orders'
          : '/customer/dashboard')
    );
  }
  async preview(
    input: NotificationInput,
    override?: TemplateBody,
    tx?: Prisma.TransactionClient,
  ) {
    if (!isEmail(input.to))
      throw new NotificationTemplateError('INVALID_RECIPIENT');
    const config = await this.config(tx);
    const [user, subscription] = await Promise.all([
      (tx ?? this.prisma).user.findUnique({
        where: { email: input.to.trim().toLowerCase() },
        select: { name: true, locale: true },
      }),
      (tx ?? this.prisma).newsletterSubscription.findUnique({
        where: { email: input.to.trim().toLowerCase() },
        select: { locale: true },
      }),
    ]);
    const requestedLocale = this.normalizedLocale(
      input.locale ??
        (input.kind.startsWith('newsletter.')
          ? subscription?.locale
          : user?.locale) ??
        user?.locale ??
        subscription?.locale ??
        config.defaultLocale,
    );
    const template =
      config.templates.find((item) => item.kind === input.kind) ??
      config.templates.find((item) => item.kind === 'notification.default');
    const candidates = [
      ...new Set([
        requestedLocale,
        requestedLocale.split('-')[0],
        config.defaultLocale,
        config.defaultLocale.split('-')[0],
        'en',
      ]),
    ];
    const locale =
      candidates.find((candidate) => template?.locales[candidate]) ??
      requestedLocale;
    const body = override ??
      template?.locales[locale] ?? {
        subject: '{{subject}}',
        text: '{{text}}',
        ...(input.html ? { html: input.html } : {}),
      };
    const variables: TemplateVariables = {
      subject: input.subject,
      text: input.text,
      kind: input.kind,
      name: user?.name || input.to,
      email: input.to,
      link:
        input.text.match(/https?:\/\/[^\s<>"']+/)?.[0] ??
        this.fallbackLink(input.kind),
      ...input.variables,
    };
    return {
      ...renderTemplate(body, variables),
      to: input.to,
      locale,
      requestedLocale,
      fallback: locale !== requestedLocale,
    };
  }
  async enqueue(input: NotificationInput, tx?: Prisma.TransactionClient) {
    let failure: string | null = null;
    try {
      await this.preview(input, undefined, tx);
    } catch (error) {
      if (!(error instanceof NotificationTemplateError)) throw error;
      failure = error.code;
    }
    const db = tx ?? this.prisma;
    // Native ON CONFLICT avoids Prisma's empty-update upsert racing on concurrent events.
    await db.notificationOutbox.createMany({
      skipDuplicates: true,
      data: {
        kind: input.kind,
        dedupeKey: input.dedupeKey,
        payload: this.seal(input),
        availableAt: input.availableAt,
        ...(failure ? { status: 'DEAD', lastError: failure } : {}),
      },
    });
    const row = await db.notificationOutbox.findUniqueOrThrow({
      where: { dedupeKey: input.dedupeKey },
    });
    // Account, claim and invitation tokens are never copied to an internal group.
    const group =
      input.internalGroup === false
        ? null
        : (input.internalGroup ?? this.groupFor(input.kind));
    if (group)
      await this.enqueueInternal(
        {
          kind: 'internal.' + group,
          group,
          subject: 'WEMOVE ' + input.kind,
          text: 'Business event: ' + input.kind,
          dedupeKey: input.dedupeKey + ':internal',
          variables: {
            eventKind: input.kind,
            reference: row.id,
            link:
              (
                process.env.APP_BASE_URL ??
                process.env.WEB_URL ??
                'http://localhost:3000'
              ).replace(/\/$/, '') +
              (group === 'dealer'
                ? input.kind.startsWith('dealer.rfq')
                  ? '/admin/b2b'
                  : '/admin/dealers'
                : group === 'support'
                  ? '/admin/contacts'
                  : '/admin/orders'),
          },
        },
        tx,
      );
    return { id: row.id, status: row.status };
  }
  private groupFor(kind: string): InternalRecipientGroup | null {
    if (
      [
        'dealer.application.confirmation',
        'dealer.application.resubmit',
        'dealer.application.review',
        'dealer.rfq.submitted',
        'dealer.rfq.accepted',
        'dealer.rfq.rejected',
      ].includes(kind)
    )
      return 'dealer';
    if (kind === 'contact.received') return 'support';
    if (kind.startsWith('order.') || kind.startsWith('dealer.order.'))
      return 'orders';
    return null;
  }
  async enqueueInternal(
    input: InternalNotificationInput,
    tx?: Prisma.TransactionClient,
  ) {
    const group = input.group ?? this.groupFor(input.kind) ?? 'orders';
    const recipients = (await this.recipientGroups(tx))[group];
    const ids: string[] = [];
    for (const to of recipients) {
      const result = await this.enqueue(
        {
          ...input,
          to,
          internalGroup: false,
          dedupeKey:
            input.dedupeKey +
            ':' +
            group +
            ':' +
            createHash('sha256').update(to).digest('hex'),
        },
        tx,
      );
      ids.push(result.id);
    }
    return { ids, configured: recipients.length > 0 };
  }
  onModuleInit() {
    if (process.env.NOTIFICATION_WORKER === 'false') return;
    this.timer = setInterval(() => {
      void this.drain().catch(() =>
        this.logger.warn(
          'Notification worker unavailable; pending messages retained',
        ),
      );
    }, 15_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async drain() {
    if (this.running || !process.env.SMTP_HOST) return;
    this.running = true;
    try {
      const rows = await this.prisma.notificationOutbox.findMany({
        where: {
          OR: [
            { status: 'PENDING', availableAt: { lte: new Date() } },
            { status: 'SENDING', lockedUntil: { lt: new Date() } },
          ],
        },
        take: 25,
        orderBy: { availableAt: 'asc' },
      });
      for (const row of rows) await this.deliver(row.id);
    } finally {
      this.running = false;
    }
  }
  async deliver(id: string) {
    if (!process.env.SMTP_HOST) return;
    const now = new Date();
    const claimed = await this.prisma.notificationOutbox.updateMany({
      where: {
        id,
        OR: [
          { status: 'PENDING', availableAt: { lte: now } },
          { status: 'SENDING', lockedUntil: { lt: now } },
        ],
      },
      data: {
        status: 'SENDING',
        lockedUntil: new Date(Date.now() + 120_000),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) return;
    const row = await this.prisma.notificationOutbox.findUniqueOrThrow({
      where: { id },
    });
    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      const payload = await this.preview(this.open(row.payload));
      transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: process.env.SMTP_SECURE === 'true',
        connectionTimeout: 10_000,
        socketTimeout: 30_000,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transport.sendMail({
        from:
          process.env.EMAIL_FROM ?? 'WEMOVE <no-reply@wemovetoy.com>',
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        messageId: '<' + row.id + '@wemovetoy.com>',
      });
      await this.prisma.notificationOutbox.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          lockedUntil: null,
          lastError: null,
          payload: '',
        },
      });
    } catch (error) {
      const templateError =
        error instanceof NotificationTemplateError ? error.code : null;
      await this.prisma.notificationOutbox.update({
        where: { id },
        data: {
          status: templateError || row.attempts >= 6 ? 'DEAD' : 'PENDING',
          lockedUntil: null,
          availableAt: new Date(
            Date.now() + Math.min(3_600_000, 30_000 * 2 ** row.attempts),
          ),
          lastError: templateError ?? 'DELIVERY_FAILED',
        },
      });
    } finally {
      transport?.close();
    }
  }
  list() {
    return this.prisma.notificationOutbox.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        sentAt: true,
        availableAt: true,
      },
    });
  }
  async retry(id: string) {
    const row = await this.prisma.notificationOutbox.findFirst({
      where: { id, status: 'DEAD' },
    });
    if (!row?.payload) return { count: 0 };
    try {
      await this.preview(this.open(row.payload));
    } catch (error) {
      await this.prisma.notificationOutbox.update({
        where: { id },
        data: {
          lastError:
            error instanceof NotificationTemplateError
              ? error.code
              : 'PAYLOAD_UNREADABLE',
        },
      });
      return { count: 0 };
    }
    return this.prisma.notificationOutbox.updateMany({
      where: { id, status: 'DEAD' },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        lockedUntil: null,
        availableAt: new Date(),
      },
    });
  }
  async templates() {
    const config = await this.config();
    return {
      templates: config.templates.map((item) => ({
        ...item,
        variables: Object.fromEntries(
          Object.entries(item.locales).map(([locale, body]) => [
            locale,
            templateVariables(body),
          ]),
        ),
      })),
      defaultLocale: config.defaultLocale,
      sender: {
        configured: Boolean(process.env.SMTP_HOST),
        from:
          process.env.EMAIL_FROM ?? 'WEMOVE <no-reply@wemovetoy.com>',
        workerEnabled: process.env.NOTIFICATION_WORKER !== 'false',
      },
    };
  }
  async saveTemplates(templates: NotificationTemplate[], actor: JwtPayload) {
    if (
      !Array.isArray(templates) ||
      templates.length > 120 ||
      JSON.stringify(templates).length > 500_000
    )
      throw new BadRequestException('Invalid template collection');
    const seen = new Set<string>();
    for (const template of templates) {
      if (
        !template ||
        !/^[a-z][a-z0-9_.-]{0,99}$/.test(template.kind) ||
        seen.has(template.kind)
      )
        throw new BadRequestException('Invalid or duplicate event kind');
      seen.add(template.kind);
      if (
        !template.locales ||
        typeof template.locales !== 'object' ||
        Array.isArray(template.locales) ||
        !Object.keys(template.locales).length ||
        Object.keys(template.locales).length > 12
      )
        throw new BadRequestException(
          'At least one template language is required',
        );
      for (const [locale, body] of Object.entries(template.locales)) {
        if (
          !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(locale) ||
          !body ||
          typeof body.subject !== 'string' ||
          !body.subject.trim() ||
          body.subject.length > 200 ||
          /[\r\n]/.test(body.subject) ||
          typeof body.text !== 'string' ||
          !body.text.trim() ||
          body.text.length > 20_000 ||
          (body.html !== undefined &&
            (typeof body.html !== 'string' || body.html.length > 40_000))
        )
          throw new BadRequestException('Invalid localized template fields');
        if (
          body.html &&
          /<(?:script|iframe|object|embed|form|base|meta|link)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(
            body.html,
          )
        )
          throw new BadRequestException('Unsafe email HTML');
        try {
          templateVariables(body);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
      }
    }
    await this.prisma.siteSetting.upsert({
      where: { key: 'notificationTemplates' },
      create: {
        key: 'notificationTemplates',
        value: json({ version: 1, templates }),
      },
      update: { value: json({ version: 1, templates }) },
    });
    await this.prisma.auditLog.create({
      data: {
        actorKind: 'STAFF',
        actorStaffId: actor.sub,
        action: 'notification.templates.update',
        entityType: 'SiteSetting',
        entityId: 'notificationTemplates',
        after: json({ kinds: templates.map((item) => item.kind) }),
      },
    });
    return this.templates();
  }
  async recipientGroups(tx?: Prisma.TransactionClient): Promise<GroupConfig> {
    const config = await this.config(tx);
    return Object.fromEntries(
      groups.map((group) => [
        group,
        [
          ...new Set(
            (Array.isArray(config.groups[group]) ? config.groups[group] : [])
              .filter(
                (email: unknown): email is string =>
                  typeof email === 'string' && isEmail(email),
              )
              .map((email: string) => email.trim().toLowerCase()),
          ),
        ].slice(0, 50),
      ]),
    ) as GroupConfig;
  }
  async saveGroups(input: GroupConfig, actor: JwtPayload) {
    for (const group of groups)
      if (
        !Array.isArray(input[group]) ||
        input[group].length > 50 ||
        input[group].some(
          (email) => typeof email !== 'string' || !isEmail(email),
        )
      )
        throw new BadRequestException('Invalid ' + group + ' recipients');
    const value = Object.fromEntries(
      groups.map((group) => [
        group,
        [...new Set(input[group].map((email) => email.trim().toLowerCase()))],
      ]),
    );
    await this.prisma.siteSetting.upsert({
      where: { key: 'notifications' },
      create: { key: 'notifications', value },
      update: { value },
    });
    await this.prisma.auditLog.create({
      data: {
        actorKind: 'STAFF',
        actorStaffId: actor.sub,
        action: 'notification.groups.update',
        entityType: 'SiteSetting',
        entityId: 'notifications',
        after: json(
          Object.fromEntries(
            groups.map((group) => [group, value[group].length]),
          ),
        ),
      },
    });
    return value;
  }
}
