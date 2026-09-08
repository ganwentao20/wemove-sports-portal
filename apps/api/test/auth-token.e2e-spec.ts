import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/bootstrap-app.js';
import { hashPassword, sha256, verifyPassword } from '../src/auth/passwords.util.js';

describe.skipIf(process.env.E2E_DB !== '1')('One-time auth tokens (DB concurrency)', () => {
  const prisma = new PrismaClient();
  const users: string[] = [];
  let app: INestApplication;
  let initialHash: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await setupApp(app);
    await app.init();
    initialHash = await hashPassword('Original123!');
  });
  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { actorCustomerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });
  async function fixture(status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' = 'PENDING') {
    const user = await prisma.user.create({ data: {
      email: `token-${randomUUID()}@wemove.test`, name: 'Token regression',
      passwordHash: initialHash, ageConfirmed: true, status,
    } });
    users.push(user.id);
    return user;
  }
  async function token(user: { id: string; email: string }, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET', expired = false) {
    const value = randomUUID();
    await prisma.userToken.create({ data: {
      userId: user.id, email: user.email, type, tokenHash: sha256(value),
      expiresAt: new Date(Date.now() + (expired ? -1000 : 3600000)),
    } });
    return value;
  }
  const verify = (value: string) => request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: value });
  const reset = (value: string, password: string) => request(app.getHttpServer()).post('/api/v1/auth/reset-password').send({ token: value, password });

  it('allows only one concurrent verification and one success audit', async () => {
    const user = await fixture();
    const value = await token(user, 'EMAIL_VERIFY');
    const results = await Promise.all(Array.from({ length: 6 }, () => verify(value)));
    expect(results.map(r => r.status).sort()).toEqual([201, 400, 400, 400, 400, 400]);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ status: 'ACTIVE' });
    await expect.poll(() => prisma.auditLog.count({ where: { actorCustomerId: user.id, action: 'auth.email.verify' } })).toBe(1);
  });

  it('never reactivates a suspended account through an earlier verification link', async () => {
    const user = await fixture('SUSPENDED');
    const value = await token(user, 'EMAIL_VERIFY');
    await verify(value).expect(400);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ status: 'SUSPENDED' });
    expect(await prisma.userToken.findUnique({ where: { tokenHash: sha256(value) } })).toMatchObject({ consumedAt: null });
  });

  it('allows only one concurrent password change with the same reset token', async () => {
    const user = await fixture('ACTIVE');
    const value = await token(user, 'PASSWORD_RESET');
    const passwords = ['FirstReset123!', 'SecondReset123!'];
    const results = await Promise.all(passwords.map(password => reset(value, password)));
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(passwords[results.findIndex(r => r.status === 200)]!, saved.passwordHash)).toBe(true);
    await expect.poll(() => prisma.auditLog.count({ where: { actorCustomerId: user.id, action: 'auth.password.reset' } })).toBe(1);
  });

  it('serializes different reset tokens for one account and invalidates every older link', async () => {
    const user = await fixture('ACTIVE');
    const values = await Promise.all([token(user, 'PASSWORD_RESET'), token(user, 'PASSWORD_RESET')]);
    const results = await Promise.all(values.map((value, index) => reset(value, `NewPassword${index}!`)));
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await prisma.userToken.count({ where: { userId: user.id, type: 'PASSWORD_RESET', consumedAt: null } })).toBe(0);
    for (const value of values) await reset(value, 'LaterReset123!').expect(400);
  });

  it('rejects expired links and suspended-account resets without changing data', async () => {
    const pending = await fixture();
    await verify(await token(pending, 'EMAIL_VERIFY', true)).expect(400);
    const active = await fixture('ACTIVE');
    await reset(await token(active, 'PASSWORD_RESET', true), 'NewPassword123!').expect(400);
    const suspended = await fixture('SUSPENDED');
    await reset(await token(suspended, 'PASSWORD_RESET'), 'NewPassword123!').expect(400);
    expect(await prisma.user.findUnique({ where: { id: pending.id } })).toMatchObject({ status: 'PENDING' });
    for (const user of [active, suspended]) expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ passwordHash: initialHash });
  });
});
