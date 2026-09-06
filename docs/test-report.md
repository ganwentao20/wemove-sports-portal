# WEMOVE SPORTS 测试报告（持续更新版）

版本：v0.3　日期：2026-09-07　责任人：龙祖怡（组员 E）/ 全员复测

## 1. 测试范围与结论

本报告覆盖公共目录、客户认证与购物车、B2C 订单和库存事务、经销商申请/审批/授权价格/Quick Order、员工 RBAC/MFA/审计，以及 CMS、媒体、联系工单和工程质量门禁。本轮提交 `a270a52` 本地全仓验证通过；[GitHub Actions CI #39](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34057122274) 已在 PostgreSQL 16 与 Redis 7 真环境成功完成迁移、e2e 和构建。

当前结论：P0 主链路已具备自动化证据；已实现的 P1 订单与 Quick Order 切片通过单元/构建验证。浏览器兼容截图、邮件 UI 截图和最新数据库 e2e 截图须在部署或本地 Docker 可用后补入最终提交包。

## 2. 环境

| 项目 | 本地验证 | CI 验证 |
|---|---|---|
| 操作系统 | Windows，PowerShell | GitHub-hosted Ubuntu |
| Node / npm | Node ≥22 / npm ≥10 | Node 22 / npm ci |
| Web / API | Next.js 16.3.4 / NestJS 12 | 同 lockfile |
| 数据库 | Docker Desktop 本轮未运行 | PostgreSQL 16 service |
| 缓存 | 本轮数据库用例环境门控 | Redis 7 service |
| 测试工具 | Vitest 4.1.11、Supertest、Next/Nest build | 同仓脚本 |

## 3. 自动化结果

| 层级 | 命令 | 结果 | 覆盖重点 |
|---|---|---|---|
| Prisma | `npm run prisma:generate` | 通过 | Schema 与 Client 一致 |
| 静态检查 | `npm run lint` | 通过 | API/Web lint |
| 类型 | `npm run typecheck` | 通过 | API/Web TypeScript |
| 单元 | `npm test` | 14 文件、69 用例通过 | 认证限流、MFA、价格优先级、购物车归属、私有附件、审核/订单状态机、Quick Order |
| 离线 e2e | `npm run test:e2e -w api` | 12 通过、8 环境门控 | 响应 envelope、404、参数与权限元数据 |
| 生产构建 | `npm run build` | 通过 | Next 全部路由 + Nest build |
| DB e2e | GitHub Actions CI #39 | 通过 | 迁移、认证/Redis、目录、订单库存闭环 |

## 4. 功能与安全矩阵

| 编号 | 场景 | 期望 | 证据 | 状态 |
|---|---|---|---|---|
| AUTH-01 | 未勾选 18+ 注册 | 422，服务端拒绝 | Auth DTO/Service 单测 | 通过 |
| AUTH-02/05 | 验证/重置令牌重复使用 | 哈希存储、一次性消费、过期拒绝 | auth-flow e2e | 通过 |
| AUTH-03/04 | 登出黑名单、连续 5 次登录失败 | 旧 JWT 失效；锁定时正确密码不能绕过 | auth-flow e2e + 单测 | 通过 |
| DLR-02/03 | 审核与跨企业读取 | 写操作 MFA+审计；跨企业 403 | Dealer 单测与控制器元数据测试 | 通过 |
| DLR-04 | Quick Order 无效/重复/库存不足 | 逐行错误，不泄漏未授权 SKU | Dealer 单测 2 项 | 通过 |
| PRICE-01/02 | 公开价格隔离与优先级 | 不返回 B2B 字段；企业>价表>等级>默认 | Catalog e2e + Pricing 单测 | 通过 |
| ORDER-01 | 结算快照 | 整数分保存商品/SKU/单价快照 | Order 单测 + DB e2e | 通过（CI #39） |
| STOCK-01 | 库存并发扣减 | 事务、购物车行锁、条件扣减、不为负 | Order 单测 + DB e2e | 通过（CI #39） |
| ORDER-02 | 非法状态转换 | 409；取消/履约正确释放 reservation | 8 项状态机单测 + DB e2e | 通过 |
| ADM-02/03 | MFA 与审计 | 第 5 次失败锁定；关键写操作记录前后值 | MFA 单测、服务测试 | 通过 |
| WEB-04 | 联系表单 | 前后端校验、成功/失败反馈、蜜罐 | 构建 + 人工演示待截图 | 通过（截图待补） |
| DLR-01 | 资质附件 | 仅 PDF/JPG/PNG、≤5 MB、私有入库并校验媒体凭据 | Dealer Service 单测 + 生产构建 | 通过 |
| OPS-03 | 错误与 trace-id | 统一 envelope，非法 trace-id 重建 | common 单测/e2e | 通过 |

## 5. 性能与容量

2026-09-06 使用 autocannon 8.0.0、100 并发、30 秒，对 `/products` 与 `/products/:slug` 完成首轮只读容量基线：

| 场景 | 总请求 | Avg | P99 | Max | 请求/秒 | 错误 |
|---|---:|---:|---:|---:|---:|---:|
| 商品列表 | ≈34k | 88.9 ms | 132 ms | 264 ms | ≈1,121 | 0 |
| 商品详情 | ≈42k | 70.6 ms | 93 ms | 129 ms | ≈1,409 | 0 |

默认 `12000/min` 限流下，窗口放行量符合配置，超出部分返回 HTTP 429 / code 42900。原始口径与命令见 `docs/plans/load-test-plan.md`。尚需组员 E 在冻结版本对“90% 浏览 + 10% 登录”混合场景复测并保存终端输出/截图。

## 6. 兼容与可用性检查

待部署环境逐项签字：

- [ ] Chrome 当前版：桌面 1440px、手机 390px，无横向溢出。
- [ ] Edge 当前版：认证、目录、结算、后台 MFA 操作。
- [ ] Safari 当前版或 iOS 真机：菜单、表单、Cookie 会话。
- [ ] 键盘操作：导航、表单、状态下拉与错误提示可达。
- [ ] Lighthouse：主页/商品列表首屏目标 2.5 秒内，附环境和报告文件。

## 7. 缺陷与复测闭环

| 缺陷 | 修复 | 复测 |
|---|---|---|
| 登录锁定可被正确密码绕过 | 先检查锁定，再校验密码 | 单测通过 |
| CMS 公开接口返回草稿 | 公共读取强制 `PUBLISHED`，草稿仅后台接口 | lint/typecheck/build 通过；DB 复测待截图 |
| 媒体上传缺少大小与类型限制 | 5 MB、JPG/PNG/WebP/PDF MIME+扩展名双检，MFA 与审计 | lint/typecheck/build 通过；人工上传待截图 |
| 并发结算可能重复读取购物车 | 事务内 `FOR UPDATE` 锁定本人购物车 | 单测通过；DB e2e 已纳入 CI |
| 邮件链接缺少对应页面 | 补齐验证、重发、忘记/重置密码页面 | Next 生产构建通过 |

## 8. 最终签字条件

本报告转为最终版前必须补齐：浏览器兼容表、混合负载结果、Mailpit 邮件闭环截图、缺陷复测人和日期。不得把 CI 真环境执行误写成本机 Docker 执行。
