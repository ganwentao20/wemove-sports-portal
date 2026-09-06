# 项目审计与当前状态

快照日期：2026-09-06　分支：`refactor/foundation-audit`

## 结论

仓库主干可安装、lint、测试和构建，但产品需求文档曾把长期愿景与当前实现混写，快速开始命令也落后于已提交迁移。此次重构只修改组长负责的共享基座和文档；A–E 的远端分支、PR 与 WIP 均原样保留。

## 分支与贡献保护

| 责任 | 分支/PR | 审计状态 | 本次处理 |
|---|---|---|---|
| A 陈婧琳 | `origin/feature/storefront-a` | 有较完整前台页面改动，尚未进入 main | 不覆盖，后续单独评审/合并 |
| B 朱容杰 | PR #1 / `feature/dealer-app-b` | PR 开放，已含一次 P0 修复 | 不覆盖，等待 CI/评审 |
| C 周慧莹 | `origin/feature/pricing-crud-c` | 相对 main 仅见 lockfile 变化 | 不代写其业务模块，需继续提交 C1 |
| D 倪依玲 | `origin/wip/member-d-python-cms` | WIP 保留；对应旧改动未进入当前 main | 不删除、不改写；需按现架构重新评审 |
| E 龙祖怡 | PR #2 / `feature/ci-mailpit-e` | 已合入 main：CI 与 Mailpit | 不修改其工作流/Compose |
| 组长 甘文韬 | 本分支 | 共享代码安全修复、文档重构 | 独立分支提交，PR 合入 |

## 质量验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `npm run prisma:generate` | 通过 | Prisma Client 6.19.3 生成成功 |
| `npm run lint` | 通过 | API/Web 工作区无 lint 错误 |
| `npm run typecheck` | 通过 | API/Web TypeScript 检查通过 |
| `npm test` | 通过 | 25 个单元测试通过 |
| `npm run build` | 通过 | Next.js 22 个静态路由生成成功；NestJS 构建成功 |
| `npm run test:e2e -w api` | 通过（离线部分） | 12 个无数据库 e2e 通过；2 个 DB/Redis 用例按环境门控跳过 |
| DB e2e | 本机未执行 | Docker Desktop 服务未运行；CI 已配置 PostgreSQL/Redis 环境，应由 PR CI 复核 |

## 已修复问题

1. 未知 500 异常不再把内部错误信息返回客户端。
2. `x-trace-id` 只接受 1–64 位安全字符，避免超长值和日志注入。
3. 登录失败锁定在密码校验前检查，正确密码不能绕过锁定窗口。
4. MFA 只统计失败；第 5 次错误锁定，而 4 次失败后的正确动态码仍可成功并清零。
5. 生产环境启动强制检查数据库、Redis、SMTP、HTTPS 基础地址和强 JWT 密钥。
6. Web 请求头用 `Headers` 合并；GET 不再无条件声明 JSON，FormData 不再被错误覆盖。
7. 全仓脚本移除废弃的 `-ws` 写法，新增 `typecheck` 和 `verify`。
8. 快速开始统一使用 `npm ci`、`db:deploy`，补充 Mailpit；修正课程邮件/压缩包命名。

## 未替组员越界处理的待办

- A：评审 storefront 的响应式、可访问性和 API 接线后合并。
- B：完成 PR #1 的 CI、权限边界与状态机评审。
- C：实现商品/SKU CRUD、迁移、价格/库存/订单纵向切片并补测试。
- D：在当前 Next/Nest 架构内提交 Admin/CMS 切片，避免直接引入第二套后端。
- E：补测试报告、Mailpit 邮件闭环、越权用例和可复核性能测试。
- 组长：在仓库设置中确认 `main` 分支保护；结项时依据证据填写工作量比例。

## 已知风险

- `npm audit --omit=dev` 报告的高风险项来自 Prisma CLI 配置依赖链。自动修复建议会改变 Prisma 版本，暂不盲目降级；由 C/E 在官方修复版本上验证后升级。
- 现网 HTTP 可访问，但 HTTPS 在检查日失败；上线验收必须单独覆盖证书、301、混合内容和 SEO 迁移。
- 本机 Docker Desktop 未启动，数据库迁移/e2e 需由 PR CI 或可用 Docker 环境复核。
