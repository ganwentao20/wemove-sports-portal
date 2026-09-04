# ADR-0001：整体技术选型与仓库结构

- 状态：已接受（2026-09，组长+AI 督导初稿，待全体例会评审）
- 日期：2026-09
- 决策人：组长（组内评审后生效）

## 背景

WEMOVE SPORTS 需要整合品牌官网 / B2C 用户中心 / B2B 经销商门户 / 运营后台四类入口，
同时满足课程硬指标：SEO（前台）、首屏 ≤ 2.5s、100 并发、越权防护、移动端无横向溢出；
6 人按业务模块纵向分工 + 文档横向认领；课程代码评分看重工程规范（类型安全、测试、审计）。

## 决策

1. **单仓（monorepo）＋ npm workspaces**：`apps/*` 工作区统一装依赖、统一脚本；
   避免 6 人各自维护多仓库；根脚本即“运行手册”（`npm run dev`）。
2. **前台统一使用一个 Next.js 应用 `apps/web`**（App Router，TypeScript，Tailwind）：
   - `(storefront)` 路由组：官网（SSR/ISR 兼顾 SEO）
   - `/customer/*`：B2C 用户中心
   - `/dealer/*`：B2B 经销商门户（申请/登录/工作台）
   - `/admin/*`：运营后台（RBAC 由服务端与 API 双重强制，前端只做界面层隔离）
   - 管理端暂不拆独立应用（减少一套构建/认证面）；若组员 D 需要独立产物，可随时按
     `apps/admin` 拆分（可逆决策，见 ADR 记录）。
3. **后端统一为 NestJS `apps/api`**：按业务模块切分（auth/rbac/users/catalog/pricing/…），
   Controller → Service → Prisma 分层；全局前缀 `/api/v1`。
4. **数据层 Prisma + PostgreSQL 16**（Docker 本地编排）；**Redis 7** 预留缓存/限流/验证码。
5. **认证**：双体系——C 端/经销商 `User`（JWT + bcrypt 自适应哈希）、后台 `Staff`（另设，
   敏感操作二次验证占位）；RBAC 权限点以 `permission code` 下沉数据表，支持答辩演示细粒度授权。
6. **价格引擎**：纯函数实现“企业专属价 → 价格表 → 等级价 → B2B 价（零售走 MSRP/Sale）”链式
   匹配，放 `apps/api/src/pricing`，强制单测覆盖优先级与越权边界（组员 C 主责）。
7. **工程规范**：仓库级 `.gitignore`/`.editorconfig`；Git 分支 `main`（受保护）+ `feature/<模块>-<成员>`；
   统一响应体 `{ code, message, data, traceId }`（common 层）；审计日志默认埋点（audit 模块）。
8. **文档/交付**：根 `README.md` 为唯一入口；课程红线清单集中在 `docs/README.md`。

## 后果

- 正面：单一语言（TypeScript）贯穿全栈；模板脚手架即“规范活文档”；ISR 支撑 SEO 答辩点。
- 负面/风险：TS/React 学习曲线；Next+Nest 双服务本地需同时启动（根脚本已封装）。
- 缓解：各业务页在骨架中以「示例切片」给出可抄写的模式（列表查询→响应体→页面渲染）。
