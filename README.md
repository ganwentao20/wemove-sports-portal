# WEMOVE SPORTS · 官网与业务门户重构项目

> **现网站**：http://www.wemovetoy.com（待迁移）｜ **重构目标**：HTTPS 正式站 ｜ 课程：《软件开发实践2》团队大作业
> 以运动游戏玩具（儿童保龄球套装、平衡板等）为核心的品牌出海 Web 系统。

## 一、项目定位

将现有静态官网重构为可持续动态运营的一体化平台，包含四大门户：

| 门户 | 说明 |
|---|---|
| 前台品牌官网（Portal） | 响应式品牌展示、分类产品目录(PLP)、产品详情(PDP/图集/视频/对比)、Play & Learn、全站搜索、支持与下载、联系表单 |
| 注册用户中心（Customer） | 注册/邮箱验证/登录、个人资料、地址簿、心愿单、B2C 购物车结算、订单追踪与售后申请 |
| 经销商门户（Dealer） | 资质在线申请与审核、专属授权目录与阶梯/专属价格、Quick Order、RFQ 询价报价、PO 采购订单、私有资料签名下载 |
| 运营管理后台（Admin） | RBAC 权限体系、商品与变体 PIM、多层级价格引擎、订单履约/退款、经销商审批流、CMS 与首页模块化配置、SEO/301、审计日志 |

> 合规：产品面向儿童，**网站账号与交易只面向成年人**。

## 二、技术栈与仓库结构

- **前台**：Next.js 16（SSR/ISR 兼顾 SEO）· TypeScript · Tailwind 4
- **后端**：NestJS 12（ESM）· Prisma 6 · PostgreSQL 16 · Redis 7
- **工程**：npm workspaces 单仓 · Docker Compose · GitHub Actions CI

```
wemove-sports-portal/
├─ apps/web/   前台（(storefront) 官网 / customer / dealer / admin 路由组）
├─ apps/api/   后端（common/auth/rbac/audit/catalog/pricing + prisma schema 与 seed）
├─ infra/      docker-compose（PostgreSQL 16 + Redis 7 + Mailpit）
├─ docs/       文档中心（见「文档导航」）
└─ .github/    CI
```

选型理由详见 `docs/adr/0001-architecture-and-stack.md`。

## 三、团队分工（纵向模块 + 横向文档）

| 成员 | 纵向开发模块 | 横向文档 |
|---|---|---|
| 组长（甘文韬） | 架构基座、统一 API 规范、认证双体系、RBAC、审计与安全 | 需求文档、进度计划表、工作量占比表、答辩 PPT |
| 组员 A（陈婧琳） | 前台官网（响应式/首页/PLP/PDP/对比）、B2C 用户中心 | 交互说明、团队例会纪要 |
| 组员 B（朱容杰） | B2B 经销商闭环（申请审批/门户/Quick Order/RFQ/PO） | B2B 流程与状态机规范、个人思政报告 |
| 组员 C（周慧莹） | 商品与变体 SKU、库存扣减、价格引擎、购物车结算、订单状态机 | 数据字典与 API 规格书、答辩 PPT 技术章节 |
| 组员 D（倪依玲） | Admin UI、CMS 与富文本、媒体中心、联系工单、SEO/审计查看 | 系统操作手册、个人思政报告 |
| 组员 E（龙祖怡） | Docker 编排、Seed 数据、接口自动化与压测、越权/兼容测试 | 全套测试报告、个人思政报告 |

## 四、快速开始（本地开发）

前置：Node ≥ 22、Docker Desktop、npm ≥ 10。

```bash
npm ci                              # 1) 按 lockfile 安装全仓依赖
copy apps\api\.env.example apps\api\.env  # 2) Windows；Linux/macOS 用 cp
npm run db:up                       # 3) 启动 PostgreSQL + Redis + Mailpit
npm run prisma:generate             # 4) 生成 Prisma Client
npm run db:deploy                   # 5) 应用仓库中已提交的迁移
npm run db:seed                     # 6) 写入本地演示数据（幂等）
npm run dev                         # 7) 前台 3000 / API 8080
```

验证：浏览器打开 http://localhost:3000；API 存活探针为 http://localhost:8080/api/v1/health/live，就绪探针为 http://localhost:8080/api/v1/health/ready（PostgreSQL 与 Redis 任一不可用时返回 503）。

开发收件箱：http://localhost:8025。演示账号和密码仅用于本地/测试环境，见 seed 与 `.env.example`，严禁部署到生产。

> 更多环境变量说明见 `apps/api/.env.example` 与 `apps/web/.env.example`。

## 五、常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 并行启动 web(3000) + api(8080) |
| `npm run dev:web` / `npm run dev:api` | 单独启动某一端 |
| `npm run build` | 生产构建（web + api） |
| `npm run lint` / `npm run typecheck` / `npm test` | 全仓静态检查 / 类型检查 / 单测 |
| `npm run verify` | Prisma 生成 + lint + typecheck + 单测 + 构建 |
| `npm run db:up` / `db:down` | 启停 PostgreSQL + Redis + Mailpit |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma 迁移 / 种子数据 / 可视化 |
| `npm run prisma:generate` | 生成 Prisma Client（改 schema 后执行） |
| `npm run test:e2e -w api` | API 冒烟 e2e |

## 六、文档导航

| 文档 | 内容 |
|---|---|
| `docs/README.md` | 交付物清单、**课程红线**（思政报告/会议纪要/邮件与压缩包命名规范） |
| `docs/development-conventions.md` | 开发/安全/合规**注意事项**、Git 协作规范（详细约定不写在 README） |
| `docs/onboarding.md` | 新成员上手指南（环境、跑通、首次 PR、FAQ） |
| `docs/requirements.md` | 课程验收口径的需求文档 v0.2（完整愿景与本期范围分离） |
| `docs/plans/project-status.md` | 代码/分支/风险审计与当前真实状态 |
| `docs/plans/schedule-current.md` | 第 8 组当前进度计划与成员任务 |
| `docs/plans/` | 全员首个任务拆解卡、需求文档（④）大纲、PR 评审与事件记录 |
| `docs/drafts/` | 需求文档（④）v0.1 过程稿（协作评审用） |
| `docs/adr/0001-architecture-and-stack.md` | 技术选型与架构决策记录 |
| `docs/templates/` | 例会纪要③ / 进度计划表② / 工作量占比⑧ 模板 |
| `apps/web/README.md` | 前台路由分组与页面负责人 |
| `apps/api/README.md` | API 模块归属、接口一览、工程约定 |
