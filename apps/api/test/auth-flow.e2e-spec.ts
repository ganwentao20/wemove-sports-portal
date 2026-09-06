import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/bootstrap-app.js';
import { sha256 } from './../src/auth/passwords.util.js';

/**
 * DB 集成 e2e（组长）：注册→验证→登录→登出黑名单 全闭环 + 登录失败限流。
 * 依赖：本地 PostgreSQL/Redis 已起（npm run db:up）且 apps/api/.env 存在；
 * 启用：$env:E2E_DB='1' 后运行 test:e2e（CI 编排由组员 E 落地，未设标志时本文件自动跳过，不影响 CI 绿）。
 */
const runDb = process.env.E2E_DB === '1';

describe.skipIf(!runDb)('Auth 集成闭环（需 DB/Redis）', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const email = `it${Date.now()}-${randomUUID().slice(0, 8)}@wemove.local`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    // 清理测试数据
    await prisma.userToken.deleteMany({ where: { email } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('PENDING 用户：verify-email 后 login/me 全通，重复令牌被拒', async () => {
    // 直接构造 PENDING 用户 + 验证令牌（测试端知道 token 原文，仅存哈希）
    const token = `it-token-${randomUUID().replaceAll('-', '')}`;
    const { hash } = await import('bcryptjs');
    const passwordHash = await hash('Passw0rd123!', 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Integration Tester',
        passwordHash,
        ageConfirmed: true,
        status: 'PENDING',
      },
    });
    await prisma.userToken.create({
      data: {
        type: 'EMAIL_VERIFY',
        tokenHash: sha256(token),
        email,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const server = app.getHttpServer();

    // 未验证不能登录
    await request(server).post('/api/v1/auth/login').send({ email, password: 'Passw0rd123!' }).expect(403);

    // 验证成功
    const verified = await request(server)
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(201);
    expect(verified.body.code).toBe(0);
    expect(verified.body.data.verified).toBe(true);

    // 令牌一次性：重复使用 400
    await request(server).post('/api/v1/auth/verify-email').send({ token }).expect(400);

    // 登录成功 → me → logout → me 401（黑名单）
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Passw0rd123!' })
      .expect(200);
    const accessToken = login.body.data.accessToken;
    expect(accessToken).toBeTruthy();

    await request(server).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);
    const revoked = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
    expect(revoked.body.code).toBe(40101);
  });

  it('登录连续失败 5 次触发 429 限流（Redis）', async () => {
    const server = app.getHttpServer();
    let lastStatus = 0;
    for (let i = 1; i <= 5; i += 1) {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPass!' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);

    // 锁定窗口内不能用正确密码绕过失败计数。
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Passw0rd123!' })
      .expect(429);
  });
});
