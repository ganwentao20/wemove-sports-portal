# 零售、商品与库存实施记录（2026-09-07）

本记录对应原始需求 A03/A06、C01–C06、ADM-P、ADM-PR、ADM-O 与 §7.6/9。它记录已运行的实现和验证边界；整合版的最终构建、全项目测试、浏览器与无障碍验收以根任务记录为准，不能沿用开发分支 CI #44 作为整合验收。

## 已实现流程

| 范围 | 当前实现与入口 |
| --- | --- |
| 商品与分类 | `/products` 多维结构化筛选、分类控制筛选字段、五种排序、URL 分页、组合页 noindex；PDP 规格/玩法/安全说明/FAQ/公共资料、缩略图与移动滑动、视频、变体媒体切换、最多四件比较及差异高亮、分享 URL。已认证经销商 PDP 使用授权目录、有效企业价格/MOQ/箱规，直接加经销商购物车或申请报价；未授权会员不会回落到零售购买按钮。 |
| 商品运营 | `/admin/products` 五种状态、定时发布/下架、市场可见性、年龄/场景/技能/标签、分类属性模板与类型校验、独立 SKU 条码唯一、图库拖拽/键盘排序、逐图语言/市场与 alt、变体媒体属性、可新增语言的结构化译文编辑与发布、复制为库存零的草稿、CSV 导入预览/错误/原子提交/导出、价格变更审计、旧 slug 重定向；源语言和每个译文可独立维护搜索标题/描述、社交标题/描述/图片、canonical 与 noindex，商品 H1 保持独立。 |
| 价格与市场 | `/admin/pricing` 市场/币种、零售开关、市场 SKU MSRP/Sale 与有效期、经销商规则及有效期、百分比/固定额/免运费优惠，限制市场/商品/用户/最低金额/使用次数；已有规则和优惠可编辑，空白可清除日期/数量上限/市场限制/免运费阈值；省略字段保留原限制，价格由服务器最终重算。 |
| 游客与结算 | `/cart`、`/checkout` 游客本机购物车、登录后幂等合并、合并失败可改数量/移除再重试、账户地址选择、独立收货/账单快照、配送方式、优惠、重算价差提示；关闭零售的市场只提供经销商查找与联系入口。 |
| 支付 | 待支付订单、明确标识的 DEMO 会话，以及 HTTPS 商户适配服务会话；金额/币种/订单绑定，签名回调、事件去重、幂等会话、失败重试。真实迟到扣款不会重新确认已释放库存的订单，而是形成持久化补偿退款。 |
| 订单与履约 | 客户 `/orders/:id`、后台 `/admin/orders/:id`；数量级部分发货、物流商/运单号/追踪链接、取消状态检查及原因审计、退款余额上限、退货批准/拒绝/收货/完成、收到退货后回库、换货补发、当前价格再次购买、人工订单不覆盖用户购物车、权限控制的 CSV 导出。 |
| 单据 | JSON 记录供集成使用；客户与后台鉴权 PDF 发票记录/收据/装箱单下载。PDF 由根任务补充，含中英文字体；未付款不能领取付款收据。 |
| 库存 | 统一 `InventoryService`，全局库存与可选市场分配池同时预占/释放/发货/回库，固定锁顺序；SKU/市场双重预售与欠货许可、限量及预计发货天数；补货前禁止发出不存在的实物库存；低库存和源同步失败告警；同步失败保存旧数值但前台停止新购买。 |
| 税运费 | 独立 `TaxShippingService`，固定运费、按重量/折后金额区间、免运费阈值、地区税率覆盖、可选签名 HTTPS 税务/实时运价适配服务；订单固化税/运费/计价来源、SKU 成交价来源及重量快照。 |
| 隔离与通知 | 客户订单路由明确拒绝员工 token，员工须走有权限的后台入口；不显示其他客户订单。下单/支付/发货/取消/售后/退款进入通知队列；内部库存/支付异常告警使用配置的 orders 收件组；匿名统计遵守分析 Cookie 同意。 |

## 自动工作与库存含义

`CommerceService.onModuleInit` 每 60 秒运行到期释放、待处理真实退款重试、库存告警；进程退出时清理定时器。没有 API 进程运行时，这些任务不会执行。生产部署应保持 API 服务运行并配置进程重启与监控。

