# C1 数据字典历史交付与当前差异复核

复核日期：2026-09-08。本页核对已有 Git 材料及当前源码，不运行数据库或软件测试，不替代当前全量数据字典，也不认定成员已签收终稿。

## 1. 来源与归档

周慧莹已提交数据字典 v1.0，不能因文件不在当前 head 就写成“未提交”。来源是本地已有远程跟踪分支 `origin/feature/data-dictionary-c`：

| 项目 | 记录 |
| --- | --- |
| 提交 | `7c42b431362b8617fb17705643ef4039fe1a0428`，2026-09-07 12:31:05 +08:00 |
| 提交标题 | `docs(data-dictionary): C1 数据字典复核交付 v1.0` |
| 原路径 | `docs/data-dictionary.md` |
| 原文署名与基线 | 组员 C（周慧莹）；自标 `schema.prisma @ main ceac929` |
| 原始字节归档 | [数据字典 v1.0 历史稿](../archive/member-submissions-20260908/数据字典_周慧莹_C1-v1.0_历史.md) |
| 字节与 Git blob | 9450 字节；原路径与归档均为 `bfd0d7dbc9ddfe0961fce41e996c86ecdde254cf` |
| SHA-256 | `dbde7176bc9123d8c2ac89044ebe360a0ac5460ef344615eec8228ca70ee5cb3` |

归档直接读取 Git blob 的原始字节，没有重排空行、改写转义 Markdown 或覆盖作者原文。原稿中的“通过”“待改进”、与朱容杰协作及“B/C 例会决议”标题属于当时文件陈述，不据此新增会议事实或当前完成证明。

## 2. 历史覆盖与现有基线

原稿列出 10 个模型：`ProductCategory`、`Product`、`ProductVariant`、`Stock`、`PriceBook`、`PricingRule`、`Cart`、`CartItem`、`Order`、`OrderItem`，覆盖当时商品、价格和零售订单核心字段，另附业务约定与改进建议。该历史分支的完整 schema 有 26 个 Prisma 模型、7 份迁移；因此原稿本身也不是当时全站所有模型的逐字段字典。

本次对照的整合源码为 `0d33eef`，当前 [Prisma schema](../../apps/api/prisma/schema.prisma) 有 **61 个模型**、[迁移目录](../../apps/api/prisma/migrations) 有 **29 份 migration.sql**。CI #49 恢复报告记录 **62 张物理表**，其计数读取 public 下全部普通/分区表，包含 Prisma 的 `_prisma_migrations` 管理表；不能把 62 写成 Prisma 业务模型数。计数口径见 [备份代码](../../scripts/ops-backup-lib.mjs) 与 [CI #49 证据](../evidence/ci49/README.md)。本轮没有重新执行该 CI。

历史分支的接口材料是已有 [apps/api/README.md](../../apps/api/README.md) 的阶段性 API 一览，最后相关提交为 `9bb71dd`（2026-09-07 04:35:55 +08:00）；该分支没有另一份独立完整接口交接稿。现有 API README、各模块 DTO/Controller 和模块实施记录可用于补齐接口对应关系，不能把旧 API 一览当作新增接口全部同步完毕。

## 3. 当前关键差异

以下是需要同步的主要变化，不是完整字段清单，也不是新的开发任务。

