# 新成员上手指南（docs/onboarding.md）

> 目标：**30 分钟内**装好环境、跑通前后台、完成第一次提交。有问题先查本文「常见坑」，再找组长。

## 一、前置环境安装（一次性）

| 软件 | 版本 | 用途 | 校验命令 |
|---|---|---|---|
| Node.js | ≥ 22（推荐 24 LTS） | 全栈运行 | `node -v` |
| npm | ≥ 10（随 Node 自带） | 依赖安装 | `npm -v` |
| Docker Desktop | 最新稳定版 | PostgreSQL/Redis（Windows 需启动 WSL2 后端） | `docker info` |
| Git | ≥ 2.40 | 版本管理 | `git --version` |
| VS Code（建议） | 最新 | 编辑器 | 建议装 Prettier 扩展 |

网络提示：若直连 GitHub 慢/失败，可为本仓库配置代理后重试：
```bash
git config --local http.proxy http://127.0.0.1:7897   # 以本机代理端口为准，不必须
```

## 二、克隆与跑通（10 分钟）

```bash
git clone https://github.com/ganwentao20/wemove-sports-portal.git
cd wemove-sports-portal

npm install          # 全仓依赖（在仓库根执行一次即可）
npm run db:up        # 启动 PostgreSQL + Redis（首次拉镜像较慢）
docker ps            # 应看到 wemove-postgres / wemove-redis 均 healthy

cd apps/api
copy .env.example .env    # Windows；macOS/Linux: cp .env.example .env
npx prisma migrate dev --name init
npm run prisma:seed       # RBAC + 演示账号 + 演示商品（幂等）
cd ../..

npm run dev               # 并行启动 web(3000) + api(8080)
```

验证：
- 前台 http://localhost:3000（首页 → Products → 任一商品详情）
- API 探活 http://localhost:8080/api/v1/health/live → `{"code":0,...}`

演示账号：`admin@wemove.local / Admin@12345`（后台）；`customer@wemove.local`、`dealer@wemove.local`（密码 `Demo@123456`）。

> 只写前端时 API 可以不开？不行 —— 页面数据走代理 `/api/v1`，请保持 `npm run dev` 两个进程都起。

## 三、仓库地图：谁改哪里（避免冲突）

| 区域 | 内容 | 主要负责人 |
|---|---|---|
| `apps/web/app/(storefront)/*` | 官网页面（首页/PLP/PDP/对比/Play&Learn/Support/Contact/Search） | A |
| `apps/web/app/customer/*` | B2C 用户中心 | A |
| `apps/web/app/dealer/*` | 经销商门户 | B |
| `apps/web/app/admin/*` | 运营后台 | D |
| `apps/api/src/auth|rbac|audit|common|prisma` | 基座（改前先与组长打招呼） | 组长 |
| `apps/api/src/pricing` | 价格引擎 | C |
| `apps/api/src/catalog` | 商品目录切片 | C |
| `apps/api/src/dealer`（待建） | B2B | B |
| `apps/api/src/cms|media|contact`（待建） | 内容/媒体/工单 | D |
| `apps/api/src/order|cart`（待建） | 购物车/订单 | C |
| `apps/api/prisma/schema.prisma` | 数据表（**改必开会**，迁移随 PR 提交） | 组长统筹 |
| `infra/`、`.github/`、`docs/` | 工程与文档 | E / 组长 |
| `prisma/seed.ts`、测试与压测 | 测试数据与质量 | E |

**平行开发规则**：默认只在自己区域改；要动别人的目录先在该 Issue/PR 里 @ 对方；schema 改动走例会决议。

## 四、第一次提交（走完整流程）

```bash
git switch -c feature/<模块>-<你的英文名>   # 例：feature/dealer-ming
# …开发与本地验证（typecheck / lint / test 见根 README）…
git add -A && git commit -m "feat(dealer): 新增经销商申请 API"
git push -u origin feature/dealer-ming
```
1. 到 GitHub 仓库点 **Compare & pull request**（用 PR 模板填写）；
2. 等 **CI 绿** + ≥1 人评审后合并；main 已受保护，**不要直推 main**。

## 五、常见坑（FAQ）

| 现象 | 原因与解法 |
|---|---|
| `npm install` 报 EPERM | 关掉杀毒实时扫描/重试；勿在 node_modules 安装中开 IDE 索引 |
| `docker` 命令连不上 | Docker Desktop 未启动；启动后等右下角变绿 |
| `prisma migrate` 连接失败 | `apps/api/.env` 没建或数据库没起：`npm run db:up` |
| `dev` 起 api 报 8080 被占用 | `netstat -ano | findstr 8080` 找到进程结束，或改 `apps/api/.env` PORT |
| 前端页面能开但数据是 mock | 页面尚未接线 API（见页面注释中的负责人） |
| TS 报 `Cannot find module './x.js'` | api 是 ESM：**导入必须写 `.js` 后缀**，哪怕源文件是 `.ts` |
| 改了 schema 但 Prisma Client 类型没变 | 根目录执行 `npm run prisma:generate`（或跑一次迁移） |
| 不知道某接口返回什么 | 看 `apps/api/README.md` API 一览 + 统一响应体约定 |
| 想加第三方依赖 | 根目录 `npm i -w <web|api> 包名`，PR 里说明用途 |
| 金额/价格 | 一律整数"分"（`*Cents`），别用浮点 |

## 六、红线速记（完整见 docs/README.md 与 docs/development-conventions.md）

1. 账号/交易只面向成年人；接口与页面禁止儿童注册与信息收集。
2. 公共接口绝不返回经销商底价；测试越权时服务端必须 403 语义。
3. 聊天截图 ≠ 沟通记录（例会纪要由 A 统一出）。
4. 每位成员最终需**独立**提交 1 份《Web 开发技术现状报告》（课程思政 5%）。
