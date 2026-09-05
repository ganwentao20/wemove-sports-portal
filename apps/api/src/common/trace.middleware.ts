import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const TRACE_HEADER = 'x-trace-id';

/** 为每个请求生成/透传 traceId（响应头 + 错误响应体），便于审计串联 */
export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers[TRACE_HEADER];
  const traceId = Array.isArray(incoming) ? incoming[0] : (incoming as string | undefined);
  req.traceId = traceId ?? randomUUID();
  res.setHeader(TRACE_HEADER, req.traceId);
  next();
}

declare module 'express-serve-static-core' {
  interface Request {
    traceId?: string;
  }
}

/** 从执行上下文取 traceId（拦截器/过滤器通用） */
export function requestTraceId(context: { switchToHttp(): { getRequest(): { traceId?: string } } }): string {
  return context.switchToHttp().getRequest().traceId ?? '';
}
