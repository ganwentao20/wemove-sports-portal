import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import nodemailer from 'nodemailer';

/**
 * 邮件服务（组长基座）：
 * - 未配置 SMTP 时进入"开发模式"：不发送，把验证链接打到日志（联调邮箱验证闭环无需真邮件服务器）；
 * - 配置 SMTP_HOST（龙祖怡的 Mailpit 容器落地后配 localhost:1025）即真发信；
 * - 发送失败只记日志不抛错 —— 邮件绝不能阻断注册等主流程（防丢失用户）。
 */
@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

  private get smtpConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  private get appBaseUrl(): string {
    return (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  /** 注册/邮箱验证邮件（一次性令牌） */
  async sendVerification(to: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.dispatch(
      to,
      'Verify your WEMOVE SPORTS account',
      `Welcome to WEMOVE SPORTS!<br/><br/>Please confirm you are the owner of this email address by clicking the link below (valid for 24 hours):<br/><a href="${link}">Verify my email</a><br/><br/>If you did not create this account, you can safely ignore this email.`,
      `Verify link (24h): ${link}`,
    );
  }

  /** 找回密码邮件（一次性令牌） */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.dispatch(
      to,
      'Reset your WEMOVE SPORTS password',
      `We received a request to reset your password. Click the link below to choose a new one (valid for 1 hour):<br/><a href="${link}">Reset password</a><br/><br/>If you did not request this, you can safely ignore this email.`,
      `Reset link (1h): ${link}`,
    );
  }

  // ---------------------------------------------------------------- 内部
  private async dispatch(to: string, subject: string, html: string, devText: string): Promise<void> {
    if (!this.smtpConfigured) {
      // 开发模式：不打日志就接不了闭环 —— 仅打链接不打令牌正文以外的信息
      this.logger.log(`[email-dev] to=${to} subject="${subject}" ${devText}`);
      return;
    }
    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? 'WEMOVE SPORTS <no-reply@wemovetoy.com>',
        to,
        subject,
        html,
        text: html.replace(/<[^>]+>/g, ' '),
      });
      this.logger.log(`email sent to=${to} subject="${subject}"`);
    } catch (err) {
      this.logger.error(`email send failed to=${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private getTransporter(): ReturnType<typeof nodemailer.createTransport> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
            : undefined,
      });
    }
    return this.transporter;
  }

  async onModuleDestroy() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
