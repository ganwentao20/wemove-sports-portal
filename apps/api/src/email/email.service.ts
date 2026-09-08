import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service.js';

/**
 * 邮件服务（组长基座）：
 * - 未配置 SMTP 时保留加密持久队列，不打印验证令牌；
 * - 配置 SMTP_HOST（龙祖怡的 Mailpit 容器落地后配 localhost:1025）即真发信；
 * - 失败重试与投递状态统一由 NotificationsService 管理。
 */
@Injectable()
export class EmailService {
  constructor(private readonly notifications: NotificationsService) {}

  private get appBaseUrl(): string {
    return (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  /** 注册/邮箱验证邮件（一次性令牌） */
  async sendVerification(to: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.dispatch(
      to,
      'Verify your WEMOVE account',
      `Welcome to WEMOVE!<br/><br/>Please confirm you are the owner of this email address by clicking the link below (valid for 24 hours):<br/><a href="${link}">Verify my email</a><br/><br/>If you did not create this account, you can safely ignore this email.`,
      `Verify link (24h): ${link}`,
    );
  }

  /** 找回密码邮件（一次性令牌） */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.dispatch(
      to,
      'Reset your WEMOVE password',
      `We received a request to reset your password. Click the link below to choose a new one (valid for 1 hour):<br/><a href="${link}">Reset password</a><br/><br/>If you did not request this, you can safely ignore this email.`,
      `Reset link (1h): ${link}`,
    );
  }

  private async dispatch(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    await this.notifications.enqueue({
      kind: subject.includes('Reset')
        ? 'account.password-reset'
        : 'account.verify',
      to,
      subject,
      html,
      text,
      dedupeKey: createHash('sha256')
        .update(to + text)
        .digest('hex'),
    });
  }
}
