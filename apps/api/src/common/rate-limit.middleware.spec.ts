import { describe, expect, it } from 'vitest';
import { positiveIntegerEnv } from './rate-limit.middleware.js';

describe('positiveIntegerEnv', () => {
  it('使用有效正整数', () => {
    expect(positiveIntegerEnv('600', 12000)).toBe(600);
  });

  it('无效、零、负数配置回退默认值', () => {
    expect(positiveIntegerEnv(undefined, 12000)).toBe(12000);
    expect(positiveIntegerEnv('NaN', 12000)).toBe(12000);
    expect(positiveIntegerEnv('0', 12000)).toBe(12000);
    expect(positiveIntegerEnv('-1', 12000)).toBe(12000);
  });
});
