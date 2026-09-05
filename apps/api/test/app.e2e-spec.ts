import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/bootstrap-app.js';

/**
 * 冒烟 e2e（离线可跑：仅覆盖不依赖 DB 的链路 —— 响应体约定 / 校验错误码 / 404 兜底）。
 * DB 相关的集成用例由组员 E 在 docker 环境补齐（见测试报告规范）。
 */
describe('WEMOVE API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live → 统一成功响应体', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.message).toBe('success');
    expect(res.body.data.status).toBe('up');
    expect(res.body.traceId).toBeTruthy();
    expect(res.headers['x-trace-id']).toBeTruthy();
  });

  it('未知路由 → 404 统一错误体（code=40400）', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/no-such-route').expect(404);
    expect(res.body.code).toBe(40400);
    expect(res.body.data).toBeNull();
    expect(typeof res.body.message).toBe('string');
  });

  it('注册参数缺失 → 42200 校验错误（不触达 DB）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({})
      .expect(400);
    expect(res.body.code).toBe(42200);
  });

  it('非法邮箱登录 → 401（不触达 DB）', async () => {
    // email 格式先于查询被拦截
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
    expect(res.body.code).toBe(42200);
  });

  it('verify-email 缺 token → 42200（不触达 DB）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({})
      .expect(400);
    expect(res.body.code).toBe(42200);
  });

  it('forgot-password 非法邮箱 → 42200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'x' })
      .expect(400);
    expect(res.body.code).toBe(42200);
  });

  it('reset-password 弱密码 → 42200（不触达 DB）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 't', password: '123' })
      .expect(400);
    expect(res.body.code).toBe(42200);
  });

  it('后台员工管理无令牌 → 401 统一错误体（不触达 DB）', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/staff').expect(401);
    expect(res.body.code).toBe(40100);
  });

  it('后台角色列表无令牌 → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/roles').expect(401);
    expect(res.body.code).toBe(40100);
  });

  it('审计日志无令牌 → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/audit').expect(401);
    expect(res.body.code).toBe(40100);
  });
});