`Stock.available` 是扣除预占后的可售净数量，`reserved` 是尚未出库的已预占数量。启用限量预售/欠货时净可售量允许为负，代表需要补货的数量；`available + reserved` 不足的货不能出库。后台补货输入仍然是扣除现有预占后的可售量。

`MarketInventory(variantId, market)` 是可选市场分配池；存在时交易同时消耗它和全局池，不能从其他市场的分配量超卖。没有对应行则沿用全局池。新增市场池要求该 SKU 的全局预占为零，防止旧订单释放到后来建立的分配池；不提供删除活跃池的快捷入口。企业订单使用下单时市场快照，之后修改企业国家不会改变原预占归属。

库存维护使用 `POST /admin/commerce/inventory/:variantId`（市场池）和 `PATCH /admin/catalog/variants/:id`（全局池/策略）。报告同步失败时不得同时覆盖旧数量；健康数量更新解除失败状态。当前采用文档允许的不接 ERP 的简化数量方案。

## 商户和报价服务适配契约

所有金额为币种最小单位整数。下列变量只写在部署密钥配置中，不放入商品数据或公开配置：

| 能力 | 服务端变量与协议 |
| --- | --- |
| 零售支付 | `PAYMENT_PROVIDER_URL`、`PAYMENT_PROVIDER_KEY`、`PAYMENT_WEBHOOK_SECRET`、`PAYMENT_WEBHOOK_URL`、`WEB_ORIGIN`。生产环境 DEMO 默认被拒绝；仅显式 `ALLOW_DEMO_PAYMENTS=true` 才允许。 |
| 创建支付 | 向适配服务 `POST /sessions`：`paymentId,idempotencyKey,amountCents,currency,returnUrl,webhookUrl`；成功返回 HTTPS `checkoutUrl` 和 `reference`。 |
| 退款 | 向适配服务 `POST /refunds`：`refundId,idempotencyKey,orderId,amountCents,reason`；返回 `status=PENDING/SUCCEEDED/FAILED` 和 `reference`。重复请求必须按稳定的退款 ID 幂等处理。 |
| 出站支付签名 | `x-payment-timestamp` 为毫秒时间戳；`x-payment-signature` 为 `HMAC-SHA256(key, timestamp + "." + 原始 JSON body)` 的十六进制；同时发送 `idempotency-key`。HTTPS、禁止重定向、15 秒超时。 |
| 入站支付回调 | `POST /commerce/payment-webhook` 接收 `eventId,paymentId,status,amountCents,currency,providerReference`。签名串为 `timestamp + "." + JSON.stringify([eventId,paymentId,status,amountCents,currency,providerReference])`，用 `PAYMENT_WEBHOOK_SECRET` 签名；时间窗口 ±5 分钟。相同事件不同载荷会拒绝，真实金额/币种必须匹配。 |
| 税/实时运价 | `TAX_PROVIDER_URL/KEY`、`SHIPPING_PROVIDER_URL/KEY`；HTTP 模式向配置的完整 HTTPS URL POST 报价。返回 `amountCents,currency,reference`。头部 `x-quote-timestamp/x-quote-signature` 用原始 JSON body 及相同 HMAC 规则，3 秒超时，币种必须一致。 |

支付适配服务不可把 DEMO 成功当成真实扣款。当前未指定并接通实际商户；生产收款仍需选定商户、提供密钥、实现其协议到上述适配契约的映射，并完成实际支付/退款/回调验收。税务和物流外部模式同理。现有配置计算器、手工物流与演示支付可以独立完整运行。

PDF 是站内交易凭据。法定税务票据编号、认证开票系统及当地有效税率需要由业务选择和配置；当前不声称已经连接税务机关或真实开票商。

## 语言发布策略

产品源语言为英文。`specifications.translations[locale]` 支持简化 BCP47 代码 `^[a-z]{2,3}(?:-[A-Z]{2})?$`，例如 `zh`、`fr`、`de`、`zh-CN`，并受站点启用语言控制。译文必须为 `status=PUBLISHED`，含非空名称/摘要；源说明、年龄建议、玩法存在时必须完整翻译。每个源 primitive 规格必须有 `{label,value}`，每条源 FAQ 必须有完整对应问答且条数相同。后台结构化编辑器支持 Not Started、In Progress、Ready、Published 四阶段及删除语言；Ready 要求完整但不会公开，Published 才公开，旧 DRAFT 数据按 In Progress 编辑。不能发布半份译文。

