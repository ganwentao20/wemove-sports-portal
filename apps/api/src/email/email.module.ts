import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';

/** 邮件模块：EmailService 可注入（SMTP 未配置时自动降级为日志模式） */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
