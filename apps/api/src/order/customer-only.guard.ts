import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { BizException, ERROR_CODES } from '../common/errors.js';
@Injectable()
export class CustomerOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (
      context.switchToHttp().getRequest<AuthenticatedRequest>().user?.kind !==
      'customer'
    )
      throw new BizException(
        ERROR_CODES.FORBIDDEN,
        'Customer session required; staff must use authorized admin routes',
        403,
      );
    return true;
  }
}