公开输出剥离原始 `translations`，返回实际 `locale` 和 `publishedLanguages`。`catalog/product-locales.ts` 的 `publishedProductLanguages({specifications,description?,ageGuidance?,playGuide?,productFaq?})` 供商品与 sitemap 使用；`platform/search-query.ts` 的 SQL predicate 执行相同状态、类型、规格与 FAQ 条件。`indexableProductLanguages` 另按每个语言实际 SEO 计算可索引语言，PDP hreflang 与 sitemap 使用它，noindex 不阻止用户访问或站内搜索。真实 PostgreSQL 回归已检查二者一致；历史直接导入的半份译文也不会泄露。

站点 `SiteSetting.locale` 决定缺失译文时 `DEFAULT` 整页回退或 `HIDE` 隐藏。PDP 固定界面支持 English/中文/Français/Deutsch 及其地区码，缺少完整正文或固定界面字典的语言会跳转实际可用的英文整页，保留市场。PLP 固定界面当前完整提供英文，其它语言路径整页回退并保留筛选参数；不编造真实商品翻译。

图库按“语言+市场 → 语言 → 市场 → 全局”选择最具体的一组，保持编辑排序，公开输出不附带定位元数据。无匹配的专属图片不会泄露到其他语言/市场；旧字符串图库仍可使用。购物车修改数量与添加/合并/结算共用市场价格和预售/欠货容量策略。

## 数据变更

零售基础迁移 `20260907040000_retail_commerce`；商品状态/模板 `20260907182000_catalog_states_templates`；市场库存/条码/配送策略 `20260907240000_market_inventory_delivery`；计算来源快照 `20260907260000_order_calculation_evidence`。CMS 补充迁移 `20260907330000_cms_sort_order` 新增 `CmsPage.sortOrder` 与 `(kind,sortOrder)` 索引。上述迁移已由根任务部署到独立验收数据库，未重置原本地数据库。

## 验证证据

在独立数据库 `wemove_verify_20260907` 与独立 Redis DB 3 下运行：

- API 与 Web：2026-09-07 23:52，`npx tsc --noEmit` 均通过。商品/零售路径 oxlint 0 error（现有风格 warning 不阻断）。
- `npx vitest run src/order src/cart src/pricing src/catalog src/platform/navigation-policy.spec.ts src/platform/platform.spec.ts`：2026-09-07 23:48，11 个套件、55 个测试通过。
- `vitest run --config vitest.config.e2e.ts test/retail-commerce.e2e-spec.ts test/order-flow.e2e-spec.ts test/catalog-smoke.e2e-spec.ts test/cms-associations.e2e-spec.ts --maxWorkers=1 --no-file-parallelism`：2026-09-07 23:49，4 个套件、36 个测试通过（零售 27，原订单/目录 6，内容关联与 SEO 3）。`cms-associations` 与根任务 `platform-flow` 在最后 CMS hreflang 调整后于 23:52 再验，2 套件、20 项通过。
- 端到端覆盖：最新价/地址/税费快照、关闭零售、游客幂等合并、签名篡改/重复事件、支付失败再试、部分发货、跨用户隔离、退货/退款/换货、到期释放、迟到真实扣款补偿、币种/过滤/定时状态、CSV 预览/复制/审计、人工订单、同步故障降级/恢复、指定商品集合、分市场并发不超卖、限量欠货与补货限制、重量运费/地区税率、条码唯一、员工绕过顾客入口拒绝、真实 PDF、完整规格/FAQ 译文与草稿隔离、法文/地区码语言、SQL 搜索与 sitemap 一致、图库定位选择、可空限制的清空和省略保留、欠货购物车数量编辑、独立商品 SEO/译文 SEO、FAQ 顺序与产品筛选、内容修订恢复排序及关联、译文 Ready 与 Published 隔离、逐语言 sitemap/noindex/hreflang 一致。

整合后的完整 CI、生产构建与浏览器结果由根任务统一复测；本文件不会以以上单域测试替代全项目验收。

