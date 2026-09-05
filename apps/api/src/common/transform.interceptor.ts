import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { ApiEnvelope } from './api-response.js';
import { requestTraceId } from './trace.middleware.js';

/** 成功响应统一包裹为 { code:0, message, data, traceId } */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'success',
        data: data ?? null,
        traceId: requestTraceId(_context),
      })),
    );
  }
}