| 域 / 模型 | 原稿状态 | 当前字段或行为 |
| --- | --- | --- |
| `ProductCategory` | 编码、名称、层级、启用、排序 | 新增 `attributeTemplate`、`filterableFields`、`description`、`coverImage`、`seo`，须补属性模板及 SEO 的 JSON 约束。 |
| `Product` | DRAFT/ACTIVE/ARCHIVED 与基础展示字段 | 现有五状态，新增 SCHEDULED/HIDDEN；`ageMin/ageMax`、`scenes/skills/tags/markets`、`publishAt/unpublishAt`、`specifications`、`playGuide`、`productFaq`、`associations` 等。关联类型、译文状态/完整性和评分配置不能只注明“Json”。 |
| `ProductVariant` | 基础 SKU、价格、重量 | 新增唯一 `barcode`、`availabilityPolicy`、`backorderLimit`、`leadTimeDays`、`marketPrices` 及市场库存关系；SKU 输入统一 trim/大写，导入同样执行冲突检查。 |
| `Stock` / `MarketInventory` | 全局 available/reserved；预警列为待改进 | 现有 `lowThreshold`、`source`、`sourceUpdatedAt`、`syncError`；新增市场池，交易同时预留全局和适用市场库存。付款后仍预留至发货，原稿“下单未支付”不能作为 reserved 的完整定义。 |
| `PricingRule` / `PriceBook` | 有效期、币种、企业价表授权待补 | 已有 `market`、`currency`、`startsAt/endsAt` 与 `DealerPriceBook` 企业授权。实际字段不叫 effectiveFrom/effectiveTo；默认币种是 USD，实际以市场/合同为准。 |
| `Cart` / `CartItem` | 用户购物车、行价格快照 | `Cart.mergeKeys` 用于游客车幂等合并；结算重新计算服务器价格，不能把 CartItem 加购价当作最终成交价。 |
| `Order` / `OrderItem` | 基础状态和合计；支付/税运拆分待补 | 已有 `paymentStatus`、`currency/market`、`discountCents/shippingCents/taxCents`、优惠码、收货/账单地址、`calculationSnapshot`、预占到期及支付/履约/售后关系。行新增 `priceSource`、`weightGrams`、已发/已退数量。paymentStatus 当前为 String，不应写成已有 Prisma 枚举。 |
| 零售新增模型 | 未列 | `RetailMarket/Coupon/Payment/PaymentEvent/Shipment/Return/Refund/PriceHistory`；支付和退款有独立幂等流水，售后有按行说明及私有附件。 |
| 企业新增模型 | 授权、RFQ 版本及 PO 快照列为待协作 | `DealerPriceBook/Rfq/Quote`、`PurchaseOrder/Item/Shipment/Payment/PaymentEvent/Return/ReturnItem/Refund`；另有企业地址、邀请、申请草稿和采购车。零售与企业售后使用独立模型。 |
| 身份与内容运营 | 原稿未覆盖 | `AuthenticationSession`、`StaffLoginChallenge`、`AccountAddress/Favorite/PrivacyRequest`；`CmsRevision`、`SiteSetting/SiteRedirect`、`AnalyticsEvent`、`NewsletterSubscription`、`NotificationOutbox` 等新增模型与现有用户/媒体/CMS字段。 |

原稿“所有业务表都有 createdAt/updatedAt”“所有 dealer 数据都有 companyId”等是过度概括；当前例如 `Stock` 只有 updatedAt、`PriceBook` 只有 createdAt，部分子项通过订单关系归属企业。最终字典须逐模型列出实际字段、关系和权限边界，不能照抄统一断言。历史建议中的替代实现也应如实记载，例如图库仍为 JSON 配合服务端引用校验，不应写成已迁移为独立关系表。

商品/零售的细化规则见 [零售实施记录](../commerce/retail-completion-20260907.md)，售后附件见 [私有售后照片记录](../commerce/return-evidence-20260908.md)，企业/媒体/通知见 [操作补充](../operations/b2b-media-notifications-20260907.md)。DTO/Controller 位于 [catalog](../../apps/api/src/catalog)、[order](../../apps/api/src/order)、[dealer](../../apps/api/src/dealer)、[account](../../apps/api/src/account)，数据库约束以迁移 SQL 和当前 schema 为准。

## 4. 仍需完成的文档与验收

- 当前完整字典仍需在 C 的历史 v1.0 基础上同步全部新增模型和既有变更字段，补 JSON 结构、枚举/业务值域、默认值、唯一/索引/外键、删除策略及敏感字段说明；本差异页不能替代该终稿。
- 后续接口交接需逐项关联请求 DTO、响应投影、角色/动作权限、MFA、错误码、幂等及事务规则，并由相关成员复核；不能把原责任分工自动等同个人独立代码贡献。
- CI #49 的迁移/自动化/恢复证据已归档，但字典准确性及业务数据仍需人工签收。真实商户、税票、批准合同/价格、正式素材与上线资源按 [外部验收前提](../plans/external-acceptance-prerequisites.md) 核对，不用实验室结果代替正式验收。

历史交付已被发现、审核并保留；上述同步与签收是当前剩余项，不再表述为“C 从未提交数据字典”。
