# apps/api — WEMOVE 后端（NestJS 12 · Prisma 6 · PostgreSQL 16 · Redis 7）

全局前缀 `api/v1`；所有响应统一 `{ code, message, data, traceId }`（code=0 成功）。
异常经全局过滤器归一（42200 参数 / 40100 未登录 / 40300 无权限 / 40400 不存在 / 40900 冲突 / 50000 内部）。

## 模块归属（纵向到人）

| 模块                                                     | 职责                                                                                         | 负责人                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `src/common/`                                            | 统一响应体/错误码/分页/traceId/全局过滤器                                                    | 组长（公共基座）         |
| `src/prisma/`                                            | Prisma 服务（懒连接、全局注入）                                                              | 组长                     |
| `src/auth/`                                              | 注册/登录（User）、员工登录（Staff）、JWT 双体系、`/auth/me`                                 | 组长                     |
| `src/rbac/`                                              | `@Roles()` + `RolesGuard`（员工角色），权限点在 `Role/Permission` 表                         | 组长                     |
| `src/audit/`                                             | 审计记录 `AuditService.record()`（fire-and-forget）                                          | 组长                     |
| `src/health/`                                            | `/health/live` `/health/ready`（探活）                                                       | 组长/E                   |
| `src/pricing/`                                           | **价格引擎（纯函数 + 单测）**：企业专属价 > 价格表 > 等级价 > B2B 默认价；零售只走 MSRP/Sale | 组员 C（引擎与组长联调） |
| `src/catalog/`                                           | 商品公开只读切片（PLP/PDP 数据源，白名单出参防底价泄漏）                                     | 组员 C（演示切片）       |
| `src/dealer/`                                            | 经销商申请提交、本人/企业边界查询、防刷限流、后台审核状态机与审计                            | 组员 B                   |
| `src/cart/`；待建：`order/` `seo/`                      | B2C 购物车已接入；订单/结算（C）与 SEO 网关能力（D/组长）待后续切片                         | C/D/组长                 |
| `src/cms/` `src/media/` `src/contact/`                  | CMS、媒体与联系工单 API                                                                      | D                        |

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
npm run db:up        # 根目录：docker compose 起 PG16 + Redis7 + Mailpit
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

## API 一览


| 方法      | 路径                                                | 说明                                                                                    |
| --------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| GET       | `/health/live` `/health/ready`                      | live 仅检查进程；ready 同时检查 DB/Redis，故障时返回 503                                 |
| POST      | `/auth/register`                                    | C 端注册（18+ 声明必填；EMAIL_VERIFY_REQUIRED=true 时注册为 PENDING）                   |
| POST      | `/auth/verify-email`                                | 邮箱验证（一次性令牌，24h 有效）                                                        |
| POST      | `/auth/resend-verification`                         | 重发验证邮件（防枚举：统一返回 ok）                                                     |
| POST      | `/auth/login`                                       | C 端/经销商成员登录（Redis 失败限流：单邮箱 5 次/15min、单 IP 30 次/min）               |
| POST      | `/dealer/applications`                              | 提交经销商资质申请（公开，单 IP 5 次/min；Redis 不可用时降级）                          |
| GET       | `/dealer/applications/:id`                          | 查询本人或所属企业申请（Bearer JWT，跨账号返回 403）                                    |
| GET       | `/dealer/catalog?quantity=5`                        | 已审批经销商目录与企业/等级/B2B 默认成交价（Bearer JWT）                                |
| GET       | `/admin/dealer/applications`                        | 审核工作台列表，可按 status 筛选（仅 SUPER_ADMIN）                                      |
| PATCH     | `/admin/dealer/applications/:id/review`             | 审核流转；批准时事务创建/批准企业并绑定申请人为 OWNER，终态不可回退并留审计              |
| POST      | `/auth/staff/login`                                 | 后台员工登录（角色入 token；独立限流）                                                  |
| POST      | `/auth/forgot-password`                             | 忘记密码（发重置邮件，1h 有效；防枚举）                                                 |
| POST      | `/auth/reset-password`                              | 重置密码（一次性令牌；同邮箱旧重置令牌一并作废）                                        |
| GET       | `/auth/me`                                          | 当前登录者（Bearer）                                                                    |
| POST      | `/auth/logout`                                      | 登出：jti 入 Redis 黑名单，失效即刻生效（Bearer）                                       |
| GET       | `/products` `/products/:slug` `/categories`         | 公开目录（游客）                                                                        |
| GET/POST  | `/admin/staff`                                      | 员工列表（搜索/状态/分页）/ 新增（均仅 SUPER_ADMIN）                                    |
| GET/PATCH | `/admin/staff/:id`                                  | 员工详情 / 更新（含全量角色替换）                                                       |
| PATCH     | `/admin/staff/:id/password`                         | 管理员重置员工密码（SUPER_ADMIN）                                                       |
| PATCH     | `/admin/me/password`                                | 员工改自己的密码（登录即可）                                                            |
| GET/POST  | `/admin/roles` · PUT `/admin/roles/:id/permissions` | 角色列表（含权限/staff 数）/ 新建 / 分配权限                                            |
| GET       | `/admin/permissions`                                | 权限点按域分组输出                                                                      |
| GET       | `/admin/audit`                                      | 审计日志（actorKind/action/entity 过滤 + 分页，含操作人姓名邮箱与 before/after 变更值） |
| POST      | `/admin/me/mfa/setup`                               | MFA 启用第一步：验证当前密码，返回 base32 secret + otpauthUrl（供扫码）                 |
| POST      | `/admin/me/mfa/confirm`                             | 用 6 位动态码确认启用（连续错 5 次锁 15 分钟）                                          |
| POST      | `/admin/me/mfa/disable`                             | 用动态码停用并清除密钥                                                                  |
| GET | `/admin/pricing-rules` | 价格规则列表（variantId/scope/companyId/bookId/tierId/active 过滤 + 分页，SUPER_ADMIN/CATALOG_OPERATOR + MFA） |
| GET | `/admin/pricing-rules/:id` | 价格规则详情 |
| POST | `/admin/pricing-rules` | 新建价格规则（scope-specific 字段强校验 + 外键存在性校验） |
| PATCH | `/admin/pricing-rules/:id` | 更新规则（全量审计 before/after） |
| DELETE | `/admin/pricing-rules/:id` | 删除规则（审计留痕） |
| GET | `/admin/pricing-rules/resolve` | 引擎装配调试：传 companyId/tierId/bookId/quantity 返回命中规则与取价 |
| GET | `/cart` | 我的购物车（customer Bearer，变体维度 + 行小计/总价） |
| POST | `/cart/items` | 加购（variantId+quantity，合并同变体；库存超卖防护） |
| PATCH | `/cart/items/:variantId` | 改量（quantity=0 等同删除） |
| DELETE | `/cart/items/:variantId` | 移除单个变体行 |
| DELETE | `/cart` | 清空购物车 |

