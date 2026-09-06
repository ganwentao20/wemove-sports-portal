import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PricingRuleQueryDto, UpdatePricingRuleDto } from './pricing.dto.js';

describe('pricing DTO transformations', () => {
  it('parses active=false as boolean false instead of a truthy string', async () => {
    const dto = plainToInstance(PricingRuleQueryDto, { active: 'false' });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.active).toBe(false);
  });

  it('rejects unsupported boolean query values', async () => {
    const dto = plainToInstance(PricingRuleQueryDto, { active: 'no' });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('validates a supplied scope reference even when scope is omitted', async () => {
    const dto = plainToInstance(UpdatePricingRuleDto, { companyId: 123 });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
