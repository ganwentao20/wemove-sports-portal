import { All, Controller } from '@nestjs/common';
import { BizException, ERROR_CODES } from './errors.js';

/**
 * 未匹配路由兜底（必须位于 AppModule controllers 最后注册）：
 * Express 5 对未匹配请求默认输出 HTML 404 且不经过 Nest 异常管道，
 * 这里用 '*splat'（path-to-regexp v8 通配）捕获并把 404 归一为统一 JSON 响应体。
 */
@Controller()
export class FallbackController {
  @All('*splat')
  notFound() {
    throw new BizException(ERROR_CODES.NOT_FOUND, 'resource not found', 404);
  }
}
