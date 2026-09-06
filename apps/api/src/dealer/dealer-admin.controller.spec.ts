import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { MFA_KEY, RequireMfaGuard } from '../mfa/require-mfa.guard.js';
import { DealerAdminController } from './dealer-admin.controller.js';

describe('DealerAdminController security metadata', () => {
  it('requires MFA guard and marker on dealer review writes', () => {
    const reviewHandler = DealerAdminController.prototype.review;
    const guards = Reflect.getMetadata(GUARDS_METADATA, reviewHandler) as
      unknown[] | undefined;

    expect(Reflect.getMetadata(MFA_KEY, reviewHandler)).toBe(true);
    expect(guards).toContain(RequireMfaGuard);
  });
});
