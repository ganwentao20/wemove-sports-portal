import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from './errors.js';
import { requestTraceId } from './trace.middleware.js';

interface RawResponse {
  code?: unknown;
  message?: unknown;
  error?: unknown;
}

/**
 * 全局异常过滤器：所有异常 → 统一响应体 { code, message, data:null, traceId }
 * 映射策略：BizException/自定义 code > HTTP 状态默认码 > Prisma 错误 > 500
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status(code: number): { json(body: unknown): void } }>();

    const result = this.resolve(exception);
    if (result.status >= 500) {
      this.logger.error(
        `${result.code} ${result.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(result.status).json({
      code: result.code,
      message: result.message,
      data: null,
      traceId: requestTraceId(host),
    });
  }

  private resolve(exception: unknown): { status: number; code: number; message: string } {
    // 1) 显式业务码（BizException 或 response 携带 code）
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        return {
          status,
          code: ERROR_CODES.INTERNAL,
          message: 'Internal Server Error',
        };
      }
      const raw = exception.getResponse() as RawResponse | string;
      if (typeof raw === 'object' && raw !== null) {
        if (typeof raw.code === 'number') {
          return { status, code: raw.code, message: String(raw.message ?? exception.message) };
        }
        // ValidationPipe 的校验错误数组
        if (Array.isArray(raw.message)) {
          return {
            status,
            code: ERROR_CODES.VALIDATION,
            message: raw.message.join('; '),
          };
        }
      }
      return { status, code: this.defaultCodeOf(status), message: exception.message };
    }

    // 2) Prisma 已知错误 → 友好的业务码
    const PrismaKnownError = (Prisma as any)?.PrismaClientKnownRequestError;
    const PrismaValidationError = (Prisma as any)?.PrismaClientValidationError;
    if (PrismaKnownError && exception instanceof PrismaKnownError) {
      return this.resolvePrisma(exception as { code?: string });
    }
    if (PrismaValidationError && exception instanceof PrismaValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION,
        message: '查询条件不合法',
      };
    }

    // 3) 未知异常
    // 未知异常只写服务端日志，避免把数据库、文件路径等内部信息暴露给客户端。
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL,
      message: 'Internal Server Error',
    };
  }

  private defaultCodeOf(status: number): number {
    const map: Record<number, number> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMIT,
    };
    return map[status] ?? ERROR_CODES.INTERNAL;
  }

  private resolvePrisma(err: { code?: string }): {
    status: number;
    code: number;
    message: string;
  } {
    switch (err.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: ERROR_CODES.CONFLICT,
          message: '资源已存在（唯一约束冲突）',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ERROR_CODES.NOT_FOUND,
          message: '记录不存在或已被删除',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ERROR_CODES.INTERNAL,
          message: 'Internal Server Error',
        };
    }
  }
}
