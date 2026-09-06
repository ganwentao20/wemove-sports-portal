import type { OrderStatus } from '@prisma/client';
import { BizException, ERROR_CODES } from '../common/errors.js';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  CANCELLED: [],
};

export function assertOrderTransition(
  current: OrderStatus,
  next: OrderStatus,
): void {
  if (!TRANSITIONS[current].includes(next)) {
    throw new BizException(
      ERROR_CODES.CONFLICT,
      `order cannot transition from ${current} to ${next}`,
      409,
    );
  }
}
