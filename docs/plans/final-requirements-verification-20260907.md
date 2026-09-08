# 原始规格最终验收追踪矩阵

> 最新功能版本 `f3c074f` 的 CI #54 全部通过：110 单测、169 DB/邮件、70 浏览器/性能及生产扫描/恢复。当前需求 v0.5、测试 v0.7、100 用户实测和材料状态见[提交索引](../deliverables/README.md)。项目实际工作量占比为甘文韬 25%、其余四人各 18.75%，合计 100%。下文历史阶段的课程排除或待 CI 说明不覆盖后续更新。

> **2026-09-08 更新：**整合源码 `0d33eef` 的 [CI #49 完整通过证据](../evidence/ci49/README.md)已归档：110 单测、169 DB/邮件、67 浏览器/性能及生产启动恢复全部成功。下文较早的待 CI 记录属于过程，以[测试报告 v0.6](../test-report.md)和 PR 对应提交 Checks 为准。用户后续授权的课程材料归档见[文档审核记录](document-review-20260908.md)，本表原先的课程排除说明仅指开发阶段。

日期：2026-09-07；本表基于《选题1 网站重构需求》V1.0 原文与当前整合工作区逐项复核。G/A/C/D/E 编号沿用 [最初差距审查](requirements-completion-audit-20260907.md)，不是原文自带 ID；“原文”列保留真实章节与功能编号。旧审查保留作为修复前记录，不再代表当前功能现状。正式课程材料不在本轮代写范围内。

商品、零售、内容及相邻权限/售后证据于 2026-09-08 更新。CI #47 已完成三引擎的 67 项浏览器/性能测试，但生产演练迁移失败；最后退款与环境隔离修复需新的完整 CI。下列时间记录保留历史过程，最新整合结论以 PR 当前 head 的 Checks、提交映射和文末补充为准。

不能据此宣称“100% 完成”或“已可正式上线”。下表区分实现、局部真实测试、最终整合验收及外部运行前提。多个套件计数可能含重跑，不累加为总覆盖率；某用例通过也不意味着所在章节全部人工验收通过。

## 版本与证据冻结

| 项目 | 当前事实与证据定位 |
| --- | --- |
| main 整合 | `a93c745 merge: integrate latest main and retain B2B manual` 已合入 `5642da2` / `6500115`；保留双方操作手册内容。 |
| 本表对应业务代码 | 本表同次提交的完整源码；`a93c745` 仅是 main 合并点，不包含其后全部功能，不能当作最终交付 SHA。 |
| 最终提交 SHA | 以 [PR #10](https://github.com/ganwentao20/wemove-sports-portal/pull/10) 当前 head 为交付源码；CI `.local/acceptance-revision.json` 同时记录 sourceCommit、integratedMainCommit、ciCheckoutCommit、testedTree，并强制检查 main 已纳入、CI 与源码树一致。这样无需在提交内填写自身尚未产生的 SHA。 |
| 最终 CI | 以 [PR #10 Checks](https://github.com/ganwentao20/wemove-sports-portal/pull/10/checks) 中该源码提交的完整 CI 为准；artifact `integrated-acceptance-<CI checkout SHA>` 包含提交映射、浏览器、Lighthouse、扫描、启动和恢复证据。旧 CI #44 不作为本次整合通过证据。只有全流程成功才可标记本次 CI 通过。 |
| 迁移验证库 | 独立 `wemove_verify_20260907` 和从空库创建的 `wemove_install_20260907` 均已应用 29 个迁移；原 `wemove` 未重置。CI 从空 PostgreSQL 数据库完整复现。 |
| 最终全套验证 | 2026-09-08 本机：干净 npm ci、lint/类型/API/Web 构建、110 单测、168 项 DB/SMTP e2e、生产依赖 audit（0 漏洞）均通过；四模板 Lighthouse 及生产镜像/真实恢复通过。Chromium/WebKit 44 场景已完成（42项整轮通过，经销商2项修正测试定位后定向通过）；最终远端整轮结果以 PR Checks 为准。 |
| 实际分工与工作量占比 | 甘文韬 25%；陈婧琳、周慧莹、倪依玲、龙祖怡各 18.75%，合计 100%。实际职责分配见[工作量报告](workload-current.md)。 |

状态：**实现+回归**表示对应代码和列出的自动化场景已运行；**实现待整合**表示有可执行实现，但最新交叉修改仍需最终运行；**外部待验**表示必须在真实资源、设备、业务材料或运行周期下核实；**课程排除**表示本轮不编造或代替个人材料。

## 甘文韬 G01–G12

| ID | 原文硬要求 | 当前实现与定位 | 证据 / 剩余验收 |
| --- | --- | --- | --- |
| G01 | §4.8、§8.1、ACC-003：申请、邮箱、补件、批准、激活、首次登录条款 | `dealer/dealer-portal.service.ts` 认领一次性令牌、同邮箱验证、补件重提；`account/dealer-terms.controller.ts` 真实条款、明确同意、版本/时间/IP、并发一次审计；登录及业务守卫拦截未同意成员。 | 实现+回归：`dealer-lifecycle`、`identity-flow`。匿名申请人注册时自行设置密码，经邮箱验证及安全认领绑定，已有用户使用原凭据/重置；没有虚构默认密码激活。正式企业条款文字须业务确认。 |
| G02 | §4.8、§13.4：草稿、协议版本和申请确认 | `DealerApplicationDraft` 持久草稿、表单分步校验、申请协议时间/IP；通知 outbox 记录提交/补件/通过/拒绝。 | 实现+回归：`dealer-lifecycle`、`notifications-flow`；SMTP 公网送达另验。 |
| G03 | §6.7、D-007～009、ADM-D-004/006：企业、地址、团队 | `/dealer/company`、`/admin/b2b/companies`，企业资料/默认地址、OWNER/BUYER/VIEWER、有效期邀请/一次接受、成员停用、采购暂停/企业关闭；公开门店独立待审快照。 | 实现+回归：`dealer-lifecycle`、`identity-flow`。移除成员后旧会话下一请求撤权；商业历史保留。 |
| G04 | B2B-001、§6.3、§14.3：区域/渠道/合同授权 | 统一 `dealer/catalog-policy.ts` 控制产品/分类/变体/市场/渠道；目录、精确查询、报价/转单、下载均复核当前授权。 | 实现+回归：`b2b-flow` 越权、报价后撤授权、市场库存；不只隐藏 UI。 |
| G05 | B2B-003/004/005/007：采购字段、CSV、批量购物车与展示策略 | Quick Order CSV/粘贴、多行错误、MOQ/倍数/箱规/交期/箱重、持久企业采购车；精确/档位/状态/隐藏库存。 | 实现+回归：`b2b-flow`；真实包装/交期数值须企业填入。 |
| G06 | QTE-001～006：完整询报价、版本、期限、通知 | RFQ 目标交期/附件、报价折扣/税运/付款条款、不可变版本、拒绝原因/过期禁转单、即将到期 worker。 | 实现+回归：`b2b-flow`、`notifications-flow`；人工报价规则以批准合同配置。 |
| G07 | ORD-B2B-001～007、§8.4、ADM-O：B2B 商业订单 | 客户 PO Number、企业地址快照、允许支付方式/账期、待审/确认预占策略、调整原因、多次发货、PDF、复购、卡支付及退货/退款审批；后台 RFQ 表单可由员工以 MFA 和理由代建 PO，复核当前授权/规则/库存并独立审计，不伪造客户接受或条款。 | 实现+回归：`b2b-flow` 25 项含员工代建、`b2b-after-sales`；真实银行到账、商户收款/退款、物流、税务票据需正式联调。 |
| G08 | B2B-006、D-006、§10.3：注册用户和企业资料中心 | `/dealer/downloads`、`/media/downloads` 校验当前账号/企业权限后签发绑定资源 ID 与到期时间的短期 URL；PUBLIC/REGISTERED/DEALER_ONLY、企业/产品/变体授权、私有资质隔离。未接受条款仅保留注册客户下载，不可取经销商文件。 | 实现+回归：`media-lifecycle`、`b2b-flow`、`identity-flow`；短期 URL 是 bearer 凭证，并非绑定账号的签名。00:27 媒体 8/8 实库通过，含空授权/其他产品或停用 SKU/跨企业/无 SKU 默认资料；真实素材与存储外部验收。 |
| G09 | §2.2、SEC-005、ACC-006：权限动作与实时撤权 | `rbac/roles.guard.ts` 动作权限+旧路由映射，直接 grant/deny、员工状态/最新权限每请求读取；`/admin/me` 驱动工作台入口过滤。 | 实现+回归：`roles.guard.spec`、`identity-flow` 七类身份和后台职能角色；全部操作按钮人工按角色遍历仍纳入 UAT。 |
| G10 | §2.3、SEC-002/003、USR-009：强制 MFA/会话 | 密码仅挑战；受保护 MFA 首次绑定、次数/过期/并发限制；后台必需二因子后才发会话；企业可启用 MFA；HttpOnly 会话、撤销/退出其他设备、改密失效。 | 实现+回归：`identity-flow`、`auth-token`、`auth-flow`；生产 Cookie/TLS 与时钟配置最终复核。 |
| G11 | §15、§19：可靠通知与集成 | 加密 outbox、幂等、重试/死信、模板/预览、内部收件组、事务内入队、账户/经销商/报价/订单/客服/订阅事件；退订与账户偏好一致且不拦事务邮件。 | 实现+回归：`notifications-flow`、`platform-flow`、`public-submission`、`identity-flow`、Mailpit；正式语言内容及公网 SMTP 送达待验。 |
| G12 | §21/22：完整范围追踪和最终整合 | 本矩阵保留原文硬要求；课程⑦已纠正为源代码，操作手册另列；main 合并点已存在，最终功能不再按旧 P2 计划删除。 | 实现及本机验收完成；最终源码与CI检出树强制匹配，29迁移、构建、浏览器和部署证据见本表，不复用 #44。 |

## 陈婧琳 A01–A08

| ID | 原文硬要求 | 当前实现与定位 | 证据 / 剩余验收 |
| --- | --- | --- | --- |
| A01 | §3/4、附录 B：完整官网、内容、经销商列表/详情与政策 | `app/(storefront)`、CMS 驱动 About/Quality/新品/Play & Learn/FAQ/下载/Contact/政策；经销商按国家/省市/邮编筛选及地图，Logo/电话/类型/营业/渠道/分类，单独详情可关闭、薄内容不索引。 | 实现+回归：`platform-flow`、`dealer-lifecycle`；公开门店只取 APPROVED+已同意公开+已审核快照，改稿不直接发布，退出公开立即生效。真实品牌素材须迁移确认。 |
| A02 | HOME-001～007、FE-001～006：动态首页/导航 | CMS 可视化模块、逐模块启用/上下线、Hero 视频/封面/移动图片/对齐/双 CTA、手选商品/文章集合及可关闭公告；Header 滚动收缩、两级导航与移动抽屉，配置品牌/Footer/社交/语言/市场及身份入口。 | 实现+回归：`platform-flow`、导航策略及 CMS 关联测试；新增 `content-navigation` 浏览器场景交最终整合运行，视频 DOM 配置检查不等于真实素材播放验收。 |
| A03 | PLP-001～008、PDP-001～014、§4.5 | 结构化筛选/五种排序/分页、分类内容/SEO、无结果清除/分类/推荐；规格/玩法/安全/关联 FAQ、相关/配件/替换件分组、按语言市场定位图库与变体、分享/四件比较。经销商列表起订提示，PDP 授权价/MOQ/箱规/采购与报价；评分开关及同源 JSON-LD、按权限商品资料入口。 | 实现+回归：`retail-commerce`、`catalog-operations`、`cms-associations`、`product-rating`；新增分类/PDP/评分浏览器场景与权限资料界面由最终整合验证。评分默认关闭，真实评分来源和商品素材由业务提供。 |
| A04 | FE-004、SEA-001～007：统一搜索 | PostgreSQL 全文/前缀/容错/同义词与权重；产品/分类/文章/FAQ/公开下载、多类型标签、联想、无结果推荐，按市场/翻译/发布时间过滤。 | 实现+回归：`platform-flow` 新搜索边界用例及 `search-query.ts`；真实同义词运营、目标数据规模性能待验。 |
| A05 | USR-003～010、U-002～007：用户中心 | `/customer/account` 资料/地址/收藏/订单/营销/安全；售后按行数量、原因/说明和私有照片，鉴权下载/移除未提交图片/超期清理；导出和删除工单最小化个人字段，保留商业记录及处理理由。 | 实现+回归：`identity-flow`、零售/售后及 `return-evidence`；真实 PNG 上传→扫描状态校验→签名→下载字节一致。个人导出排除附件能力令牌、其他团队售后与内部幂等键；界面最终整合另验。 |
| A06 | §5.2、ACC-005：完整交易和关闭模式 | `/cart` 游客车及登录幂等合并、独立 `/checkout`、账单/收货快照、配送/税/优惠和最终重算、支付结果、订单/退换货/退款/鉴权 PDF；关闭 B2C 按市场切经销商查找/联系入口。 | 实现+回归：`retail-commerce`、`order-flow`；DEMO 和签名协议场景已运行。最终浏览器与真实商户验收分开记录，不把演示成功当作实际资金支付。 |
| A07 | §12/13/16：多语、同意、无障碍 | 默认 en；合法语言/地区码与站点启用约束，四阶段翻译状态，完整正文/规格/FAQ 才可发布；DEFAULT/HIDE、实际语言 URL/hreflang/sitemap 和逐语言 noindex。非必要脚本获同意后加载，标签/唯一 main/可聚焦 skiplink、登录重定向与同源防护。 | 实现+回归：locale/navigation/redirect 单测及 `retail-commerce`、`cms-associations`、`platform-flow`；SQL 搜索与发布完整性一致。PDP 固定 UI en/zh/fr/de；PLP 等无完整固定字典页面整体回退 en 并保留市场/查询，不能宣称任意语言均已翻译。六宽/键盘/axe 最终结果另填。 |
| A08 | 课程①③、§22.3：本人报告、真实会议、设计交互材料 | 本轮不代造独立报告、签名或讨论记录；远端成果作者保留。 | 课程排除；设计稿/最终操作截图等资料按真实工作补充。 |

## 周慧莹 C01–C07

| ID | 原文硬要求 | 当前实现与定位 | 证据 / 剩余验收 |
| --- | --- | --- | --- |
| C01 | ADM-P-001～010、§7.4/14.2：商品/分类/属性/批量 | 商品五状态/排程、分类层级/描述/封面/SEO/模板、SKU/条码唯一、图库拖拽与语言市场/alt、变体、RELATED/ACCESSORY/REPLACEMENT 关联、复制零库存草稿、归档/旧 slug。CSV 分类/标签/状态/价格/库存预览、原子提交及安全导出；省略保留、空值清除，冲突或模板错误拒绝整批。 | 实现+回归：catalog 单测、`retail-commerce`、`catalog-operations`；00:10 实库 35 项及 00:14 最后投影/CSV 回归见下表。分类与关联真实 UI 浏览器场景待最终整合运行；原站批量资产迁移须真实来源。 |
| C02 | §6.4/9.2、ADM-PR-001～005：价格/促销 | 企业覆盖/价表/等级优先级、阶梯、市场/币种/有效期、MSRP/Sale、限制产品/用户/次数的优惠码、历史与批量影响预览；日期/上限/市场等可空限制可明确清空，省略仍保留。 | 实现+回归：pricing 单测、`retail-commerce`、`b2b-flow`；PDP 企业取价经当前权限复核。合同价、币种价格/税口径由业务配置，成交快照不追改。 |
| C03 | §5.2/8.3/9.4：结算、支付与补偿 | 最终重新取价，地址/税运计算证据快照；DEMO/HTTP、HMAC/时间窗、支付金额/币种和事件幂等；零售退款首次/重试共用退款及原付款身份、金额/币种/状态/流水验证，不可信结果保留待确认并告警，重试复用原幂等 ID，支持迟到成功补偿。 | 实现+回归：`retail-commerce`；最新退款协议修复须纳入下一次完整整合验证，旧 CI 不覆盖。商户真实协议映射、密钥、实际资金支付/退款和 PCI 范围确认才属于外部验收。 |
| C04 | ADM-O-001～008、USR-006/007：履约/售后/单据 | 按行数量分批发货/追踪、防超发；零售退换货按行说明/私有照片/运营理由、退款/回库/补发/复购、人工单与员工代建 B2B PO、CSV 敏感权限；零售发票/收据/装箱单及 B2B 确认单等鉴权 PDF。 | 实现+回归：`retail-commerce`、`order-flow`、`return-evidence`、`b2b-flow`、`b2b-after-sales`；附件绑定本人订单与行，未授权/无效扫描状态拒绝，下载逐字节验证。中英文字体已打包，真实物流与法定税票不冒充。 |
| C05 | §7.6/9.3：库存来源、市场、预占与故障 | 后台/CSV 数量及来源记录，全局与可选市场池固定顺序加锁预占/释放/出库/回库，低库存告警、同步故障保留旧数值并拒售、限量预售/欠货；API 生命周期每 60 秒自动释放超时单、重试退款并告警，按订单原市场归还。 | 实现+回归：库存/购物车/订单单测、两渠道并发 DB 测试。采用原文允许的不接 ERP 简化数量方案，未声称已接 ERP/HTTP 库存供应商；付款仍预留至发货，API 需持续运行才能执行定时任务。 |
| C06 | USR/§6.7/SEA：共享数据与搜索 | AccountAddress/Favorite/Privacy/营销、DealerAddress/Invitation/成员/条款、独立零售/B2B 售后结构；统一搜索使用当前发布/市场/语言完整性条件，公开投影剥离草稿译文与内部关联配置。 | 实现+回归：identity、dealer、零售、platform 及 `return-evidence`；本人售后导出不包含私有访问能力或其他团队申请。大规模数据和运营词库效果待真实样本。 |
| C07 | §14/20/22.3、课程①：字典、迁移、原站导入 | Prisma/独立 SQL 迁移及商品/分类标签/价格/库存/重定向导入；本批含分类 description/coverImage/seo、Product.associations、CmsPage.sortOrder、市场库存/订单计价证据及零售说明/私有附件元数据。保留远端字典成果。 | 实现+回归，外部待验：`20260907330000`、`20260907340000`、`20260907341000` 等迁移及功能证据见模块记录；最终29迁移空库复现成功，字段字典随对应模块记录冻结。真实原站素材、URL、数量和最后增量仍须取得来源后核对，个人报告排除。 |

## 倪依玲 D01–D07

| ID | 原文硬要求 | 当前实现与定位 | 证据 / 剩余验收 |
| --- | --- | --- | --- |
| D01 | HOME、ADM-C-001～006、ACC-001：运营 CMS | `/admin/cms` 可视化模块/富文本/排序、Hero 视频/对齐/排程、手选文章与商品集合；顶层商品选择/排序、FAQ 分类/关键词/关联产品筛选和持久顺序，文章/PDP 读取已发布关联。草稿/市场/鉴权预览、乐观锁、不可变修订及包含关联/顺序的完整恢复。 | 实现+回归：`platform-flow`、`cms-associations`；严格 ISO 日期/时区/不存在日期和时间范围校验，公共输出去除禁用/未生效/过期模块。23:52 两套件 20 项通过；最终无代码编辑浏览器验收另填。 |
| D02 | §7.1、A-003/008/012～016、ACC-006：完整工作台 | 当前 Next 下 Products/Pricing/Inventory/Orders/Quotes/Dealers/Users/Content/Media/Forms/SEO/Reports/Settings/Roles/Audit；Dashboard 用当前权限过滤入口。 | 实现+回归：跨角色 identity/RBAC；各模块接口 e2e。全局工作台交互及角色按钮人工检查保留待验。 |
| D03 | §7.11/10.3、SEC-007：媒体全周期 | MIME/扩展/签名字节/大小、ClamAV 扫描、原图+多尺寸、checksum 去重、alt/标签/语言/关联/版本/替换；真实业务引用防误删，隐私删除持久重试且立即禁签。 | 实现+回归：`media-lifecycle`、scanner 协议及真实 ClamAV 容器演练通过；正常文件/EICAR/无认证 401/引擎停机 503 见 [运维记录](../production-operations.md)。生产扫描配置、媒体完整备份/恢复与 CDN 仍须正式环境验收。 |
| D04 | CT-001～005、§7.12/16.2：线索和客服 | 来源/团队/负责人/优先级/标签/状态筛选与分页；CSV 同筛选全量且隐私最小化；附件安全、确认/回复、内部备注隔离、历史、幂等/限流、用户删除/导出记录。 | 实现+回归：`contact-triage` 6 场景、`public-submission`、`platform-flow`、`identity-flow`。邮件只入可靠 outbox，实际收件体验待 SMTP。 |
| D05 | §7.13/12、SEO-001～008、ACC-007 | 分类/商品/内容独立 SEO、OG/canonical 与正文 H1；适用的 Product/Offer/Breadcrumb/FAQ/Article 结构化数据；robots、逐译文 noindex、实际可索引语言/市场 sitemap 与 hreflang、四阶段完整翻译、旧 slug/批量安全 301 和 404 处理。 | 实现+局部回归：`catalog-operations`、`retail-commerce`、`cms-associations`、`platform-flow`；源语言 noindex 不误屏蔽允许索引的完整译文，noindex 不禁止站内访问。SEO批量/搜索/缓存/逐语发布已纳入完整DB回归；域名/www/CDN 正式验收。 |
| D06 | §7.2/7.14/18/19：报表和系统配置 | consent 白名单分析、匿名会话漏斗；产品/内容/搜索/经销商/零售 B2B 销售/线索报表与 CSV，财务独立权限；B2B 退款按市场/币种及实际 SUCCEEDED.completedAt 聚合；品牌/社交/导航/语言/市场/邮件/支付/税运设置。 | 实现待整合：`platform-flow` 指标及非财务脱敏；B2B 售后实库已验证成功退款进入财务聚合。真实 GA/GTM、运行数据质量与运营收件组待配置；时间范围/搜索转化/Web Vitals等完整结果见整合验收记录。 |
| D07 | 课程①、§22.3：个人报告与手册截图 | main 上倪依玲个人报告和操作手册已保留；⑦误标已修正。 | 课程排除。实际文档截图/个人描述由对应成员按冻结版本核对，不把留白截图记为完成。 |

## 龙祖怡 E01–E08

| ID | 原文硬要求 | 当前实现与定位 | 证据 / 剩余验收 |
| --- | --- | --- | --- |
| E01 | §21、附录 A/B、ACC：完整追踪与角色 UAT | 本矩阵+168项DB/HTTP/Mailpit回归+浏览器测试；identity 覆盖访客、客户、经销商成员/管理员及后台职能角色，含跨企业/会话撤权。 | 局部回归已执行；七类角色人工验收、最终统一 SHA 的完整自动化结果按 PR Checks 和提交映射归档。用例数量不等于覆盖率。 |
| E02 | §21.2：最近两大版本、真机、六宽 | Playwright Chromium/Firefox/WebKit 与六宽模板场景，CI 安装三引擎。 | 待最终结果；本机 Firefox 曾因 Windows mozglue 组件错误无法启动须如实保留。Playwright WebKit 不能代替真实 iOS Safari；当前/前一版 Chrome/Edge/Firefox/Safari 与 Android/iOS 真机需设备验收。 |
| E03 | §13.5/21.3：WCAG 2.2 AA 目标 | 持续 label、焦点/skiplink/语义主区、键盘图库/表单、错误反馈；`tests/browser/portal.spec.ts` axe 与核心路径。 | 待最终自动化结果+人工键盘、读屏/放大与对比度抽检；不能把零严重 axe 错误等同完整 WCAG 合规。 |
| E04 | PERF-001～006、§21.4：LCP/CLS/INP、缓存、API P95 | 生产压缩/图片尺寸与优先级/懒加载，SSR 发布/排程缓存版本失效；每模板三次冷浏览器 Lighthouse 与五接口混合 API 负载；同意后的 Web Vitals 真实指标按最新 metric_id 去重取 p75。 | 本机首页/PLP/PDP/文章 LCP 中位数为 2204/1729/2356/2194ms，CLS 全为0；五公开API各30样本、5并发，P95最高110ms。真实移动网 LCP≤2.5s、CLS≤0.1、INP Good、公开 CDN 和真实地理流量不能由 localhost 推断。 |
| E05 | SEC-001～008、§21.5：身份/权限/上传/XSS/Webhook/依赖 | bcrypt、DB session、MFA、CSRF同源代理、富文本白名单、Webhook 签名幂等、限流、扫描、审计、依赖 audit 与 CI门禁。 | 局部安全回归及真实 ClamAV clean/EICAR/401/503 隔离演练通过；最终依赖锁 npm ci、production audit 0漏洞、核心页面axe及安全回归均已运行。真实商户回调与生产扫描部署仍须正式验收。 |
| E06 | §17.2/17.3/20：完整环境/备份/PITR/告警/回滚 | `infra/production` API/Web/迁移/PG/Redis/Caddy/ClamAV；pgBackRest WAL/full/diff、加密备份/新库恢复、Prometheus/Alertmanager/Loki/Alloy/metrics及运维脚本。 | 01:00 最后SKU修复后的API/migrate实际重建运行通过；62表逐表核对及4096字节媒体SHA256恢复一致，应用恢复健康；真实ClamAV及WAL指定时间恢复通过，见[运维记录](../production-operations.md)。DNS/TLS、异地库/密钥、告警接收及 99.9% 月度可用性需正式环境。 |
| E07 | §15/20：第三方联调/资产迁移/上线 | 支付/税/运价 HTTP 适配、签名/幂等/超时/失败补偿；库存采用允许的手工/CSV 数量方案；商品/分类标签/价格/库存/重定向导入，Mailpit 与 HTTP 供应商 stub 验证。 | 外部待验：原站合法素材/结构数据/URL、真实邮件/商户/物流/税务配置及其实际协议映射；如选用 ERP，另联调其库存接口。冻结源站再增量迁移并核对数量/文件/链接/SEO，mock 或样例素材不能算完成迁移。 |
| E08 | 课程①⑦、§22.3：个人报告与源代码交付 | 课程⑦为代码，不能以操作手册或测试报告替代；源码、迁移、环境示例和复现说明随实际最终版本整理，成员报告按真实贡献完成。 | 课程排除；最终源代码包、冻结 SHA、干净环境复现与课程提交命名待统一核对。课程⑤测试报告另按 E01 和实际测试证据整理，不以局部回归代替签收。 |

## 原文 ACC-001～010 最终签收项

| 原文 ID | 硬性验收动作 | 现有定位 / 必须记录的最终证据 |
| --- | --- | --- |
| ACC-001 | 运营不改代码新增产品、变体、图片、文章、FAQ、Banner 并发布 | catalog/CMS/media 当前 Next 工作台及实库回归；分类 SEO、图库排序/定位、三类关联、FAQ/文章商品选择、Hero/模块时间均有编辑入口。新增 `catalog-completion`、`content-navigation` 场景；最终用内容/商品运营账户逐项创建→发布→公开读取，记录统一 SHA 和截图。 |
| ACC-002 | 客户/经销商不同价格/入口且接口无越权 | identity/b2b/retail 回归、动态权限/公司策略/现价查询；PLP 经销商起订提示不输出企业价格，PDP 使用授权目录价/MOQ/箱规，未授权会员拒绝采购。实际普通客户/其他企业/旧令牌/撤授权边界由 API 验证，UI 会话提示测试不能代替此权限证据。 |
| ACC-003 | 经销商提交→补件→审批→登录完整 | dealer-lifecycle + identity 首次版本条款；审批不伪造条款同意，正式SMTP激活/认领邮件另验。 |
| ACC-004 | 专属目录、价格、快速下单、报价、订单 | b2b-flow + after-sales，CSV/采购车/报价版本→PO、分批履约/复购；最终浏览器实际操作另录。 |
| ACC-005 | B2C开启完整购买，关闭自动非交易CTA | `retail-commerce`、`order-flow` 的 DEMO、禁售/市场/最新价/税运地址快照/签名/幂等/部分履约与售后回归；游客登录合并和鉴权 PDF 浏览器路径已提供。最终浏览器证据与真实商户支付/退款分别记录。 |
| ACC-006 | 后台管理订单/报价/经销商/用户/内容/SEO/权限/审计 | 对应全部当前 Next工作台+后端动作权限、原因/MFA/audit；各职能账号人工遍历与最终整合测试待签收。 |
| ACC-007 | 不混排未译正文，语言URL/hreflang/sitemap正确 | 四阶段状态与完整正文/规格/FAQ 校验、地区码/启用语言、整页 en 回退/HIDE；PDP/CMS/search/sitemap 实库一致回归，各语言 noindex 独立影响索引及 hreflang。无完整固定字典的模板整页回退并保留市场/查询，不宣传任意语言均已翻译。 |
| ACC-008 | 移动无横向溢出，筛选/表格/表单/图片可用 | 本机Chromium/WebKit六宽及主要流程已通过；真实iOS/Android操作外部验收。 |
| ACC-009 | 主要表单双端校验、反垃圾、反馈 | DTO字段错误+request_id、表单required/labels、honey/速率限制/幂等、并发token；contact/registration/terms/checkout/CMS API回归，最终浏览器输入错误与焦点另录。 |
| ACC-010 | 敏感文件与后台接口权限 | roles/identity/b2b/media实库跨角色/跨企业回归，独立注册文件层级、资质扫描和签名；未登录或未授权取原文件失败。 |

## 已实际运行的局部证据（不得相加为整合总数）

| 时间/范围 | 结果和边界 |
| --- | --- |
| 2026-09-07 23:34，identity/b2b/dealer-lifecycle/media-lifecycle | 4文件54/54通过，包含条款和目录待审快照；随后有局部修改重跑如下。 |
| 23:37，dealer-lifecycle | 6/6通过：新增公开目录字段/审批/MFA/陈旧审核409/拒绝保留旧稿/隐私退出，分类授权与sitemap。 |
| 23:43，identity-flow + media-lifecycle | 25/25通过：未接受dealerterms仍可REGISTERED下载，企业资料拒绝；接受后开放，双重并发只记一次。 |
| 早前 Contact/public/auth/platform 局部 | contact-triage6、身份/认证/提交合计33以及platform14、单测24、redirect2，详见operations；新增platform用例以最终完整重跑为准。 |
| 2026-09-07 23:48，商品/订单/购物车/定价/导航/platform 单测 | 11 套件 55 项通过，见 [商品与零售实施记录](../commerce/retail-completion-20260907.md)。不含之后的完整整合验证。 |
| 23:49，retail-commerce/order-flow/catalog-smoke/cms-associations | 4 套件 36 项通过；23:52 最后逐语言 SEO 调整后 cms-associations/platform-flow 两套件 20 项再次通过，包含 FAQ 关联/排序/恢复、完整译文、逐语言 noindex。两次结果不相加。 |
| 2026-09-08 00:10 / 00:14，商品最终补充 | catalog-operations/retail-commerce/catalog-smoke 三套件 35 项通过；00:14 最后 CSV 公式处理及公开关联投影后 catalog-operations 3 项通过，API/Web 类型检查通过。覆盖分类 SEO/循环、三类关联的发布与市场隔离、批量分类标签/空值/冲突/原子失败。新增两份浏览器场景待最终整合运行。 |
| 00:11 / 00:12，USR-007 私有售后证据 | return-evidence/media 两套件 10/10；随后身份/经销商/真实 Mailpit/售后图片/媒体五套件 39/39。见 [售后私有照片记录](../commerce/return-evidence-20260908.md)，含真实下载字节、归属/权限/扫描状态、行绑定、未提交移除及过期清理；计数有重叠。 |
| 00:16，PDP-002 评分开关 | product-rating 两项实库回归通过；与 B2B 售后同跑合计 8 项不可重复累计。见 [经销商与媒体记录](../operations/b2b-media-notifications-20260907.md)，覆盖默认关闭/零条/范围/来源/权限/复制清零，最终评分浏览器场景已在Chromium/WebKit通过。 |
| 00:27，关联媒体变体授权 | media-lifecycle 8/8 实库通过，含企业 variantIds 限制、空授权/他产品 SKU/停用 SKU/跨企业拒绝和无 SKU 默认资料；签名只绑定资源 ID 与到期时间，授权在签发时校验。 |
| 运维 | Compose 配置、备份/扫描协议、隔离 DB metrics、真实 ClamAV 与 PITR 演练；00:24 逻辑加密恢复 62 表核对，mediaRestored=false。详见 [运维记录](../production-operations.md)，不把局部镜像演练作为最终整合版本部署通过。 |

最终未关闭项应记录清楚“需要开发修复”“已实现待最终运行”“需要真实外部资源”。发现可开发缺口必须回到实现，不把缺功能写成用户需提供凭据；真实公司资料、业务法定条款、合同/税率、商户、原站数据、设备与连续生产运行证据则不能靠编造完成。

课程⑦是**代码**，已修正 `docs/README.md`、`docs/delivery-readiness.md` 和工作量模板。操作手册另列；五人报告、真实会议、PPT、签字和实际贡献证明继续按课程范围处理，本轮不编造。

## 2026-09-08 整合验收补充

| 范围 | 最后实际结果 |
| --- | --- |
| 依赖、类型、静态检查、构建 | npm ci 成功；API/Web 类型和 lint 通过；110 单测通过；API 与 Next production build 成功，production audit 0 漏洞。 |
| 空库与数据库/邮件 | wemove_install_20260907 从空库应用29迁移；21文件168项全部通过。实际SMTP经Mailpit收信，不复用旧42项计数。 |
| MFA 时段边界 | 先在固定时间复现边界前签发、边界后提交返回40301，再加入仅过去30秒/未来0容差；有效边界码、过期/未来拒绝及HTTP敏感写验证通过。错误次数限制保持不变。 |
| 浏览器与HTTPS | 生产Secure/HttpOnly Cookie保持不变；本机新增只绑定loopback的临时TLS代理，自签证书仅测试上下文信任。修正HTTP下WebKit拒收Secure Cookie的测试环境问题，本机44场景完成：42项完整HTTPS回归通过，2项经销商真实完整流程在修正测试定位/等待后两引擎均通过；远端完整结果记录于PR Checks及artifact。 |
| Lighthouse实验 | 2026-09-08 00:37，四模板各三次冷启动；LCP中位数2204/1729/2356/2194ms，CLS均0，性能98–100，accessibility100；五接口各30样本/5并发，P95最大110ms。完整样本保留在CI artifact的lighthouse目录；这是实验室数据，不是现场INP或公网SLA。 |
| 生产镜像实际运行 | 01:00含最后SKU兼容和MFA修复的API/migrate镜像及最终Web镜像运行通过，空库29迁移，API ready、Web main、同源代理200，匿名私有接口401。另真ClamAV、pgBackRest full/diff/WAL指定时间恢复通过。 |
| 完整加密恢复 | 隔离Compose真实停API→备份→恢复新库/新媒体卷→恢复API健康；62表逐表行数一致、4096字节随机媒体文件SHA256/字节一致；没有覆盖原业务数据。 |
| 无法由本机代替的事项 | 见[真实资源及人工验收清单](external-acceptance-prerequisites.md)，包括商户/条款和原站数据、域名与邮件、异地切流、真机、人工无障碍、真实用户性能和月度可用率、课程本人材料。 |

CSV导入最后修复：SKU去空格/大写在预览、匹配、重复检查及提交中一致；历史大小写记录按原ID更新，多个同义SKU明确拒绝整批，避免导入后Quick Order找不到。真实HTTP导入→授权QuickOrder、预览/重复/历史冲突回归已通过；01:03最后完整回归21文件168项全部通过；最终CI仍从空库复现并按提交映射归档。

## 最后整合 CI 发现的问题与修复

[CI #47](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34146183488) 对源码 `ab7bccf` 的整合检出 `4d7de301` 验证了代码树一致、main 已纳入。110 单测、168 项数据库/邮件测试、Chromium/Firefox/WebKit 与性能共 67 项全部通过，生产镜像构建通过；但生产运行演练中的迁移容器失败，因此本次 CI **整体失败**，不能作为最终交付通过证据。[该轮 artifact](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34146183488/artifacts/10027957820) 保留源码映射、截图、浏览器和性能报告。

该轮四模板三次冷浏览器 Lighthouse 的 LCP 中位数为 2220/2287/2368/2215ms，CLS 全为 0；五个公开接口各 30 样本，API P95 最大 36ms。Linux Firefox 实际运行成功；本机 Windows 启动问题不再阻塞自动化三引擎验证，真实设备和人工验收仍按独立清单处理。

迁移失败已复现为 CI 的宿主 `DATABASE_URL` 优先于 Compose `--env-file`，使新容器连接 `localhost:5432`。演练现在隔离全部 Compose 输入及 `COMPOSE_*`，启动前检查数据库/外部资源/worker 配置，并在失败时采集脱敏日志；真实 Compose 回归和受干扰环境下的启动、数据库与媒体恢复验证见运维记录。

同时修复最后复核发现的零售退款协议缺口：首次与自动重试统一核对退款、订单、原付款、金额、币种及非空退款流水。错误响应保留原待确认记录并告警，重试沿用同一幂等 ID，并发仅确认一次。01:25 的零售 29/29 实库测试与 API 类型/构建通过，包含真实 HTTP 供应商先执行后返回错误响应的回归。该代码变化不归类为缺商户凭据，完整请求/响应协议已更新。

这两项修复包含于本表同次提交；只有后续当前 head 的全部 CI 步骤成功，才关闭最终自动化整合项。最终源码 SHA、main SHA、CI 检出 SHA 和测试树继续通过 `acceptance-revision.json` 核对，不复用旧 #44 或失败 #47。
