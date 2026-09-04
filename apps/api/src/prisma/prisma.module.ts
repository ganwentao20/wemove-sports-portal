import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** 全局数据库模块：业务模块无需重复导入即可注入 PrismaService */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
