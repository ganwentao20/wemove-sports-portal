import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/**
 * 请求访问日志（组长）：method/path/status/耗时/traceId/ip —— 排障与审计串联用。
 * /health 探活路径不打日志（防刷屏）。
 */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const { method, path, ip } = req;

  res.on('finish', () => {
    if (path.startsWith('/api/v1/health')) return;
    logger.log(
      `${method} ${path} ${res.statusCode} ${Date.now() - startedAt}ms ip=${ip ?? '-'} trace=${req.traceId ?? '-'}`,
    );
  });
  next();
}
