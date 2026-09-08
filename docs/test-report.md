# WEMOVE SPORTS 系统测试报告

版本：v0.7。日期：2026-09-08。甘文韬组织全项目整合复核，龙祖怡的阶段测试材料另行保留。本报告记录整合测试、本机账号检查和负载实测，结论与被测提交、运行环境及原始证据对应。

## 1 最终整合验证

[CI #54](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34159152642) 已对提交 `f3c074f0d4e7ad75761fd31f5a9de62d9a5db941` 的整合代码树验证通过，包含 main `5642da2`。其单元、集成及浏览器与性能检查分别为 110、169、70 项通过，生产启动、扫描和恢复检查也通过。CI 整合检出为 `d79a2ebe69d68effbe38f9676a752f5daee325af`，代码树为 `ab1038af39980031ac8d6649a7dc02e27940a60e`，mainIncluded 与 sourceAndCheckoutTreesMatch 均为 true。

下表保留 [CI #51](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34156780782) 的归档基线，第 4 节页面性能数据也来自该次运行。后续 CI 通过不会改变旧样本的来源，开发分支 CI #44 不作为最终整合结论。

| 追溯项 | 记录 |
| --- | --- |
| 功能源码 | `4fe216999760763d953c33d6ff519f355c90c20d` |
| 已包含 main | `5642da28542373bbe747dd941b8c0394a5b8c4ed` |
| CI 整合检出 | `e4fb9cfb03834710c37f2ecda9595daddfae19eb` |
| 同一代码树 | `a7be7641c3ffebde2fd748363c17a28e52fee85a` |
| 一致性检查 | mainIncluded 和 sourceAndCheckoutTreesMatch 均为 true |
| 后续复核 | CI #54 已验证上述 f3c074f 提交；本表和第 4 节保留 CI #51 原始记录 |

| 检查层 | 结果 |
| --- | --- |
| 单元测试 | 24 个文件、110 个用例通过 |
| 数据库、HTTP、Redis、Mailpit | 21 个文件、169 个用例通过，无跳过 |
| 浏览器与性能 | Chromium、Firefox、WebKit 各 23 个场景，加 1 个性能任务，共 70 项通过 |
| 安装与工程 | 干净依赖安装、类型、lint、生产依赖审计、API/Web 构建通过 |
| 数据与生产运行 | 29 次迁移、生产镜像、Web/同源代理/鉴权、62 张物理表与媒体样本恢复通过 |
| 扫描与恢复 | 真实 ClamAV clean/EICAR/401/503 和 WAL 时间点恢复通过 |

61 个 Prisma 业务模型与包含迁移管理表的 62 张物理表不是同一计数口径。各测试层的用例数也不能相加称为独立需求覆盖率。完整 [CI #51 artifact](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34156780782/artifacts/10031444671) 包含原始运行结果；核心 JSON 已存入仓库 `docs/evidence/report-20260908`，文件哈希见该目录 manifest.json。

## 2. 测试环境与账号密码

CI 使用 Ubuntu runner、Node 22、锁文件依赖、PostgreSQL 16、Redis 7、Mailpit，以及生产 Web 构建。浏览器使用 `https://127.0.0.1:3443` 测试代理，保留 Secure/HttpOnly/SameSite 会话。测试上下文接受本机短期自签证书，不能将其作为公网正式 TLS。

本机检查环境为 Windows、Intel Core i9-14900HX、32 逻辑处理器、16 GiB 内存、Node v24.14.0，API 8080、Web 3000、HTTPS 3443。新建独立数据库 `wemove_demo_20260908`，29 次迁移和 seed 成功；Redis 使用本地逻辑库 14，SMTP 指向本地 Mailpit。不是正式客户数据或生产服务。

| 测试角色 | 用户名 | 密码 | 登录入口 |
| --- | --- | --- | --- |
| 消费者 | customer@wemove.local | Demo@123456 | /customer/login |
| 经销商（BUYER） | dealer@wemove.local | Demo@123456 | /dealer/login |
| 超级管理员 | admin@wemove.local | Admin@12345 | /admin/login |

以上为新库 seed 默认测试凭据，已按用户要求明确列出。消费者和经销商登录、管理员密码进入 MFA challenge 已在本机实际核对。管理员仍需首次绑定验证器，并在登录和敏感操作输入当前六位动态码；不能用固定验证码代替 MFA。旧库重新 seed 不重置已有密码。上述凭据不用于生产。

## 3. 主要用例与实际预期

以下是报告中的可读用例索引，完整参数和断言保留在 `apps/api/test`、`tests/browser` 与相应源文件单测中；每项均可由 CI #51 对应套件追溯。

| 用例/套件 | 操作与检查点 | 预期与结果 |
| --- | --- | --- |
| auth / identity | 注册、验证/重置令牌重复使用、停用后重试 | 成年声明校验；一次性令牌不能重放；通过 |
| identity / MFA | 员工仅提交密码；再完成动态码；角色撤权 | 密码只产生 challenge；MFA 后有会话，撤权立即生效；通过 |
| catalog / pricing | 不同市场与角色查询商品/价格 | 公开零售价可见，企业内部价不泄露；通过 |
| cart / retail-commerce | 游客购物车合并、数量变更、结算 | 合并幂等，服务端重核价格、库存、税运；通过 |
| order / refund | 重复支付回调、错金额退款、取消/售后 | 付款与退款身份及币种匹配，库存和流水不重复处理；通过 |
| return-evidence | 本人/他人访问私有退货图片 | 业务归属鉴权，越权拒绝；通过 |
| dealer-lifecycle | 申请、企业批准、条款、成员停用 | 企业状态和当前成员身份约束访问；通过 |
| b2b-flow | CSV 错误行、MOQ、报价版本/到期、重复转 PO | 逐行错误；仅最新有效报价转单，重复请求幂等；通过 |
| b2b-after-sales | 分批履约、退货与部分/全额退款 | 保留状态、数量、金额和审计约束；通过 |
| media-lifecycle | MIME/大小/扫描/权限、版本与引用删除 | 非法上传和越权下载拒绝，有引用资源不能错误删除；通过 |
| platform / content-navigation | 未来/禁用内容、手动文章集合、多语 SEO | 未发布内容隐藏，所选内容和元信息一致；通过 |
| contact / notifications | 表单反垃圾、工单流转、通知 outbox | 输入校验、受控流转、通知持久化；通过 |
| 浏览器业务 | 消费者购买、经销商 CSV→RFQ→PO、MFA 后台、授权 PDF | 三引擎实际业务路径通过 |
| 页面与无障碍 | 六种宽度、axe critical/serious、键盘链接、减少动态效果 | 无横向溢出；指定级别自动扫描无问题；通过 |

本机初轮出现文章链接朗读名称变化导致旧断言失败；已为集合卡片设置清晰的名称，随后 Chromium/WebKit 相关 4 项复测通过，CI #51 全部 70 项通过。本机 Firefox 的 spawn UNKNOWN 是启动环境失败，未记为本机浏览器通过；Linux CI 的 Firefox 独立通过。页面截图仅证明所展示界面，不能替代未拍到的业务动作证据。

## 4. 页面性能（CI #51）

生产构建、Chromium、Lighthouse 移动模拟；每模板三次冷浏览器采样，LCP/TBT 取中位数，CLS 取最差值。下表来自同次 artifact 的原始 summary，不是 API 请求时间。

| 模板 | LCP 中位数 ms | CLS | TBT 中位数 ms |
| --- | ---: | ---: | ---: |
| home | 1567 | 0 | 49.0 |
| products | 2350 | 0 | 60.5 |
| product | 2419 | 0 | 51.0 |
| article | 2260 | 0 | 48.5 |

四模板均满足本轮 LCP < 2500 ms、CLS ≤ 0.1 的实验室门槛。API 五条路径各 30 样本、5 并发的 P95 回归也通过；这与下面的 100 用户负载分开记录，不能换算成真实用户 INP 或公网 SLA。

## 5 本机 100 用户负载实测

脚本：`scripts/load-acceptance.mjs`。只允许本机地址，运行 `node scripts/load-acceptance.mjs public` 或 `node scripts/load-acceptance.mjs mixed`。100 个虚拟用户，每用户每秒一请求，共 60 轮；首批从 0 秒开始，最后一批在第 59 秒，因此实际响应完成时长如下。每轮同步发起，等待完整响应体计时；升序第 ceil(n×0.95) 项为 P95。未关闭或提高默认限流。

| 场景 | 请求数 | 实际时长 s | P95 ms | 错误率 / 429 |
| --- | ---: | ---: | ---: | --- |
| 100 用户公开浏览 | 6000 | 59.10 | 118.67 | 0% / 0 |
| 90 访客＋10 已登录用户 | 6000 | 59.11 | 110.21 | 0% / 0 |

公开场景轮换列表、详情、搜索、文章和站点配置。混合场景事先实际登录 10 次，使用同一 seed 客户的 10 个独立会话；5400 个公开请求、600 个 `/auth/me` 请求全部返回 200，已登录组 P95 为 123.09 ms。登录准备不计入负载计时，不能把它写成“每十次请求重新提交一次密码”的密码哈希压测。

该结果支持给定数据与约 100 请求/秒节奏下的本机 100 用户访问。它不是无等待的满速连接压测、长时间浸泡测试、真实百个不同账户或生产容量承诺。默认登录单 IP 每分钟 30 次限制仍保留；高频重复登录出现 429 应单列为防护结果。原始逐请求时延、状态码、环境及时间已归档。

## 6 账号与课程材料

测试用户名、密码见第 2 节。组长确认的工作量占比为：甘文韬 25%，陈婧琳、周慧莹、倪依玲、龙祖怡各 18.75%，合计 100%；课程提交采用此比例，不按实际工时重新折算。

操作手册包含七张实际页面截图、登录与 MFA 说明。个人技术现状与课程思政报告已有 5/5，本次补入[周慧莹报告](individual-reports/周慧莹.md)；五份个人 AI 说明和团队汇总齐备。

## 7. 尚不能宣称完成的验收

正式支付/退款和银行到账需要真实商户、密钥与具体协议联调；物流、ERP、正式税务票据需要供应商接口与业务确认。正式域名、外部 SMTP、CDN、授权商品素材、旧站全量迁移和异地切流需要对应资源。真机与完整人工无障碍、真实流量指标、月度可用率需实际设备和持续运行周期。课程演示使用测试账号、种子数据和 DEMO 支付，不冒充已上线经营。

原始历史报告 v0.2/v0.6、CI #49 证据及成员贡献记录保留原版本，不把旧数字移植到新提交。源码尚在 PR #10 草稿分支；是否合入 main 与整合代码树通过测试是两件不同的事实。

## 历史归档（v0.6 原记录）

<details>
<summary>展开原始 v0.6 与更早阶段记录</summary>

# WEMOVE SPORTS 系统测试报告（v0.6 · 最终整合证据）

版本：v0.6　归档日期：2026-09-08（Asia/Shanghai）。原测试材料编写人：龙祖怡（组员 E）；本次为团队最终整合证据复核，不据此改写成员本人实际贡献或代签验收。本次仅审阅已有报告、源码及 CI 记录，没有重新运行测试或压测。

## 1. 最终结论及版本边界

[GitHub Actions CI #49](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34147768469) 整体结论为 **success**。已逐项读取该次 `check (22)` 的步骤和原始日志：24 文件 **110 个单测**、21 文件 **169 个数据库/HTTP/邮件用例**、三浏览器引擎及性能任务合计 **67 个 Playwright 用例**通过；29 次迁移、类型检查、lint、API/Web 构建、生产依赖审计、生产容器运行和恢复演练均成功。以上属于不同测试层，不相加称为独立需求覆盖数或“100% 覆盖”。

该结论适用于下列已整合代码树，不沿用开发分支 CI #44、旧 CI #40 或整体失败的 CI #47。后续代码变更仍须对应新提交验证；通过 PR 整合检出不等于 PR 已合入 main 或生产已上线。

| 追溯项 | CI #49 记录 |
| --- | --- |
| 源码 head | `0d33eef8a8d1bdd78be20c6977c2f6b1f179aee8` |
| 已整合的 main 提交 | `5642da28542373bbe747dd941b8c0394a5b8c4ed` |
| PR #10 的 CI 整合检出 | `d35819d2614a43aa06c24a338576821955ecb09c` |
| 实测 tree | `9c5e9dbd57f722e5471e013d90db70b1ffabf99d` |
| 一致性检查 | `mainIncluded=true`、`sourceAndCheckoutTreesMatch=true` |
| 证据时间 | 日志为 2026-09-07 17:29–17:38 UTC，即北京时间 2026-09-08 01:29–01:38 |

映射见 artifact 的 `.local/acceptance-revision.json`。完整 [CI #49 artifact](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34147768469/artifacts/10028492738) 名称为 `integrated-acceptance-d35819d2614a43aa06c24a338576821955ecb09c`。核心 JSON、四模板 Lighthouse 原始结果及三张页面截图已按原字节保存至[仓库证据目录](evidence/ci49/README.md)，附源路径和 SHA-256 清单，可在 Actions artifact 到期后复核。它们是 CI 下载证据，不是本次文档归档新运行的结果。

## 2. 最终测试环境及自动化结果

CI 使用 Ubuntu 24.04 runner、Node 22.23.2、`npm ci` 安装的仓库锁定依赖；Next.js 16.3.4、NestJS 12、Vitest 4.1.11。数据库/缓存/邮件服务为 PostgreSQL 16、Redis 7、Mailpit。CI 的 Redis URL 使用逻辑库 0；此前 Windows 独立测试库、Redis 3 或 14 的记录均属于各自历史运行，不能写成 CI 环境。

浏览器入口使用测试专用 `https://127.0.0.1:3443`，代理到 Web 3000；API 为 8080，业务 API 统一前缀 `/api/v1`。测试上下文允许临时自签证书，生产 `Secure`、`HttpOnly`、`SameSite=Strict` 会话 Cookie 保持不变。修复 HTTP 下 WebKit 拒收 Secure Cookie 的测试环境问题，不以伪造会话绕过真实登录。

| CI #49 检查 | 最终结果 | 可复核证据 |
| --- | --- | --- |
| 依赖安装、Prisma Client、类型、lint | 全部通过 | job `101823414708` 对应步骤 |
| 生产依赖审计 | `npm audit --omit=dev --audit-level=high` 成功，日志为 0 漏洞 | 同次 job；不等于不存在未知漏洞 |
| 单测 | 24 文件、110 用例通过 | `Unit tests` 原始日志 |
| 空库迁移 | 29 次迁移应用成功 | `Apply database migrations` |
| DB/HTTP/Mailpit | 21 文件、169 用例通过，无跳过 | `E2E tests with PostgreSQL, Redis and Mailpit`；不是旧 19、42 或 168 项 |
| API/Web 生产构建 | 均通过 | Next 生成阶段 48/48 完成并输出实际路由表；这个数字不是业务页面总数 |
| 浏览器、无障碍及性能任务 | 67/67 通过：Chromium、Firefox、WebKit 各 22 个业务/界面场景，加 1 个性能任务 | `Browser and accessibility acceptance`、`playwright-report/` |
| 生产包装 | API、migrate、Web、Postgres、scanner 镜像构建及 Caddy/Prometheus 配置检查通过 | `Validate production packaging` |
| 真实隔离运行与恢复 | 29 迁移；API ready、Web、同源代理成功；未登录私有代理 401 | `.local/ops-runtime-report.json` 的 `passed=true` |
| DB/媒体恢复 | 独立数据库 62 表逐表行数核对；4096 字节随机媒体样本字节核对；应用恢复健康 | runtime 报告 `fullBackupRestore`；不是生产真实媒体全量验收 |
| 病毒引擎/PITR | 真实 ClamAV clean/EICAR/未授权 401/引擎停机 503；WAL 恢复保留目标前标记、不保留目标后标记 | `.local/ops-scanner-report.json`、`.local/ops-pitr-report.json` 均通过 |

单独 `.local/ops-restore-report.json` 只验证数据库（`mediaRestored=false`）；媒体恢复证据来自随后 runtime 报告。不得把两个报告的范围互相替换。

## 3. 当前功能、角色和安全口径

下列“通过”指 CI #49 中相应自动化回归通过，不代表所有职能账号已经人工逐按钮签字。

| 场景 | 当前行为与安全边界 | 主要回归 |
| --- | --- | --- |
| 注册、验证、密码与会话 | 年龄/协议校验；验证和重置令牌哈希存储、一次性及并发消费；停用用户不可借旧链接激活；真实 SMTP 邮件闭环 | auth-flow、auth-token、auth-mail、identity-flow |
| 会话撤销 | 受保护请求校验 JWT 及持久 AuthenticationSession、账号状态、authVersion、会话撤销/过期；旧会话在登出/改密/停用后失效，不能仅概括为 Redis 黑名单 | auth/identity 回归 |
| 员工登录与动作权限 | 密码步骤返回 MFA challenge，完成 MFA 才取得有效员工会话；每次请求重读当前权限/撤权；敏感写操作还校验当前 MFA 码。客服、内容、商品、经销商运营、管理员及超级管理员按权限区分，普通客户令牌不能充当员工 | identity-flow、roles.guard、MFA 回归；三引擎真实员工登录 |
| 经销商边界 | 未批准/停用企业和非活动成员不可取企业数据；首次同意当前版本条款；OWNER/BUYER/VIEWER 权限分离，VIEWER 禁止采购写入；员工用专用 admin 路由 | dealer-lifecycle、b2b-flow、identity-flow |
| 授权价格与资料 | 企业/产品/变体/区域授权和实时撤权；企业专属价、价表、等级、默认价按规则决策；数量、币种和有效期重核 | b2b-flow、pricing、media-lifecycle |
| 公开商品字段 | 允许返回面向消费者的零售价：列表 `priceCents`、详情变体 `price.priceCents`；不暴露内部 `b2bDefaultPriceCents`，不直接输出变体原始 `msrpCents`/`salePriceCents`。不能写成“公开接口无价格” | catalog-smoke、retail-commerce |
| 价格规则后台 | 页面 `/admin/pricing`，API `/api/v1/admin/pricing-rules`；需员工有效会话及 `catalog:price:write` 等当前授权，敏感写操作 MFA。无有效令牌通常 401；已认证但无权限 403 | pricing-admin、identity/RBAC |
| B2B 采购与售后 | CSV 表头/MOQ/倍数/箱规、RFQ 版本/期限、PO 快照、分批发货、复购；员工代建保存实际员工与理由，不伪造客户条款同意；全额/部分退款、线下真实流水确认、线上不确定结果重试和库存幂等 | b2b-flow、b2b-after-sales；三引擎 dealer-journey |
| 零售与库存 | 支付签名/金额/币种/幂等、退货私有证据及退款补偿；全局与市场库存一致加锁。默认现货防超卖；明确开启的预订/缺货订购可在上限内为负可用量，出库另核实物库存，不能笼统写“所有库存永不为负” | order-flow、retail-commerce、return-evidence |
| 媒体权限 | PUBLIC、REGISTERED、DEALER_ONLY、INTERNAL 四级。注册/经销商下载签发前验证当前身份和授权；资格/售后附件由各业务归属及后台权限校验；原文件和衍生图同权限 | media-lifecycle、b2b-flow、identity-flow、return-evidence |
| 上传与文件生命周期 | 资格文件 JPG/PNG/PDF ≤5 MiB；后台媒体 JPG/PNG/WebP/PDF/MP4/WebM ≤50 MiB。MIME/扩展/签名字节/大小、扫描、checksum、版本、响应式图片、真实引用保护、删除重试 | media-lifecycle；真实 ClamAV 容器报告 |
| CMS、联系及审计 | 草稿/未来发布内容不公开；联系校验/反垃圾/状态跟踪；富文本过滤；敏感变更与业务审计 | platform-flow、contact-triage、public-submission、CMS 浏览器场景 |

媒体链接不是“任何持有效签名者还必须再次登录”。账号下载入口 `/api/v1/media/:id/access` 校验授权后签发资源 ID + 到期时间的 HMAC bearer URL，最长 300 秒；到期或签名篡改被拒。后台 `/api/v1/media/:id/sign` 是独立权限入口，期限上限不同（86400 秒），不能把所有链接统称为“按人绑定/统一 300 秒”。非公开原文件无有效签名不能直接下载；PUBLIC 已发布且扫描状态允许时可公开访问。尚未同意经销商条款的已注册用户只能保留 REGISTERED 访问，不能获得 DEALER_ONLY 授权。

全局 IP 限流代码默认固定 60 秒窗口、12000 次，超限 HTTP 429/code 42900，支持环境配置；健康探针豁免。Redis 不可用时该全局计数器降级放行，因此不能将它描述为无条件限流保证。账号防爆破、MFA、注册/邮件频率控制另有各自规则。CI 回归验证相关逻辑，不等于在本次 head 重做了 100 连接默认限流压测。

## 4. 当前路由与实际浏览器覆盖

| 入口 | 浏览器页面 | API 范围（统一 `/api/v1` 前缀） |
| --- | --- | --- |
| 公开目录、资料与内容 | `/products`、`/products/[slug]`、`/content/[slug]`、`/support/downloads` | `/products`、`/cms/pages`、`/media/public`；公开经销商 `/dealer/directory` |
| 客户认证/账户/订单 | `/customer/register`、`/customer/login`、`/customer/account`、`/orders/[id]`；验证/重置页为 `/verify-email`、`/forgot-password`、`/reset-password` | `/auth/*`、`/account/*`、`/orders/*` |
| 经销商 | `/dealer/apply`、`/dealer/application`、`/dealer/login`、`/dealer/terms`、`/dealer/catalog`、`/dealer/quick-order`、`/dealer/procurement`、`/dealer/company`、`/dealer/downloads` | `/dealer/*`；采购单售后 `/dealer/purchase-orders/:id/after-sales` |
| 后台 | `/admin/login`、`/admin/products`、`/admin/pricing`、`/admin/orders`、`/admin/b2b`、`/admin/dealers`、`/admin/cms`、`/admin/media`、`/admin/roles`、`/admin/reports` 等 | `/admin/*`；媒体管理为 `/media/*` 的受保护动作，页面名不自动等于 API 名 |

Next 同源会话路由 `/api/session/[kind]/login` 和私有代理 `/api/secure/[kind]/[...path]` 不属于上述 Nest `/api/v1` 业务前缀。构建日志包含当前路由清单，不再引用旧“31 页”作为最终页面数量。

三引擎均完成真实客户登录、员工密码/MFA、经销商首次条款→CSV→RFQ→报价转 PO→中文地址→授权 PDF/匿名拒绝→退款申请，以及零售购物车/结算/演示付款/授权 PDF。公开模板按 360、390、768、1024、1440、1920 六种宽度检查横向溢出；指定页面 axe critical/serious 检查通过。它们不等于全部 WCAG 成功标准或真机人工验收。CI 的 `test-results/` 保留首页 390/1440 截图和后台 CMS 截图，`playwright-report/` 保留运行详情。

## 5. CI #49 性能结果：浏览器与 API 分开记录

来源：同次 artifact `.local/lighthouse/summary.json` 及四模板各 3 份 JSON/HTML。生成时间 2026-09-07 17:36:08 UTC。生产构建、Chromium new headless、Lighthouse 移动模拟；每个模板 3 次冷浏览器运行，LCP/TBT 取中位数、CLS 取最差值。

| 模板 | LCP 中位数（ms） | 三次 LCP 原样本（ms，四舍五入） | CLS | TBT 中位数（ms） | Performance / Accessibility |
| --- | ---: | --- | ---: | ---: | --- |
| 首页 | 2267 | 2163 / 2267 / 2281 | 0 | 101 | 98 / 100 |
| 商品列表 | 2340 | 2359 / 2340 / 2338 | 0 | 50.5 | 98 / 100 |
| 商品详情 | 2395 | 2407 / 2320 / 2395 | 0 | 44.5 | 98 / 100 |
| 文章 | 2259 | 2259 / 2257 / 2268 | 0 | 94 | 98 / 100 |

同任务对 5 个公开 API 分别预热后按 6 批 × 5 并发采集 30 个样本，等待完整响应体；按升序第 `ceil(30×0.95)` 个样本计算 P95。该方法是有限样本接口回归，不是 100 并发容量压测或“90% 浏览 + 10% 登录”混合负载。

| API 路径（均加 `/api/v1`） | 样本数 | P95（ms） |
| --- | ---: | ---: |
| `/products?pageSize=20&market=US` | 30 | 44.63 |
| `/products/ring-toss-outdoor-game-set?market=US` | 30 | 45.01 |
| `/search?q=bowling&market=US` | 30 | 50.55 |
| `/cms/pages?kind=ARTICLE&market=US` | 30 | 28.55 |
| `/site/config` | 30 | 16.42 |

该轮满足测试脚本的实验室门禁 LCP ≤2500ms、CLS ≤0.1、API P95 <500ms。API 延迟、LCP、TBT、INP 是不同指标；不能把旧 P99 ≤134ms 换算成网页 LCP、把 TBT 写成实测 INP，或据 localhost/CI 数据宣称公网 SLA、真实移动网络和地理流量均达标。

## 6. 历史测试保留与原 Word 的修订说明

历史源 A：龙祖怡 `测试报告-v0.2-性能数据更新.docx`；原件由用户本地保留，其哈希和公开审校版见[成员材料归档](archive/member-submissions-20260908/README.md)。历史源 B：本文件原 v0.5 与 [首版压测方案](plans/load-test-plan.md)。本次已逐页查看原 Word 的全部10页，确认其中有真实截图，具体核对见第6.4节；查看截图不等于重新运行测试。

### 6.1 历史功能/工程基线

| 时间/来源 | 保留的历史记录 | 本次如何使用 |
| --- | --- | --- |
| 2026-09-06，源 A，E1/E2、PR #2/#5 | 3 文件19 e2e：app 12、auth-flow 2、catalog-smoke 5；p3截图可读3/19通过，p4为CI #17/#21/#22；原文关联 main `7caada8` | 保留历史截图和来源；不是 CI #49 的计数，也不单凭构建证明全部业务完成 |
| 2026-09-07，原 v0.5/CI #40 | 旧冻结 `5c9d5bf`、69 单测；先33项DB回归（含13项B2B），后含真实SMTP的42项回归；8迁移、旧31页构建记录 | 保留各时点范围，不累计成新总数；原文见下方历史附录 |
| 原 v0.5 的本地浏览器受阻/Mailpit准备 | 曾有仅构建、SMTP握手就绪、浏览器未执行或截图待补的时点 | 属当时状态，已由后续真实 SMTP/浏览器/CI49证据补充，不继续写作当前阻塞 |
| CI #47 | 单测/业务浏览器通过但生产运行迁移失败，整体失败 | 保留缺陷闭环：Compose受宿主环境变量干扰；修复后以CI49整步成功关闭自动化项 |

### 6.2 历史 100 连接只读容量数据（不得移植至新 SHA）

两份来源均记载 2026-09-06、Windows 单机 dev watch、autocannon 8.0.0、100 连接 × 30 秒；容量场景把 `GLOBAL_RATE_LIMIT_PER_MIN` 提至 600000。源A的p8/p9终端截图与其134/103ms表格一致（详情Avg截图为73.61ms，表格取一位小数）。源B记录另一组数值；缺少完整时间/SHA和跨来源轮次映射，故分表保留，不择优、不求合并平均、不将“可复现”改写为本次已复测。

| 历史源 A（龙祖怡 Word） | 总请求/时长 | Avg | P99 | Max | Req/s | 原报告错误数 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 商品列表 | ≈33k / 30.15s | 92.1ms | 134ms | 274ms | ≈1082 | 0 |
| 商品详情 | ≈41k / 30.12s | 73.6ms | 103ms | 158ms | ≈1351 | 0 |

| 历史源 B（v0.5/压测方案） | 总请求/时长 | Avg | P99 | Max | Req/s | 原报告错误数 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 商品列表 | ≈34k / 30s | 88.9ms | 132ms | 264ms | ≈1121 | 0 |
| 商品详情 | ≈42k / 30s | 70.6ms | 93ms | 129ms | ≈1409 | 0 |

这些数据仅支持当时只读场景的容量基线记录。原文“P99远低于2.5秒，因此满足页面首屏N-01”应改为“API基线与浏览器首屏分开验证”；原文“满足N-02”应限定当时的只读场景。当前 head 尚无该规模的100连接或90/10登录混合负载新证据；CI49的5并发样本不能补算此项。

### 6.3 历史默认限流数据

| 2026-09-06 默认限流场景 | 历史2xx | 历史非2xx（原报告归为429） |
| --- | ---: | ---: |
| 商品列表 | 12000 | ≈66247 |
| 商品详情 | 11279 | ≈79796 |

保留数据及原源，不再把两行都写为“精确放行12000”。详情11279与12000不同；固定窗口起点、连续测试是否共享IP/窗口及逐响应记录尚不足，不能猜测原因。该历史记录说明当时出现限流响应；当前默认阈值由源码核对，未在CI49重新完成同样的100连接阈值压测。429属于限流安全验证结果，应与提限容量场景的应用错误数分开统计。

原 Word p6 的图4-1另可读出：商品列表 **12000个2xx、71659个non-2xx、约84k请求/30.12s**；Avg35.45ms、P99 133ms、Max300ms。它与p5表格的66247个非2xx并非同一数值，应保留为“截图所示另一记录，轮次待核”，不能静默改成与表格一致。图片只分类non-2xx，没有逐响应状态明细，不能仅由该截图认定每个非2xx都是429。

### 6.4 原 Word 十页视觉复核与归档处理

真实截图不是占位框：p2为Docker三容器healthy；p3为Vitest 3文件/19通过；p4为CI #17/#21/#22及Mailpit收件列表；p6为限流终端；p8/p9为两份容量终端；p9末为单发登录结果。图片能佐证各自显示的数据，未显示最终CI49源码SHA，不能改图题后冒充新版截图。

原件不建议不加处理直接公开入库。p5账号表有明文演示密码；p9登录截图含测试密码和JWT前缀。该JWT在截图中以省略号结尾，未见完整签名，本次没有验证它可用，也不称“完整令牌泄露”。公开历史副本应删除整张登录截图及DOCX内对应媒体文件（图片8，`rId13`，`word/media/image8.png`），保留登录成功文字并注明移除原因；密码表改为本地Seed初始化说明，不再列出密码。p4 Mailpit只见测试邮箱/邮件摘要，未见可用的验证或重置链接。原件可作受控本地历史材料保留，Git/正式共享包采用另存的审校历史副本，并附本报告的版本/数值勘误，不覆盖原始证据或修改保留截图中的数字。

版式勘误：p2→p3同一表格行被拆页，p4 Mailpit图片与p5图题分离；p7/p8/p10有大块留白。新排版宜让表格行与图题保持相邻并改善分页。历史截图应保持原内容，脱敏必须标明，不将新旧终端输出拼成一次运行。

## 7. 最终自动化已关闭项与仍需验收项

最终自动化整合项以 CI49 全部步骤成功关闭。真实商户收款/退款、银行到账、法定票据及业务数据、生产SMTP/域名认证、DNS/TLS/异地切流、真实媒体库规模恢复、当前/前一版浏览器与 iOS/Android 真机、完整人工无障碍、现场 INP/p75 和月度可用率仍需相应环境与人员验收，不能由本报告代签。新增100并发及登录混合压测也仍须在最终目标环境实际执行并归档，不能换用历史数据。

当前 Word 提交候选件使用本报告第1～7节，保留历史数据的来源与限制。公开历史副本已删除登录截图和示例密码，其他七张图片字节未修改；最终 CI 截图另存证据目录。后台登录现在要求 MFA，早期演示账号步骤不能替代当前操作手册。下方旧 v0.5 全文仅供过程追溯。

## 附录：原 v0.5 历史全文（不代表当前状态）

以下折叠内容原样保留用于追溯。其“当前”“最终”“通过/待测”、计数、环境、媒体5MB等文字均指旧报告时点；若与v0.6第1～7节不一致，以各自明确版本和证据为准，不复制成新结果。

<details>
<summary>展开原 v0.5 报告（2026-09-07）</summary>

# WEMOVE SPORTS 测试报告（持续更新版，历史 v0.5）

版本：v0.5　日期：2026-09-07　责任人：龙祖怡（组员 E）/ 全员复测；本轮认证回归：甘文韬

## 1. 测试范围与结论

本报告覆盖公共目录、客户认证与购物车、B2C 订单和库存事务、经销商申请/私有资质/审批/授权价格/Quick Order、员工 RBAC/MFA/审计，以及 CMS、媒体、联系工单和工程质量门禁。冻结代码提交 `5c9d5bf` 本地全仓验证通过；[GitHub Actions CI #40](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34058318600) 已在 PostgreSQL 16 与 Redis 7 真环境成功完成迁移、e2e 和构建。

当前结论：本地 Docker PostgreSQL/Redis/Mailpit 全量 e2e 42 项通过，包含真实注册收信、验证、重发和密码重置；本轮还修复令牌并发消费及停用账号被旧验证链接激活的问题。69 项单测和全仓构建通过。浏览器兼容、邮件 UI 截图仍待人工补入最终提交包；本地通过不代表远端 CI 已通过。

## 2. 环境

| 项目 | 本地验证 | CI 验证 |
|---|---|---|
| 操作系统 | Windows，PowerShell | GitHub-hosted Ubuntu |
| Node / npm | Node ≥22 / npm ≥10 | Node 22 / npm ci |
| Web / API | Next.js 16.3.4 / NestJS 12 | 同 lockfile |
| 数据库 | Docker PostgreSQL 16，独立测试数据库，8 次迁移 | PostgreSQL 16 service |
| 缓存 | Docker Redis 7，测试使用逻辑库 14 | Redis 7 service |
| 邮件 | Docker Mailpit，SMTP 1025 / API 8025，4 项真实收信测试通过 | 本轮新增 Mailpit service；结果按对应提交 CI 确认 |
| 测试工具 | Vitest 4.1.11、Supertest、Next/Nest build | 同仓脚本 |

## 3. 自动化结果

| 层级 | 命令 | 结果 | 覆盖重点 |
|---|---|---|---|
| Prisma | `npm run prisma:generate` | 通过 | Schema 与 Client 一致 |
| 静态检查 | `npm run lint` | 通过 | API/Web lint |
| 类型 | `npm run typecheck` | 通过 | API/Web TypeScript |
| 单元 | `npm test` | 14 文件、69 用例通过 | 认证限流、MFA、价格优先级、购物车归属、私有附件、审核/订单状态机、Quick Order |
| 全量 e2e | `E2E_DB=1 E2E_MAIL=1 npm run test:e2e -w api` | 7 文件、42 用例通过，无跳过 | 认证、目录、订单库存、B2B、并发令牌、真实 SMTP 收信 |
| 生产构建 | `npm run build` | 通过 | Next 全部路由 + Nest build |
| DB e2e | GitHub Actions CI #40 | 通过 | 迁移、认证/Redis、目录（含 PDP 字段）、订单库存闭环 |

## 4. 功能与安全矩阵

| 编号 | 场景 | 期望 | 证据 | 状态 |
|---|---|---|---|---|
| AUTH-01 | 未勾选 18+ 注册 | 422，服务端拒绝 | Auth DTO/Service 单测 | 通过 |
| AUTH-02/05 | 验证/重置令牌重复或并发使用 | 哈希存储、一次性消费、过期拒绝、停用账号不能激活/重置 | auth-flow + auth-token e2e，Mailpit 收信闭环 | 通过 |
| AUTH-03/04 | 登出黑名单、连续 5 次登录失败 | 旧 JWT 失效；锁定时正确密码不能绕过 | auth-flow e2e + 单测 | 通过 |
| DLR-02/03 | 审核与跨企业读取 | 写操作 MFA+审计；跨企业 403 | Dealer 单测与控制器元数据测试 | 通过 |
| DLR-04 | Quick Order 无效/重复/库存不足 | 逐行错误，不泄漏未授权 SKU | Dealer 单测 2 项 | 通过 |
| PRICE-01/02 | 公开价格隔离与优先级 | 不返回 B2B 字段；企业>价表>等级>默认 | Catalog e2e + Pricing 单测 | 通过 |
| ORDER-01 | 结算快照 | 整数分保存商品/SKU/单价快照 | Order 单测 + DB e2e | 通过（CI #40） |
| STOCK-01 | 库存并发扣减 | 事务、购物车行锁、条件扣减、不为负 | Order 单测 + DB e2e | 通过（CI #40） |
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


## 9. 2026-09-07 M1/MB 承接验证（甘文韬）

新增迁移 5 个模型，完整迁移链共 8 次；Windows 本地隔离 PostgreSQL 16 上 13 项 B2B HTTP e2e 首轮通过。用户随后启动 Docker，本轮再使用 Docker PostgreSQL 16/Redis 7 的独立测试数据库运行全部 e2e，保留原开发数据。

新增场景：匿名与客户/员工隔离、VIEWER 禁写、实时成员/企业状态、跨企业读写、后台全部写操作 MFA、授权价表与撤权、缺失地址/重复行、报价版本冲突/过期、金额溢出、快照、并发同报价只生成一单、不同报价抢库存、多行失败全回滚、取消一次返库、履约合法顺序及事务审计。

既有 CI #40 仅用于旧基线；新代码验证以本节本地运行记录和后续同提交 CI 为准，不混淆。

| 本轮检查 | 结果 |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm test` | 通过；14 文件、69 个单测 |
| Docker PostgreSQL 16 的独立测试库迁移 | 全部 8 次迁移成功，保留原开发库 |
| `E2E_DB=1 npm run test:e2e -w api`（PG + Redis） | 5 文件、33 个用例全部通过，无跳过；包含 13 个 B2B 用例 |
| `npm run build` | Next 31 个页面生成、Nest 构建成功，包含 /dealer/procurement 和 /admin/b2b |
| 浏览器完整采购流程 | 未执行：本地前端预览启动被自动审批检查以 blocked by policy 拒绝（包括仅绑定 127.0.0.1 的尝试）；不能用构建通过替代浏览器验收 |

## 10. 2026-09-07 Mailpit 本地联调准备

已核对 `origin/main` 包含 E1 提交 `0483404`，Compose 的 SMTP/UI 端口分别为 1025/8025。当前本地 `apps/api/.env` 已配置 `SMTP_HOST=localhost`、`SMTP_PORT=1025`、`EMAIL_VERIFY_REQUIRED=true`；该文件受 Git 忽略，不提交环境配置。

`wemove-mailpit` 容器已启动且健康检查通过；使用 API 的 Nodemailer 与本地环境配置完成 SMTP 握手，收件箱 `http://localhost:8025` 返回 HTTP 200。这仅证明联调基础设施就绪，尚未代替注册邮件闭环验收。

待人工操作并补图：启动（或重启）本地 API/Web，使用新邮箱注册，确认注册状态为 `PENDING`、未验证时不能登录；在 Mailpit 打开验证邮件并访问其中链接，完成验证后确认可以登录。截图记录环境与日期，遮盖验证令牌；由实际操作人员填写复测结果。

## 11. 2026-09-07 认证并发修复与真实 SMTP 回归

本轮在实际数据库上先运行新增回归用例，旧代码 5 项中 4 项失败：6 个并发验证请求出现 3 次成功；停用用户的旧验证链接返回成功并激活账号；相同以及不同重置令牌的两个并发改密请求均成功。修复后同组 5 项全部通过，只有一次有效消费产生成功结果和成功审计。

修复措施：邮箱验证、重发与重置密码按账号加行锁，锁内重新检查令牌有效期/消费状态及账号状态；修改账号与作废令牌在同一事务完成。停用账号无法用验证链接恢复。纯文本邮件直接使用包含完整链接的正文，避免从 HTML 去标签时丢失链接。

真实 SMTP 测试不注入或伪造令牌，向 Mailpit 发信后通过其 API 按本轮随机收件人取信，再调用业务验证/重置接口。4 项用例覆盖：注册为 PENDING、未验证禁止登录、HTML/纯文本链接、哈希存储、激活与登录；重发使旧链接失效；邮件重置后旧密码失效且链接不能重复使用；不存在或停用账号返回统一响应且不发送额外邮件。Mailpit API 依据[官方说明](https://mailpit.axllent.org/docs/api-v1/)。仅清理测试账号和它们的邮件，保留用户收件箱中的其他邮件。

验证结果：`npm run verify` 通过（lint、类型检查、69 单测、Next 31 页与 Nest 构建）；`E2E_DB=1 E2E_MAIL=1` 完整 e2e 为 7 文件、42 用例，无跳过。数据库沿用本轮独立测试库；业务 `.env` 中用户要求的 SMTP 与强制验证设置保持原值。CI 工作流已新增 Mailpit service 和 `E2E_MAIL` 开关，远端执行结果另行记录。

以下 PowerShell 命令在仓库根目录执行；前提是 `DATABASE_URL` 指向已执行 `db:deploy` 的独立测试库，`REDIS_URL` 指向测试 Redis：

```powershell
docker compose -f infra/docker-compose.yml up -d mailpit
$env:E2E_DB = '1'
$env:E2E_MAIL = '1'
npm run test:e2e -w api
```

本节证明 HTTP API 与真实 SMTP 邮件闭环，不替代浏览器交互、兼容性或人工截图验收。

</details>

</details>
