import { describe, expect, it } from 'vitest';
import { assertOrderTransition } from './order-state.js';

describe('order state machine', () => {
  it.each([
    ['PENDING', 'CONFIRMED'],
    ['PENDING', 'CANCELLED'],
    ['CONFIRMED', 'FULFILLED'],
    ['CONFIRMED', 'CANCELLED'],
  ] as const)('allows %s -> %s', (current, next) => {
    expect(() => assertOrderTransition(current, next)).not.toThrow();
  });

  it.each([
    ['PENDING', 'FULFILLED'],
    ['CONFIRMED', 'PENDING'],
    ['FULFILLED', 'CANCELLED'],
    ['CANCELLED', 'PENDING'],
  ] as const)('rejects %s -> %s', (current, next) => {
    expect(() => assertOrderTransition(current, next)).toThrowError(
      expect.objectContaining({ status: 409 }),
    );
  });
});