## 原文追加核查后的内容与导航补充

本批按根任务授权补齐 HOME-001/004、FE-001/002/003、§4.9、§10.1、§12.1/12.2：

- Hero 可用视频源与封面、桌面/移动图片、左/中/右内容对齐和双 CTA；所有模块支持独立启用及上线/下线时段。日期必须为含时区的有效 ISO 时间，拒绝不存在的日期。公共 API 会去除尚未生效/已过期/禁用模块，根任务已同步搜索与缓存时段处理。
- 文章集合支持选择最多 24 篇文章并维护次序；模块编辑器保留分类自动选择。公告可设为允许关闭或固定展示。
- Header 滚动后收缩；后台导航支持两级、语言标签、市场、顺序；手机使用带原生焦点约束、Escape 关闭和焦点恢复的侧边抽屉，明确区分客户账户与经销商登录。
- CMS 顶层关联商品使用可搜索选择器，最多 24 件并可排序；内容编辑员读取关联选择接口时只获得 ID、名称、slug 和状态。文章详情自动展示关联商品卡。
- FAQ 具备持久化显示顺序、分类、关键词和产品筛选。关联产品的问答与公共问答合并到该商品 PDP；只合并实际语言一致的已发布问答。修订恢复会恢复商品关联及顺序。
- 产品和 CMS 每种语言的 noindex 分别影响 sitemap/hreflang；源语言 noindex 不会错误屏蔽另一种明确允许索引的已发布译文。公共 API 只输出可公开的语言元数据。

新增浏览器场景 `tests/browser/content-navigation.spec.ts` 覆盖模块时段、Hero 视频 DOM 配置、文章选择、Header 收缩、二级抽屉/Escape/焦点恢复、商品独立 metadata、FAQ 顺序与关联商品卡。此场景交由根任务在重建整合版后运行；它没有真实视频文件，因此不能作为视频实际播放验收。根任务已反馈独立真实浏览器的游客合并→结算→DEMO 支付→鉴权 PDF 下载成功；付款后可售 9/预留 1（初始 10）的断言符合本文库存定义，发货后才减少预留。

上一批于 2026-09-07 23:54 冻结；之后按原文独立核查继续完成下列补充。最终完整 CI、浏览器、响应式、无障碍与性能证据以根任务整合记录为准。

## 2026-09-08 商品核查补充与最终冻结

| 原文要求 | 已补充的实际行为 |
| --- | --- |
| §7.4 分类内容 | `/admin/products` 的 Category pages 可创建和编辑名称、代码、slug、父分类、状态、顺序、描述、封面及 alt、独立 SEO/OG/canonical/noindex。层级更新拒绝循环。公开 `/categories?market=US` 返回生效分类的内容及该市场商品数量；`/en/products?category=...&market=...` 展示分类 H1、说明、封面和独立元信息，sitemap 排除隐藏与 noindex 分类。 |
| ADM-P-008 关联类型 | `Product.associations` 为 `{type:RELATED\|ACCESSORY\|REPLACEMENT,slug}` 数组。编辑器维护相关、配件、替换件；PDP 分组展示，公开 API 只返回已经发布且该市场可见的目标，剥离原始关联配置。旧 `relatedSlugs` 兼容保留，复制草稿保留明确关联。 |
| ADM-P-009 批量分类/标签 | CSV 新增 `categorySlug` 和 `tags`（以 `\|` 分隔）。预览显示字段与影响行数；省略列保留已有数据，空分类或空标签数组明确清空；未找到分类、同一产品多 SKU 行配置冲突、属性模板不符时不执行整个批次。导出含这两列并中和表格公式。价格/库存/状态仍使用原先原子提交与审计流程。 |
| PLP-001 经销商入口 | 存在经销商会话的公开商品列表显示“Check dealer price and minimum order”及授权目录入口。该提示本身不包含企业价格；目录和 PDP 取价仍由服务端验证成员、企业、市场和商品授权。 |
| PLP-006 空结果 | 清除筛选保留市场，提供分类入口，以及按有效市场和发布状态取出的推荐商品；页面不出现空白区。默认排序选择框同时反映后台市场默认排序。 |

