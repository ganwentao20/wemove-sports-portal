import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { traceMiddleware } from './trace.middleware.js';

function invoke(header?: string) {
  const req = { headers: header === undefined ? {} : { 'x-trace-id': header } } as Request;
  const setHeader = vi.fn();
  const res = { setHeader } as unknown as Response;
  const next = vi.fn() as NextFunction;
  traceMiddleware(req, res, next);
  return { req, setHeader, next };
}

describe('traceMiddleware', () => {
  it('透传安全且长度受限的 trace id', () => {
    const { req, setHeader, next } = invoke('client_123:span-4');
    expect(req.traceId).toBe('client_123:span-4');
    expect(setHeader).toHaveBeenCalledWith('x-trace-id', 'client_123:span-4');
    expect(next).toHaveBeenCalledOnce();
  });

  it('拒绝换行、空格和超长值并生成 UUID', () => {
    for (const unsafe of ['bad value', 'bad\nvalue', 'x'.repeat(65)]) {
      const { req } = invoke(unsafe);
      expect(req.traceId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
