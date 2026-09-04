import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from './auth.service.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

/** @CurrentUser() payload —— 只能在 JwtAuthGuard 保护的路由中使用 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