迁移 `20260907340000_retail_catalog_completion` 为分类新增 `description/coverImage/seo`，为产品新增 `associations`；根任务已在独立验收库和空库安装检查中部署并生成客户端。USR-007 售后说明/私有图片由身份模块使用独立后续迁移完成；PDP-009 权限资料由根任务接入；评分开关由经销商/媒体协作者单独完成，最终整合记录覆盖其验证。

- 2026-09-08 00:10：`catalog-operations`、`retail-commerce`、`catalog-smoke` 三个实际数据库套件共 35 项通过。
- 2026-09-08 00:14：API 和 Web 的 `npx tsc --noEmit` 均通过；最后 CSV 公式处理及公开关联投影调整后的 `catalog-operations` 三项数据库回归通过。
- 新增 `tests/browser/catalog-completion.spec.ts`：使用独立员工完成密码挑战/MFA，实际填写和保存分类表单与 SEO，验证公开分类内容/元信息、PDP 配件/替换件、空结果导航/推荐、经销商会话提示。采购权限本身由原有经销商流程验证；此测试的提示断言仅验证显示逻辑。

最终冻结于 2026-09-08 00:16。没有本模块仍运行的进程、没有提交或推送；新增两份浏览器用例需由根任务在整合重建后统一运行。本记录中的分域测试不替代最终 SHA 的完整 CI。

## 2026-09-08 最终整合发现的 MFA 时间边界修复

根任务全量数据库运行的 166 项中，零售最后一条商品模板写入收到 403；原日志未包含响应体，不能直接认定那次响应的业务码。原零售 27 项随后在独立安装库重跑通过，但这不能关闭偶发失败。

新增确定时间的真实 HTTP 回归：使用时段结束前一秒生成的动态码，把服务器时间固定在下一时段开始后一毫秒，请求相同的受保护商品写接口。修改前稳定返回 `40301 invalid MFA code`，证据 `.local/mfa-boundary-before.log`。原因是 otplib 13 的默认校验没有时间容差，请求传输跨越 30 秒时段时会拒绝刚生成的码。

`MfaService.verifyCode` 改用 otplib 13 的秒单位 `epochTolerance: [30, 0]`，接受当前和前一个时段，不接受未来时段。连续错误五次锁定 15 分钟及生产 Redis 故障关闭策略均保留。新增单元测试固定时钟，检查当前/前一步有效、未来/两步前无效，以及前一步码到再下一边界失效；受保护 HTTP 写操作仍要求有效会话、权限和 MFA，没有重试绕过或放宽预期状态。

2026-09-08 00:43 验证：MFA/RBAC 两套件 14/14、零售完整 28/28、API 类型检查通过。真实数据库范围仅 `wemove_install_20260907` 和 Redis DB 4，不使用正在浏览器验收的库；临时 Nest 应用随测试关闭。日志 `.local/mfa-boundary-unit.log` 和 `.local/mfa-boundary-retail.log`。最终整合全套、API/迁移镜像重建与运行仍由根任务统一重验。

## 2026-09-08 CSV SKU 规范化补充

CSV 导入原先直接保存原始 SKU，而常规创建和经销商 Quick Order 使用去空格、大写规则，因此导入小写 SKU 后快速下单无法查到。现于 `importProducts` 入口统一规范化，预览计数、重复行、归属冲突、现存查找与原子写入使用同一值；空 SKU 和大小写重复拒绝整批。

历史小写或带前后空格的 SKU 使用参数化查询按规范值找到原记录，按原 ID 更新并规范化，不产生第二个变体。历史数据若已有多个规范值相同的 SKU，则返回明确冲突，整批不写入，要求运营先核对重复业务记录；不会擅自合并库存、报价或订单引用。

2026-09-08 00:58：`catalog-operations` 4 项及 `retail-commerce` 28 项共 32/32 实库通过，API 类型检查通过。新增场景经真实导入接口检查小写创建/预览更新、跨商品归属冲突、大小写重复批次不改变价格库存且不新增其他行、空值拒绝、历史 SKU 保留 ID 和冲突拒绝，最后通过已授权经销商的 Quick Order HTTP 接口取得该 SKU 有效价格。证据 `.local/catalog-sku-normalization.log`；运行仅安装验收库和 Redis DB 4，无常驻 API、无 Web 或迁移修改。最终 API/迁移镜像需包含该修复并重新验证。
