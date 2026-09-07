# 项目审计与当前状态

> **2026-09-08 当前入口：**功能整合已由 [CI #49](../evidence/ci49/README.md)全流程验证，PR #10 尚未合并；新收材料见[最新审核与完成度](document-review-20260908.md)和[交付清单](../delivery-readiness.md)。下文保留 9 月 7 日各时点审计过程，旧数量及当时未完成功能不代表当前状态。

快照日期：2026-09-07　基线：`main`；本轮：`feature/b2b-takeover`

## 结论

组长共享基座、B 的经销商 PR #1/#3/#6、C 的价格规则与购物车 PR #8、E 的测试 PR #5 已按依赖顺序合入 main。此前基线核查情况如下（本轮远端新提交补充见后文）；A 的旧分支仍含偏题页面、大图和 localStorage 会话，因此继续保全但不整体合并。冻结代码提交 `5c9d5bf` 已补齐商品/SKU/库存后台、B2C 订单库存事务、Quick Order、私有资质、认证邮件页面、公开内容、CMS/媒体/工单后台及 SEO 基础，GitHub Actions CI #40 全部成功。

## 分支与贡献保护

| 责任 | 分支/PR | 审计状态 | 本次处理 |
|---|---|---|---|
| A 陈婧琳 | `origin/feature/storefront-a` | 无新提交/PR；仍有 localStorage JWT、超大原图和偏离运动玩具范围的页面 | 不整体合并；主线已重写真实目录、搜索、移动导航与安全 B2C 会话 |
| 历史 B2B 贡献（原作者朱容杰；后续甘文韬接管） | PR #1/#3/#6；`feature/dealer-app-b` / `feature/dealer-apply-b` | 后端申请、前端分步申请、审核工作台与授权目录已验证 | 已合入 main；补齐批准后企业/OWNER 事务，并在 #6 整合时移除 localStorage JWT、增加审核 MFA |
| C 周慧莹 | PR #8 / `feature/pricing-crud-c` | 价格规则 CRUD/装配接口与 B2C 购物车已实现；审查发现的用户归属、scope 引用与测试缺口已修复 | 已合入 main；主线已继续补齐商品/SKU 管理、库存事务与订单切片 |
| D 倪依玲 | 已直接进入 main | FastAPI/Python 与 Vue SFC 与现 Nest/Next 架构并存，当前 npm 构建不加载 | 保留源码；移除 `__pycache__`，后续迁移适配 |
| E 龙祖怡 | PR #2；PR #5 / `feature/smoke-e2e-e` | GitHub 均标记 merged；CI/Mailpit、目录 DB 冒烟和压测记录已验证 | 已合入 main |
| 组长 甘文韬 | `refactor/foundation-audit` | 共享安全修复、就绪探针和文档重构 | 已合入 main |

## 质量验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `npm run prisma:generate` | 通过 | Prisma Client 6.19.3 生成成功 |
| `npm run lint` | 通过 | API/Web 工作区无 lint 错误 |
| `npm run typecheck` | 通过 | API/Web TypeScript 检查通过 |
| `npm test` | 通过 | 14 文件、69 个单元测试通过（含购物车、价格、私有附件、审核/订单状态机与 Quick Order） |
| `npm run build` | 通过 | Next.js 全部路由生成成功；NestJS 构建成功 |
| `npm run test:e2e -w api` | 通过（离线部分） | 12 个无数据库 e2e 通过；8 个 DB/Redis 用例按环境门控跳过 |
| DB e2e | GitHub CI #40 通过 | PostgreSQL 迁移、Redis 认证、目录与订单库存事务均成功；本机 Docker Desktop 未运行 |

## 已修复问题

1. 未知 500 异常不再把内部错误信息返回客户端。
2. `x-trace-id` 只接受 1–64 位安全字符，避免超长值和日志注入。
3. 登录失败锁定在密码校验前检查，正确密码不能绕过锁定窗口。
4. MFA 只统计失败；第 5 次错误锁定，而 4 次失败后的正确动态码仍可成功并清零。
5. 生产环境启动强制检查数据库、Redis、SMTP、HTTPS 基础地址和强 JWT 密钥。
6. Web 请求头用 `Headers` 合并；GET 不再无条件声明 JSON，FormData 不再被错误覆盖。
7. 全仓脚本移除废弃的 `-ws` 写法，新增 `typecheck` 和 `verify`。
8. 快速开始统一使用 `npm ci`、`db:deploy`，补充 Mailpit；修正课程邮件/压缩包命名。
9. 就绪探针同时验证 PostgreSQL 与 Redis，依赖故障时返回 503；生产 CORS 只接受显式 HTTPS 来源。
10. 经销商申请补齐企业名称/注册号；审核批准在同一事务中创建或批准企业、绑定申请人为 OWNER 并回填 `companyId`。
11. 删除误提交的 4 个 `__pycache__/*.pyc`，新增 Python 缓存忽略规则，D 的源码保持不变。
12. 购物车与登录用户建立非空外键并在删号时级联清理，避免孤儿购物车；查询始终以 JWT `sub` 隔离。
13. 禁用 SKU 不再允许继续修改购物车数量，购物车行按创建时间稳定返回。
14. 价格规则创建先验证 SKU，scope 只保留匹配的企业/价目表/等级引用，切换 scope 时清理旧引用。
15. `active=false` 查询参数按布尔值正确解析，金额、起订量和优先级增加数据库整数上限校验。
16. 经销商与后台登录改为同源 Route Handler：JWT 仅存 HttpOnly、SameSite=Strict Cookie，浏览器脚本不再接触令牌。
17. 受保护请求由服务端注入 Bearer 令牌并校验自定义 CSRF 头；登出同时吊销 JWT 和清除 Cookie。
18. 经销商批准、驳回及补件等审核写操作强制 6 位 MFA，前端工作台已接入动态码。
19. B2C 注册、登录和账户中心已接入真实 API；客户 JWT 使用独立 HttpOnly Cookie，会话与经销商/员工物理区分。
20. 首页、商品列表、分类筛选、搜索和商品详情移除 Mock，改为服务端读取公开目录 API并在依赖故障时显式降级。
21. 商品详情可选 SKU 与数量并加入本人购物车；账户中心支持查看、改数量、移除、清空和安全登出。
22. 移动端导航由空占位改为可键盘访问的原生折叠菜单。
23. 商品/分类/SKU/库存后台管理接入 Next/Nest，敏感写操作强制 MFA 并审计。
24. 结算保存整数分订单快照；事务内锁定购物车并条件扣减库存，取消/履约按状态机处理 reservation。
25. 客户账户增加订单列表/取消，后台增加订单履约工作台；DB e2e 覆盖结算—锁库—取消—返库。
26. Quick Order 支持最多 100 行 SKU，逐行返回重复、未授权、无价格和库存不足错误。
27. 补齐邮箱验证/重发、忘记/重置密码页面并修复邮件链接落点。
28. 联系表单真正写库；CMS 公共接口不再泄漏草稿；媒体上传限制为 5 MB 且 MIME/扩展名双检。
29. 新增 CMS、媒体、联系工单 Next 后台，写操作 MFA+审计；新增动态 sitemap 与基础永久重定向。
30. 支持中心接入 PUBLIC 媒体与已发布 FAQ；PDP 展示图集、SKU 属性、适龄提示与资料链接。
31. 产品对比最多 4 款，Play & Learn 读取已发布 CMS 文章，后台 Dashboard 改为实时统计与工作台入口。
32. 经销商资质改为 PDF/JPG/PNG、5 MB 私有上传，校验媒体元数据和上传凭据，后台以 5 分钟签名链接查看。

## 按五人方案继续推进的任务

- A：主线已补齐安全认证、目录、PDP、对比、Play & Learn、购物车和订单；继续提交地址簿、愿望单及经授权的轻量视觉资源，旧分支不得原样覆盖。
- 甘文韬（M1/MB）：本轮完成 PriceBook 企业授权、RFQ 版本和 PO 快照/库存事务；详见 ADR-0002 与 B2B 规范。C 继续复核商品价格契约及其新数据字典分支。
- D：当前 Next/Nest CMS、媒体与工单切片已可构建；需在冻结版本复核并向操作手册补实际截图。
- E：CI #40 已覆盖最新迁移与订单库存 DB e2e；继续补 Mailpit 邮件闭环、混合负载、浏览器兼容与可复核截图。
- 全员：上传五份独立技术现状/思政报告、正式会议纪要和 PPT 内容，并在例会上确认工作量比例。
- 组长：`main` 已按团队决定开放给 Write 协作者直接推送且无需审核；持续关注主线 CI，结项时依据证据填写工作量比例。

## 已知风险

- `npm audit --omit=dev` 报告的高风险项来自 Prisma CLI 配置依赖链。自动修复建议会改变 Prisma 版本，暂不盲目降级；由 C/E 在官方修复版本上验证后升级。
- 现网 HTTP 可访问，但 HTTPS 在检查日失败；上线验收必须单独覆盖证书、301、混合内容和 SEO 迁移。
- 本轮用户已启动 Docker；PostgreSQL/Redis 本地测试结果见 test-report.md，既有 CI #40 仅代表旧基线。
- 历史远端分支多数已被 main 覆盖；暂不删除，以免在未获团队确认时破坏成员保全记录。

## 2026-09-07 承接增量

当前团队五人，甘文韬负责 M1/MB 两个工作包，计划占比 25%，其余四人各 18.75%。历史作者保留在上表，现分工以 workload-current.md 为准。远端 `feature/storefront-a` 更新至 d650274，新增 `feature/data-dictionary-c`；此次保留两分支，尚未合并。新 B2B 功能、迁移和 13 项真实数据库用例已完成；完整验证记录见 test-report.md。

本轮继续完成 M1 邮件验证增量：修复一次性验证/重置令牌的并发重复消费，以及旧验证链接激活停用账号；补齐纯文本邮件链接，新增 5 项数据库安全回归和 4 项真实 Mailpit 收信测试。全量结果更新为 69 单测、42 项 e2e 全通过，Next/Nest 构建通过；CI 新增 Mailpit service。上文 CI #40 为旧主线记录，当前分支的最新证据见测试报告第 11 节。答辩继续暂缓。
