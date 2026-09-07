import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { sha256 } from '../src/auth/passwords.util.js';

type Inbox = { messages: Array<{ ID: string; Subject: string }> };
type Message = { ID: string; Subject: string; HTML: string; Text: string; To: Array<{ Address: string }> };

/** Real SMTP + Mailpit API, opt-in to avoid using a developer's external SMTP server.
 * API contract: https://mailpit.axllent.org/docs/api-v1/
 */
describe.skipIf(process.env.E2E_DB !== '1' || process.env.E2E_MAIL !== '1')('Mailpit registration and password recovery (SMTP)', () => {
  const prisma = new PrismaClient();
  const emails: string[] = [];
  const inboxUrl = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
  const password = 'MailFlow123!';
  let app: INestApplication;

  async function mailApi(path: string, init?: RequestInit) {
    const response = await fetch(`${inboxUrl}/api/v1${path}`, { ...init, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path.split('?')[0]} failed: ${response.status}`);
    return response;
  }
  async function inbox(email: string): Promise<Inbox> {
    return (await mailApi(`/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
  }
  async function message(email: string, subject: string, exclude: string[] = []): Promise<Message> {
    let id: string | undefined;
    await expect.poll(async () => {
      id = (await inbox(email)).messages.find(item => item.Subject === subject && !exclude.includes(item.ID))?.ID;
      return Boolean(id);
    }, { timeout: 8000, interval: 150 }).toBe(true);
    return (await mailApi(`/message/${id}`)).json();
  }
  function linkToken(mail: Message, path: '/verify-email' | '/reset-password') {
    const link = mail.HTML.match(/href="([^"]+)"/)?.[1];
    expect(Boolean(link)).toBe(true);
    const url = new URL(link!);
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe(path);
    // Boolean assertion avoids printing the live token in failed test output.
    expect(mail.Text.includes(link!)).toBe(true);
    const token = url.searchParams.get('token');
    expect(Boolean(token)).toBe(true);
    return token!;
  }
  const post = (path: string, body: object) => request(app.getHttpServer()).post(`/api/v1/auth/${path}`).send(body);
  async function register() {
    const email = `mail-${randomUUID()}@wemove.test`;
    emails.push(email);
    const result = await post('register', { email, name: 'Mailpit integration', password, ageConfirmed: true }).expect(201);
    expect(result.body.data.status).toBe('PENDING');
    return { email, id: result.body.data.id as string };
  }
  beforeAll(async () => {
    vi.stubEnv('SMTP_HOST', process.env.E2E_SMTP_HOST ?? 'localhost');
    vi.stubEnv('SMTP_PORT', process.env.E2E_SMTP_PORT ?? '1025');
    vi.stubEnv('SMTP_SECURE', 'false');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASS', '');
    vi.stubEnv('EMAIL_VERIFY_REQUIRED', 'true');
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
    await mailApi('/info');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await setupApp(app);
    await app.init();
  });
  afterAll(async () => {
    try {
      await app?.close();
      await prisma.auditLog.deleteMany({ where: { customer: { email: { in: emails } } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      // Delete only messages addressed to this run's random test accounts.
      const ids = [...new Set((await Promise.all(emails.map(inbox))).flatMap(result => result.messages.map(item => item.ID)))];
      if (ids.length) await mailApi('/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: ids }) });
    } finally {
      await prisma.$disconnect();
      vi.unstubAllEnvs();
    }
  });

  it('registers PENDING, receives a real verification link, activates and logs in', async () => {
    const user = await register();
    await post('login', { email: user.email, password }).expect(403);
    const mail = await message(user.email, 'Verify your WEMOVE SPORTS account');
    expect(mail.To.some(to => to.Address === user.email)).toBe(true);
    const token = linkToken(mail, '/verify-email');
    const saved = await prisma.userToken.findUnique({ where: { tokenHash: sha256(token) } });
    expect(saved?.userId === user.id && saved?.tokenHash !== token).toBe(true);
    expect(saved!.expiresAt.getTime() - saved!.createdAt.getTime()).toBeGreaterThan(23 * 3600000);
    await post('verify-email', { token }).expect(201);
    await post('verify-email', { token }).expect(400);
    const login = await post('login', { email: user.email, password }).expect(200);
    expect(Boolean(login.body.data.accessToken)).toBe(true);
  });

  it('resends a new SMTP verification link and invalidates the old one', async () => {
    const user = await register();
    const first = await message(user.email, 'Verify your WEMOVE SPORTS account');
    const oldToken = linkToken(first, '/verify-email');
    await post('resend-verification', { email: user.email }).expect(200);
    const replacement = await message(user.email, first.Subject, [first.ID]);
    const newToken = linkToken(replacement, '/verify-email');
    expect(newToken !== oldToken).toBe(true);
    await post('verify-email', { token: oldToken }).expect(400);
    await post('verify-email', { token: newToken }).expect(201);
  });

  it('receives a reset email, changes the password and rejects reuse', async () => {
    const user = await register();
    const verification = await message(user.email, 'Verify your WEMOVE SPORTS account');
    await post('verify-email', { token: linkToken(verification, '/verify-email') }).expect(201);
    await post('forgot-password', { email: user.email }).expect(200);
    const mail = await message(user.email, 'Reset your WEMOVE SPORTS password');
    const token = linkToken(mail, '/reset-password');
    const newPassword = 'RecoveredPassword123!';
    await post('reset-password', { token, password: newPassword }).expect(200);
    await post('reset-password', { token, password: 'UnexpectedChange123!' }).expect(400);
    await post('login', { email: user.email, password }).expect(401);
    await post('login', { email: user.email, password: newPassword }).expect(200);
  });

  it('returns generic responses without mailing nonexistent or suspended accounts', async () => {
    const unknown = `absent-${randomUUID()}@wemove.test`;
    emails.push(unknown);
    for (const path of ['resend-verification', 'forgot-password']) {
      const result = await post(path, { email: unknown }).expect(200);
      expect(result.body.data).toEqual({ ok: true });
    }
    expect((await inbox(unknown)).messages).toHaveLength(0);
    const user = await register();
    await message(user.email, 'Verify your WEMOVE SPORTS account');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    for (const path of ['resend-verification', 'forgot-password']) {
      const result = await post(path, { email: user.email }).expect(200);
      expect(result.body.data).toEqual({ ok: true });
    }
    expect((await inbox(user.email)).messages).toHaveLength(1);
  });
});
