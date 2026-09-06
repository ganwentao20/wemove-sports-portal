# 项目审计与当前状态

快照日期：2026-09-07　集成分支：`main`

## 结论

组长共享基座、B 的经销商 PR #1/#3/#6、C 的价格规则与购物车 PR #8、E 的测试 PR #5 已按依赖顺序合入 main。重新同步远端后未发现新分支或开放 PR；A 的旧分支仍含偏题页面、大图和 localStorage 会话，因此继续保全但不整体合并。主线已独立补齐安全的 B2C 注册/登录、账户购物车、真实商品目录、搜索和移动导航。上述切片均通过本地全仓验证。D 的 Nest/Next 迁移切片已进入 main，实验原型继续隔离在 `experiments/`。

## 分支与贡献保护

| 责任 | 分支/PR | 审计状态 | 本次处理 |
|---|---|---|---|
| A 陈婧琳 | `origin/feature/storefront-a` | 无新提交/PR；仍有 localStorage JWT、超大原图和偏离运动玩具范围的页面 | 不整体合并；主线已重写真实目录、搜索、移动导航与安全 B2C 会话 |
| B 朱容杰 | PR #1/#3/#6；`feature/dealer-app-b` / `feature/dealer-apply-b` | 后端申请、前端分步申请、审核工作台与授权目录已验证 | 已合入 main；补齐批准后企业/OWNER 事务，并在 #6 整合时移除 localStorage JWT、增加审核 MFA |
| C 周慧莹 | PR #8 / `feature/pricing-crud-c` | 价格规则 CRUD/装配接口与 B2C 购物车已实现；审查发现的用户归属、scope 引用与测试缺口已修复 | 已合入 main；商品/SKU 管理、库存事务与订单仍待后续切片 |
| D 倪依玲 | 已直接进入 main | FastAPI/Python 与 Vue SFC 与现 Nest/Next 架构并存，当前 npm 构建不加载 | 保留源码；移除 `__pycache__`，后续迁移适配 |
| E 龙祖怡 | PR #2；PR #5 / `feature/smoke-e2e-e` | GitHub 均标记 merged；CI/Mailpit、目录 DB 冒烟和压测记录已验证 | 已合入 main |
| 组长 甘文韬 | `refactor/foundation-audit` | 共享安全修复、就绪探针和文档重构 | 已合入 main |

## 质量验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `npm run prisma:generate` | 通过 | Prisma Client 6.19.3 生成成功 |
| `npm run lint` | 通过 | API/Web 工作区无 lint 错误 |
| `npm run typecheck` | 通过 | API/Web TypeScript 检查通过 |
| `npm test` | 通过 | 55 个单元测试通过（含购物车、价格规则、DTO 与审核 MFA 元数据回归测试） |
| `npm run build` | 通过 | Next.js 25 个路由生成成功；NestJS 构建成功 |
| `npm run test:e2e -w api` | 通过（离线部分） | 12 个无数据库 e2e 通过；7 个 DB/Redis 用例按环境门控跳过 |
| DB e2e | GitHub CI 通过 | 本机 Docker Desktop 未运行；PR #1/#3/#5 及合并后的 main 检查均为 success |

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

## 未替组员越界处理的待办

- A：主线已补齐安全会话和目录基础；继续实现地址簿、愿望单及合规的轻量视觉资源，旧分支不得原样覆盖。
- B：申请、审核和授权目录前端已合入；继续实现价格表授权关系、Quick Order、RFQ/PO。
- C：价格规则、购物车 API 与 B2C 购物车 UI 已合入；继续实现商品/SKU 管理、库存事务、结算与订单纵向切片并补测试。
- D：把现有 FastAPI/Vue 实验代码迁移为当前 Next/Nest 可执行切片，禁止继续提交缓存与运行时上传文件。
- E：PR #5 已合并；继续补 Mailpit 邮件闭环、越权用例和可复核性能复测。
- 组长：`main` 已按团队决定开放给 Write 协作者直接推送且无需审核；持续关注主线 CI，结项时依据证据填写工作量比例。

## 已知风险

- `npm audit --omit=dev` 报告的高风险项来自 Prisma CLI 配置依赖链。自动修复建议会改变 Prisma 版本，暂不盲目降级；由 C/E 在官方修复版本上验证后升级。
- 现网 HTTP 可访问，但 HTTPS 在检查日失败；上线验收必须单独覆盖证书、301、混合内容和 SEO 迁移。
- 本机 Docker Desktop 未启动，数据库迁移/e2e 需由 PR CI 或可用 Docker 环境复核。
- 历史远端分支多数已被 main 覆盖；暂不删除，以免在未获团队确认时破坏成员保全记录。
