# WEMOVE SPORTS · 官网与业务门户重构项目

> **目标站点**：https://www.wemovetoy.com ｜ **课程项目**：《软件开发实践2》团队大作业
> 以运动游戏玩具（儿童保龄球套装、平衡板等）为核心的**品牌出海全功能 Web 系统**：
> 品牌官网 + B2C 用户中心 + B2B 经销商门户 + 运营管理后台，四大门户一体化。

## 一、仓库速览

```
wemove-sports-portal/
├─ apps/
│  ├─ web/                  # 前台 Next.js 16（SSR/ISR 兼顾 SEO）
│  │  └─ app/
│  │     ├─ (storefront)/   # 品牌官网：首页 / products(PLP) / products/[slug](PDP) / compare / play-learn / support / contact / search
│  │     ├─ customer/       # B2C 用户中心：login / register / account
│  │     ├─ dealer/         # 经销商门户：apply / login / dashboard
│  │     └─ admin/          # 运营后台：login / dashboard
│  └─ api/                  # 后端 NestJS 12（ESM · 前缀 /api/v1 · Prisma 6）
│     ├─ src/common/        # 统一响应体/错误码/分页/traceId/异常过滤器
│     ├─ src/auth+rbac+audit# 双体系登录(JWT+bcrypt12) / 角色守卫 / 审计
│     ├─ src/pricing/       # ★ 价格引擎纯函数+单测（企业专属价>价格表>等级价>B2B默认）
│     ├─ src/catalog/       # 商品公开只读切片（白名单出参，防底价泄漏）
│     └─ prisma/            # schema.prisma（单一事实源）+ seed（幂等）
├─ infra/                   # docker-compose：PostgreSQL 16 + Redis 7
├─ docs/                    # 架构决策(ADR)/会议纪要模板/交付红线清单
└─ .github/workflows/ci.yml # 基础 CI（lint/单测/构建）
```

**技术选型理由见 [`docs/adr/0001-architecture-and-stack.md`](docs/adr/0001-architecture-and-stack.md)。**

## 二、四大门户与 6 人分工

| 成员 | 纵向开发模块 | 横向交付文档 |
|---|---|---|
| 组长 | 架构基座：统一 API 规范、用户/员工双体系认证、RBAC、审计、安全防护 | 需求文档(整合)、进度计划表、工作量占比表、答辩 PPT 主讲 |
| 组员 A | `apps/web` 前台：响应式布局、首页模块、PLP/PDP/对比、B2C 用户中心 | 交互说明；组织例会并出**规范会议纪要**（禁聊天截图） |
| 组员 B | B2B 闭环：资质申请/审批、Dealer 门户、Quick Order、RFQ、PO | B2B 流程与状态机规范；个人思政报告 |
| 组员 C | 商品/变体 SKU、库存扣减、**价格引擎**、购物车结算、订单状态机 | 数据字典与核心 API 规格书；协助答辩 PPT 技术部分 |
| 组员 D | Admin UI、CMS 富文本、媒体中心(私有签名下载)、联系工单、SEO/审计日志查看 | 系统操作手册；个人思政报告 |
| 组员 E | Docker 编排、Seed 数据、接口自动化与 100 并发压测、越权/断点安全测试 | 全套测试报告；个人思政报告 |

模块与代码目录的对应关系见 `apps/web/README.md`、`apps/api/README.md`。

## 三、快速开始（本地开发）

前置：**Node ≥ 22**、**Docker Desktop**（跑数据库）、npm ≥ 10。首次克隆后请先完成 1→2→3。

```bash
# 1) 安装全仓依赖（npm workspaces 单锁文件）
npm install

# 2) 启动基础设施（PostgreSQL 16 + Redis 7，首次会拉镜像）
npm run db:up

# 3) 初始化数据库（apps/api 目录内生成 .env 后执行；见第 6 行提示）
cd apps/api
copy .env.example .env        # Windows；macOS/Linux: cp .env.example .env
npx prisma migrate dev --name init
npm run prisma:seed           # RBAC 基座 + 演示账号/商品（幂等可重跑）
cd ../..

# 4) 启动开发服务（两个终端，或一条命令并行）
npm run dev:web               # 前台 http://localhost:3000
npm run dev:api               # API  http://localhost:8080/api/v1
# 或： npm run dev  （concurrently 并行跑 web+api）
```

验证：浏览器开 `http://localhost:3000`；API 探活 `http://localhost:8080/api/v1/health/live`。

**演示账号（seed 后）**：`admin@wemove.local / Admin@12345`（后台）、
`customer@wemove.local` 与 `dealer@wemove.local` / `Demo@123456`（前台与经销商）。

### 常用脚本（仓库根）

