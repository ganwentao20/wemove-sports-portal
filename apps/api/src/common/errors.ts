import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 统一业务错误码（与前端 lib/api.ts 的 code!==0 判定配合）
 * 分段：0 成功；40xxx 客户端；50xxx 服务端。
 */
export const ERROR_CODES = {
  VALIDATION: 42200, // 参数校验失败
  UNAUTHORIZED: 40100, // 未登录/凭证无效
  TOKEN_EXPIRED: 40101, // 令牌过期（前端据此刷新/重登）
  FORBIDDEN: 40300, // 已登录但无权限（越权兜底）
  NOT_FOUND: 40400,
  CONFLICT: 40900, // 资源冲突（重复注册邮箱等）
  RATE_LIMIT: 42900,
  INTERNAL: 50000,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 业务可抛异常：携带业务码 + 用户可读信息 + 可选 HTTP 状态 */
export class BizException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message, data: null }, httpStatus);
  }
}

export const isBizCode = (value: unknown): value is ErrorCode =>
  typeof value === 'number' && Object.values(ERROR_CODES).includes(value as ErrorCode);
