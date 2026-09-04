# apps/api — WEMOVE 后端（NestJS 12 · Prisma 6 · PostgreSQL 16 · Redis 预留）

全局前缀 `api/v1`；所有响应统一 `{ code, message, data, traceId }`（code=0 成功）。
异常经全局过滤器归一（42200 参数 / 40100 未登录 / 40300 无权限 / 40400 不存在 / 40900 冲突 / 50000 内部）。

## 模块归属（纵向到人）

| 模块 | 职责 | 负责人 |
|---|---|---|
| `src/common/` | 统一响应体/错误码/分页/traceId/全局过滤器 | 组长（公共基座） |
| `src/prisma/` | Prisma 服务（懒连接、全局注入） | 组长 |
| `src/auth/` | 注册/登录（User）、员工登录（Staff）、JWT 双体系、`/auth/me` | 组长 |
| `src/rbac/` | `@Roles()` + `RolesGuard`（员工角色），权限点在 `Role/Permission` 表 | 组长 |
| `src/audit/` | 审计记录 `AuditService.record()`（fire-and-forget） | 组长 |
| `src/health/` | `/health/live` `/health/ready`（探活） | 组长/E |
| `src/pricing/` | **价格引擎（纯函数 + 单测）**：企业专属价 > 价格表 > 等级价 > B2B 默认价；零售只走 MSRP/Sale | 组员 C（引擎与组长联调） |
| `src/catalog/` | 商品公开只读切片（PLP/PDP 数据源，白名单出参防底价泄漏） | 组员 C（演示切片） |
| 待建：`dealer/` `order/` `cart/` `cms/` `media/` `contact/` `seo/` | B2B 审批流/RFQ/PO（B）、购物车订单（C）、CMS/媒体（D） | B/C/D |

## 工程约定

- **ESM**：所有相对导入必须带 `.js` 后缀（`import './x.js'`），勿写 `./x`。
- **校验**：Controller 收 DTO（class-validator），全局 ValidationPipe whitelist 防参数污染。
- **数据访问**：一律走 `PrismaService`；敏感字段（密码哈希等）永远不进 select/response。
- **防越权**：经销商价经 `pricing-engine.isAllowedDealerPriceView` 判定 + 企业边界 companyId 注入，
  公开接口只映射零售价（见 `catalog.service.ts` 注释与安全测试点）。
- **审计**：后台敏感操作前调用 `audit.record({...})`。
- **测试**：vitest。纯逻辑单测放 `src/**/*.spec.ts`（离线可跑）；e2e 在 `test/`（`npm run test:e2e`，
  当前仅覆盖不依赖 DB 的约定链路；DB 集成用例由组员 E 在 docker 中补）。
- **lint**：`npm run lint`（oxlint）。格式：prettier（`npm run format`）。

## 数据库（Prisma 6）

```bash
npm run db:up        # 根目录：docker compose 起 PG16+Redis7
cd apps/api
copy .env.example .env            # Windows；或手动复制 infra/.env.example 同值
npx prisma migrate dev --name init # 生成迁移并建表
npm run prisma:seed               # RBAC 基座 + 演示数据（幂等）
npx prisma studio                 # 可视化查看（可选）
```

Schema 单一事实源：`prisma/schema.prisma`（归属注释 M1/MA/MB/MC/MD/ME）。
**新增表流程**：改 schema → `prisma migrate dev --name xxx` → 迁移 SQL 一并提交。
> 升级提示：Prisma 当前固定 v6（经典约定）；v7+ 需 prisma.config.ts 与新 client，
> 由组员 C/E 评估后统一升级。

## API 一览（骨架已可用）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health/live` `/health/ready` | 探活（ready 需 DB） |
| POST | `/auth/register` | C 端注册（18+ 声明必填，邮箱验证开关 EMAIL_VERIFY_REQUIRED） |
| POST | `/auth/login` | C 端/经销商成员登录 |
| POST | `/auth/staff/login` | 后台员工登录（角色入 token） |
| GET | `/auth/me` | 当前登录者（Bearer） |
| GET | `/products` `/products/:slug` `/categories` | 公开目录（游客） |

## 安全与密钥（组长红线）

- `JWT_ACCESS_SECRET` 生产必换强随机值；密码 bcrypt cost=12。
- 注册仅限成年人（ageConfirmed 硬校验）；严禁设计儿童账号体系。
- 后台敏感操作二次认证（TOTP）与 Redis 限流/黑名单为组长后续任务，接口已留位。