| 命令 | 作用 |
|---|---|
| `npm run dev` | 并行启动 web(3000)+api(8080) |
| `npm run dev:web` / `dev:api` | 单独启动 |
| `npm run build` | 生产构建 web+api |
| `npm run lint` / `npm test` | 全仓 lint / 单测 |
| `npm run db:up` / `db:down` | 启停 PG+Redis |
| `npm run db:migrate` | Prisma 迁移（`migrate dev`，改 schema 后跑） |
| `npm run db:seed` | 灌入 RBAC/演示数据 |
| `npm run prisma:generate` | 生成 Prisma Client（装完依赖后 CI 亦会跑） |
| `npm run test:e2e -w api` | API e2e（离线冒烟链路） |

## 四、核心设计约定（开发前必读）

1. **API 契约**：统一响应体 `{ code, message, data, traceId }`（code=0 成功）；前端统一走
   `apps/web/lib/api.ts`，禁止散落裸 fetch。错误码分段见 `apps/api/src/common/errors.ts`。
2. **价格引擎（课程核心算法）**：`apps/api/src/pricing/pricing-engine.ts`（纯函数+单测）。
   优先级：企业专属价 → 价格表 → 经销商等级价 → B2B 默认价；**零售只取 MSRP/Sale**。
   经销商数据一律以**企业(companyId)为边界**，公开接口严禁携带底价字段。
3. **认证与越权底线**：C 端/经销商成员（User）与后台员工（Staff）**双体系物理隔离**；
   密码 bcrypt cost=12；JWT 密钥生产必换。游客/零售用户调经销商价接口必须返回 403 语义
   （服务端判定，前端隐藏不算数）。后台敏感操作二次认证与审计留痕为必做项。
4. **响应式硬指标**：手机端抽屉导航 + 单列排版；表格（Quick Order/对比表）禁止横向撑破屏幕
   （移动端改为卡片/纵向布局），关键页面首屏 ≤ 2.5s，支持 100 并发（E 出压测报告）。
5. **合规红线**：产品面向儿童，但**账号与交易只面向成年人**：注册强制 18+ 声明
   （`ageConfirmed`，服务端硬校验）；禁止任何面向儿童的注册/信息收集设计。
6. **TypeScript 质量**：严格模式；DTO 白名单校验（ValidationPipe whitelist）；相对导入
   **apps/api 必须带 `.js` 后缀**（ESM）；函数/模块首注释标注负责人归属。

## 五、Git 协作规范（6 人拉入后生效）

- 分支：`main`（受保护，禁止直推）→ 每人 `feature/<模块>-<英文名>` → PR 合并（≥1 人评审）。
- 提交信息：Conventional Commits（`feat:` `fix:` `docs:` `chore:` `test:` `refactor:`）。
- 改 `schema.prisma` 必须**同 PR 附迁移 SQL**；新依赖需在 PR 描述说明用途。
- CI 在 main/PR 上跑 lint + 单测 + 构建（`.github/workflows/ci.yml`，E 负责扩展 DB 集成段）。

## 六、课程交付红线（易扣分项，务必对照 docs/README.md）

- 成绩：代码 40% 答辩 20% 文档 20% 团队表现 15% 思政 5%。
- **思政报告**：每人 1 份独立文件，共 6 份，禁止共用。
- **沟通记录**：只收**规范会议纪要**（时间/参会人/议题/决议），严禁微信/QQ 截图 ——
  模板在 [`docs/templates/meeting-minutes.md`](docs/templates/meeting-minutes.md)。
- **邮件提交**：`49116044@qq.com`；标题 `软件开发实践2—下午班–06组`（按实改）；
  正文列全部组员姓名（空格分隔）；附件命名 `下午班-06组-姓名1…姓名6.zip`（按实改）。

> 正式文档（需求/进度/测试报告/答辩 PPT）不入库，按 docs/README.md 清单线下归档随邮件提交；
> 仓库内 docs/ 只放过程性与规范材料。

## 七、当前进度与下一步

骨架阶段已完成：monorepo 双应用可构建可单测、统一 API 规范与错误码、双体系认证注册登录、
RBAC 守卫与审计服务、Prisma 核心表（22 张）+ 幂等 seed、价格引擎与单测、目录公开切片、
前台五大路由区（SSR/ISR 示例页）、Docker 编排、CI、会议纪要模板与 ADR。

下一步（例会排期）：
1. 组员 B/D 建立 dealer/cms/media/contact 模块（schema 已留位）；
2. 组员 C 接入购物车/订单/库存扣减与价格规则 CRUD；
3. 组长补邮箱验证真发信、后台二次认证、Redis 限流；
4. 组员 A 完成响应式框架细节与各页面数据接线；
5. 组员 E 补 DB 集成测试/压测/越权用例并完善 CI。