## MFA 二次认证（安全红线）

- 敏感管理接口（`/admin/staff*`、`/admin/roles*`）**已挂 MFA 门禁**：`@RequireMfa()` + `RequireMfaGuard`，
  需携带请求头 `x-mfa-code: <6位动态码>`，且账号已启用 MFA；缺失 → `40302`，错误 → `40301`（5 次/15min 锁定）。
- 启用流程：`setup`（当前密码）→ 用认证器 App 扫码或手工录入 secret → `confirm`（动态码）→ 后续敏感操作带码。
- 开发者快速取码：`node -e "require('otplib').generate({secret:'<SECRET>'}).then(c=>console.log(c))"`（仓库根执行）。
- 其他成员扩展敏感写接口时复用：`import { RequireMfa, RequireMfaGuard } from '../mfa/require-mfa.guard.js'`，
  `@UseGuards(JwtAuthGuard, RolesGuard, RequireMfaGuard) + @RequireMfa()`，并在模块 imports 加 `MfaModule`。
- 表结构：`Staff.mfaSecret/mfaEnabled/mfaConfirmedAt`（迁移 `20260905060818_staff_mfa`）。

## 安全与密钥（组长红线）

- `JWT_ACCESS_SECRET` 生产必换强随机值；密码 bcrypt cost=12；JWT 携带 `jti` 支撑登出黑名单。
- 注册仅限成年人（ageConfirmed 硬校验）；严禁设计儿童账号体系。
- **登录限流与登出黑名单依赖 Redis**：`REDIS_URL` 未配置/连接失败时自动降级
  （限流跳过、黑名单尽力而为），服务恢复后自愈（无需重启）——降级语义已在代码注释说明，
  生产部署必须常驻 Redis。
- **邮件服务**：`SMTP_HOST` 未配置时走"开发日志模式"（验证/重置链接打印到终端），
  配置后真发信（Mailpit 联调见组员 E 的 E1 任务）；发送失败只记日志不阻断注册主流程。
- **全局加固层（已在 setupApp 生效）**：helmet 安全响应头（nosniff/X-Frame-Options 等）、
  gzip 压缩（threshold=0，首屏性能支撑）、请求体上限 256kb、全局限流
  （单 IP/分钟，env `GLOBAL_RATE_LIMIT_PER_MIN` 默认 12000，兼容 100 并发压测；/health 豁免）、
  请求访问日志（method/status/耗时/traceId/ip）。

## 测试

- 单元：`npm test`（纯逻辑，离线可跑）。
- e2e 离线冒烟：`npm run test:e2e`（响应体/校验/门禁约定）。
- **DB 集成闭环（需 docker 的 PG+Redis）**：设置 `E2E_DB=1` 后运行 test:e2e，
  覆盖 注册→邮箱验证→登录→登出黑名单 与 登录失败限流 429（CI 编排由组员 E 接入）。
