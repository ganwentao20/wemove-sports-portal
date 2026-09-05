# 全员首个任务拆解卡（docs/plans/initial-tasks.md）

> 用法：组长在 GitHub 建 Issues 时，按下文逐条粘贴（标题+描述+标签+指派人），
> 成员各自领卡开工。验收标准已写入卡片 —— 例会#1 逐条过一遍即可认领。
> Issue 模板见 `.github/ISSUE_TEMPLATE/feature.md`。

## 组员 A（陈婧琳）— 前台

**任务 A1（首个 PR）**：前台响应式框架细化
- 范围：`apps/web/components/site-header.tsx`、`(storefront)/layout.tsx` 等
- 内容：移动端汉堡按钮 + 抽屉导航（硬指标：无横向溢出）；Header 语言/货币切换占位收起
- 验收：手机宽度(375px)下菜单可开合、页面无横向滚动；桌面布局不变
- 分支：`feature/storefront-nav-a`；标签：`frontend`

**任务 A2**：PLP 接真实 API（替换 mock → `/products`，含筛选分类/搜索状态管理）

## 组员 B（朱容杰）— B2B

**任务 B1（首个 PR）**：`dealer` 后端模块骨架 + 资质申请接口
- 范围：`apps/api/src/dealer/**`（新建）、schema 复用 `DealerApplication`
- 内容：`POST /api/v1/dealer/applications`（分步表单各字段 + attachments JSON）、
  `GET /api/v1/dealer/applications/:id`（仅本人/企业可见）；防刷占位（限流由组长接 Redis）
- 验收：注册流程冒烟通过；越权测试：他人/游客取不到他人申请（403/404 语义）；lint/typecheck 绿
- 分支：`feature/dealer-app-b`；标签：`b2b`

**任务 B2**：`dealer/apply` 前端页接真 API + 提交成功页

## 组员 C（周慧莹）— 商品与价格

**任务 C1（首个 PR）**：价格规则 CRUD（后台用，接价格引擎）
- 范围：`apps/api/src/pricing/` 扩展 + Admin 侧接口
- 内容：`GET/POST /api/v1/admin/pricing-rules`（RolesGuard 保护，仅 staff）、
  引擎装配：从 `PricingRule` 表取候选规则 → `PricingEngine.dealer()` 出价（含企业/等级/阶梯参数）
- 验收：seed 的 Gold 规则可查可改；普通用户调 admin 接口 403；引擎 10 单测保持绿
- 分支：`feature/pricing-crud-c`；标签：`backend`

**任务 C2**：购物车模块（B2C：加购/改量/清空，变体维度）

## 组员 D（倪依玲）— 后台 CMS/媒体

**任务 D1（首个 PR）**：`cms` + `media` 模块骨架 + Admin 媒体上传
- 范围：`apps/api/src/cms/**`、`apps/api/src/media/**`（新建）
- 内容：媒体上传接口（本地盘/对象存储抽象，存 `MediaAsset`；`visibility` 枚举）；
  Admin 页接上传组件（RolesGuard 保护）
- 验收：公开媒体 GET 可看；`INTERNAL/DEALER_ONLY` 文件无签名 URL 不可直接下载（越权点）；
  lint/typecheck 绿
- 分支：`feature/media-cms-d`；标签：`admin`

**任务 D2**：CmsPage CRUD + 首页 sections JSON 编辑（拖拽后续）

## 组员 E（龙祖怡）— 工程与质量

**任务 E1（首个 PR）**：开发信箱容器 + CI 补强
- 范围：`infra/docker-compose.yml`、`.github/workflows/ci.yml`
- 内容：compose 增加 `mailpit`（收开发邮件，供组长/全员联调邮箱验证）；
  CI 增加：启动 postgres 服务 + `prisma migrate deploy` + 跑 DB 集成用例（先 1 条注册闭环）
- 验收：`npm run dev:api` 下注册触发验证邮件出现在 http://localhost:8025；CI 全绿
- 分支：`feature/ci-mailpit-e`；标签：`engineering`

**任务 E2**：接口冒烟脚本集（supertest：auth/catalog 主链路）+ 首版压测准备

## 组长（甘文韬）任务队列

| 优先级 | 任务 | 对应 |
|---|---|---|
| ✅ 完成 | 邮箱验证/找回密码闭环（verify-email/resend/forgot/reset + EmailService SMTP 抽象） | 真发信待 E1 mailpit 落地后配置 SMTP_HOST 联调 |
| ✅ 完成 | Redis 接入：登录限流 + JWT 登出黑名单（自愈降级） | 安全/性能硬指标 |
| P1 | Staff CRUD + 角色分配 API（供 D 的后台员工页） | RBAC 完整化 |
| P1 | 后台敏感操作 TOTP 二次认证 + 审计埋点补全 | 安全红线 |
| P2 | 审计查询 API + 后台日志页数据源 | D 页面依赖 |
| 持续 | ④需求文档整合、②进度表维护、⑧占比表、PPT 大纲 | 交付红线 |

## 例会#1 建议议程（40 分钟）

1. 组长演示仓库跑通 + 分工地图（docs/onboarding.md）— 10min
2. 逐人认领首个任务卡（上表），确认分支名与期限 — 10min
3. 规则答疑：PR 流程/CI/红线（docs/development-conventions.md）— 10min
4. 决议记录（A 出纪要模板） + 约例会#2 — 10min
