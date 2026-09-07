# C1 数据字典：当前完整结构与历史复核

更新日期：2026-09-08。第 1–4 节保留历史交付复核背景，第 5–8 节补齐当前结构、业务约束和接口定位；不认定成员已签收终稿。

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

## 4. 历史复核时的剩余项（结构同步已在第 5–8 节完成）

- 当前完整字典仍需在 C 的历史 v1.0 基础上同步全部新增模型和既有变更字段，补 JSON 结构、枚举/业务值域、默认值、唯一/索引/外键、删除策略及敏感字段说明；本差异页不能替代该终稿。
- 后续接口交接需逐项关联请求 DTO、响应投影、角色/动作权限、MFA、错误码、幂等及事务规则，并由相关成员复核；不能把原责任分工自动等同个人独立代码贡献。
- CI #49 的迁移/自动化/恢复证据已归档，但字典准确性及业务数据仍需人工签收。真实商户、税票、批准合同/价格、正式素材与上线资源按 [外部验收前提](../plans/external-acceptance-prerequisites.md) 核对，不用实验室结果代替正式验收。

历史交付已被发现、审核并保留；上述同步与签收是当前剩余项，不再表述为“C 从未提交数据字典”。

## 5. 当前完整结构字典

本节由甘文韬整合时从当前 schema 逐字段同步，使用已生成 Prisma Client 的 DMMF 校验模型及字段覆盖；不改写周慧莹历史原稿，也不代替成员签收。共 **61 个模型**，含所有标量、枚举、关系字段与模型级约束。类型末尾 `?` 为可空，`[]` 为列表。关系字段是 Prisma 关联导航，不应当作额外物理列。未列 `@default` 表示 schema 未声明默认值，不能推断为数据库自动填充。

`@id` / `@@id` 为主键，`@unique` / `@@unique` 为唯一约束；`@@index` 为索引；`@relation` 保留外键字段、目标、删除策略等原始声明。未显式声明的删除策略由 Prisma/迁移定义决定，不虚构 Cascade。金额的币种、业务状态机和 JSON 内部约束见第 7 节。

### DealerPriceBook

[schema 原始定义](../../apps/api/prisma/schema.prisma#L44)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `bookId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany` | `@relation(fields: [companyId], references: [id], onDelete: Cascade)` | 关联导航 |
| `book` | `PriceBook` | `@relation(fields: [bookId], references: [id], onDelete: Cascade)` | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@id([companyId, bookId])`

### DealerRfq

[schema 原始定义](../../apps/api/prisma/schema.prisma#L54)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany` | `@relation(fields: [companyId], references: [id], onDelete: Restrict)` | 关联导航 |
| `createdById` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdBy` | `User` | `@relation(fields: [createdById], references: [id], onDelete: Restrict)` | 关联导航 |
| `title` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `note` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `targetDeliveryAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `attachmentIds` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `rejectionReason` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `RfqStatus` | `@default(DRAFT)` | 枚举值见第 6 节 |
| `revision` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `items` | `Json` | — | 业务结构见第 7 节；服务端生成的 SKU/名称/数量快照；报价不会修改原始询价。 |
| `quotes` | `DealerQuote[]` | — | 关联导航 |
| `purchaseOrder` | `PurchaseOrder?` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([companyId, createdAt])`；`@@index([status, createdAt])`

### DealerQuote

[schema 原始定义](../../apps/api/prisma/schema.prisma#L76)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `rfqId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `rfq` | `DealerRfq` | `@relation(fields: [rfqId], references: [id], onDelete: Cascade)` | 关联导航 |
| `version` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `items` | `Json` | — | 业务结构见第 7 节；不可变服务端商品/数量/报价快照，金额均为整数分。 |
| `subtotalCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `taxCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `discountCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentTerms` | `String` | `@default("PREPAID")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `deliveryTerms` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `totalCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | `@default("USD")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `validUntil` | `DateTime` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `quotedById` | `String` | — | 审计保留员工 ID；所有报价写入也记录事务审计。 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@unique([rfqId, version])`

### PurchaseOrder

[schema 原始定义](../../apps/api/prisma/schema.prisma#L96)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderNo` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany` | `@relation(fields: [companyId], references: [id], onDelete: Restrict)` | 关联导航 |
| `companyName` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `market` | `String` | `@default("US")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `inventoryReserved` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `cancellationReason` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `adjustments` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `createdById` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdBy` | `User` | `@relation(fields: [createdById], references: [id], onDelete: Restrict)` | 关联导航 |
| `rfqId` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `rfq` | `DealerRfq` | `@relation(fields: [rfqId], references: [id], onDelete: Restrict)` | 关联导航 |
| `quoteVersion` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `PurchaseOrderStatus` | `@default(PENDING_REVIEW)` | 枚举值见第 6 节 |
| `shippingAddress` | `Json` | — | 业务结构见第 7 节 |
| `billingAddress` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `customerPoNumber` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentMethod` | `String` | `@default("BANK_TRANSFER")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentTerms` | `String` | `@default("PREPAID")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentStatus` | `String` | `@default("UNPAID")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `payments` | `PurchaseOrderPayment[]` | — | 关联导航 |
| `returns` | `PurchaseOrderReturn[]` | — | 关联导航 |
| `refunds` | `PurchaseOrderRefund[]` | — | 关联导航 |
| `shipments` | `PurchaseOrderShipment[]` | — | 关联导航 |
| `subtotalCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `taxCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `totalCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | `@default("USD")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `items` | `PurchaseOrderItem[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([companyId, createdAt])`；`@@index([status, createdAt])`

### PurchaseOrderItem

[schema 原始定义](../../apps/api/prisma/schema.prisma#L134)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `PurchaseOrder` | `@relation(fields: [orderId], references: [id], onDelete: Cascade)` | 关联导航 |
| `variantId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variant` | `ProductVariant` | `@relation(fields: [variantId], references: [id], onDelete: Restrict)` | 关联导航 |
| `productName` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sku` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variantName` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `quantity` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippedQuantity` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `unitPriceCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `lineCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `returnItems` | `PurchaseOrderReturnItem[]` | — | 关联导航 |

模型级约束：`@@unique([orderId, variantId])`

### User

[schema 原始定义](../../apps/api/prisma/schema.prisma#L264)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `email` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `passwordHash` | `String` | — | 敏感字段，仅授权服务使用 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `ageConfirmed` | `Boolean` | `@default(false)` | 合规：成年人声明（详见合规红线） |
| `status` | `AccountStatus` | `@default(PENDING)` | 枚举值见第 6 节 |
| `authVersion` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `phone` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `displayName` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `country` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `productUpdates` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `termsVersion` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `privacyVersion` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `policiesAgreedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `policiesIp` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `locale` | `String` | `@default("en")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `marketingEmail` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `marketingSms` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `mfaSecret` | `String?` | — | 敏感字段，仅授权服务使用 |
| `mfaEnabled` | `Boolean` | `@default(false)` | 敏感字段，仅授权服务使用 |
| `addresses` | `AccountAddress[]` | — | 关联导航 |
| `favorites` | `AccountFavorite[]` | — | 关联导航 |
| `privacyRequests` | `AccountPrivacyRequest[]` | — | 关联导航 |
| `dealerMembers` | `DealerMember[]` | — | 关联导航 |
| `dealerApplications` | `DealerApplication[]` | — | 关联导航；本人提交的资质申请（归属判定依据） |
| `tokens` | `UserToken[]` | — | 关联导航 |
| `auditLogs` | `AuditLog[]` | `@relation("ActorCustomer")` | 关联导航 |
| `cart` | `Cart?` | — | 关联导航 |
| `orders` | `Order[]` | — | 关联导航 |
| `rfqs` | `DealerRfq[]` | — | 关联导航 |
| `purchaseOrders` | `PurchaseOrder[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([status])`

### Staff

[schema 原始定义](../../apps/api/prisma/schema.prisma#L303)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `email` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `passwordHash` | `String` | — | 敏感字段，仅授权服务使用 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `StaffStatus` | `@default(ACTIVE)` | 枚举值见第 6 节 |
| `authVersion` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `permissionOverrides` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `mfaSecret` | `String?` | — | 敏感字段，仅授权服务使用；MFA（TOTP）：敏感写操作二次认证；mfaSecret 为 base32，启用后仅经 TOTP 校验使用 |
| `mfaEnabled` | `Boolean` | `@default(false)` | 敏感字段，仅授权服务使用 |
| `mfaConfirmedAt` | `DateTime?` | — | 敏感字段，仅授权服务使用 |
| `roles` | `StaffRole[]` | — | 关联导航 |
| `mediaAssets` | `MediaAsset[]` | `@relation("Uploader")` | 关联导航 |
| `auditLogs` | `AuditLog[]` | `@relation("ActorStaff")` | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### Permission

[schema 原始定义](../../apps/api/prisma/schema.prisma#L323)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `code` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `group` | `String` | — | 权限分组（如 catalog/order/b2b/cms/system） |
| `roles` | `RolePermission[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### Role

[schema 原始定义](../../apps/api/prisma/schema.prisma#L333)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `code` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `description` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `permissions` | `RolePermission[]` | — | 关联导航 |
| `staff` | `StaffRole[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### RolePermission

[schema 原始定义](../../apps/api/prisma/schema.prisma#L343)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `roleId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `permissionId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `role` | `Role` | `@relation(fields: [roleId], references: [id], onDelete: Cascade)` | 关联导航 |
| `permission` | `Permission` | `@relation(fields: [permissionId], references: [id], onDelete: Cascade)` | 关联导航 |

模型级约束：`@@id([roleId, permissionId])`

### StaffRole

[schema 原始定义](../../apps/api/prisma/schema.prisma#L352)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `staffId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `roleId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `staff` | `Staff` | `@relation(fields: [staffId], references: [id], onDelete: Cascade)` | 关联导航 |
| `role` | `Role` | `@relation(fields: [roleId], references: [id], onDelete: Cascade)` | 关联导航 |

模型级约束：`@@id([staffId, roleId])`

### UserToken

[schema 原始定义](../../apps/api/prisma/schema.prisma#L362)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `type` | `TokenType` | — | 枚举值见第 6 节 |
| `tokenHash` | `String` | `@unique` | 敏感字段，仅授权服务使用 |
| `email` | `String` | — | 目标邮箱/账号（匿名可找回） |
| `expiresAt` | `DateTime` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `consumedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `user` | `User?` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` | 关联导航 |
| `userId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([email, type])`

### AuditLog

[schema 原始定义](../../apps/api/prisma/schema.prisma#L377)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `actorKind` | `AuditActorKind` | — | 枚举值见第 6 节 |
| `actorCustomerId` | `String?` | — | C 端/经销商成员 |
| `actorStaffId` | `String?` | — | 后台员工 |
| `action` | `String` | — | 如 staff.login、order.refund.apply |
| `entityType` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `entityId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `before` | `Json?` | — | 业务结构见第 7 节 |
| `after` | `Json?` | — | 业务结构见第 7 节 |
| `ip` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `userAgent` | `String?` | — | 敏感字段，仅授权服务使用 |
| `customer` | `User?` | `@relation("ActorCustomer", fields: [actorCustomerId], references: [id], onDelete: SetNull)` | 关联导航 |
| `staff` | `Staff?` | `@relation("ActorStaff", fields: [actorStaffId], references: [id], onDelete: SetNull)` | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([actorKind, actorCustomerId, createdAt])`；`@@index([actorKind, actorStaffId, createdAt])`；`@@index([entityType, entityId])`

### DealerTier

[schema 原始定义](../../apps/api/prisma/schema.prisma#L403)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `code` | `String` | `@unique` | silver/gold/platinum |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sortOrder` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companies` | `DealerCompany[]` | — | 关联导航 |
| `priceRules` | `PricingRule[]` | `@relation("RuleTier")` | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### DealerCompany

[schema 原始定义](../../apps/api/prisma/schema.prisma#L414)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyName` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `legalRegNo` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `country` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `profile` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `catalogPolicy` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `purchaseSettings` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `addresses` | `DealerAddress[]` | — | 关联导航 |
| `invitations` | `DealerInvitation[]` | — | 关联导航 |
| `status` | `CompanyStatus` | `@default(PENDING)` | 枚举值见第 6 节 |
| `tierId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `tier` | `DealerTier?` | `@relation(fields: [tierId], references: [id], onDelete: SetNull)` | 关联导航 |
| `members` | `DealerMember[]` | — | 关联导航 |
| `applications` | `DealerApplication[]` | — | 关联导航 |
| `priceRules` | `PricingRule[]` | `@relation("RuleCompany")` | 关联导航 |
| `priceBooks` | `DealerPriceBook[]` | — | 关联导航 |
| `rfqs` | `DealerRfq[]` | — | 关联导航 |
| `purchaseOrders` | `PurchaseOrder[]` | — | 关联导航 |
| `approvedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@unique([legalRegNo, country])`；`@@index([status])`

### DealerMember

[schema 原始定义](../../apps/api/prisma/schema.prisma#L442)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `userId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `role` | `DealerMemberRole` | `@default(VIEWER)` | 枚举值见第 6 节 |
| `active` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `termsVersion` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `termsAcceptedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `termsAcceptedIp` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany` | `@relation(fields: [companyId], references: [id], onDelete: Cascade)` | 关联导航 |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@id([companyId, userId])`；`@@index([userId])`

### DealerApplication

[schema 原始定义](../../apps/api/prisma/schema.prisma#L461)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany?` | `@relation(fields: [companyId], references: [id], onDelete: SetNull)` | 关联导航 |
| `applicantId` | `String?` | — | 提交人（登录提交时绑定；游客提交为 null，跟进需凭企业/后续绑定） |
| `applicant` | `User?` | `@relation(fields: [applicantId], references: [id], onDelete: SetNull)` | 关联导航 |
| `companyName` | `String` | — | 申请企业名称；审核通过后写入 DealerCompany |
| `legalRegNo` | `String` | — | 企业注册号/统一社会信用代码；与 country 组成企业唯一键 |
| `contactName` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `contactEmail` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `phone` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `country` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `businessType` | `String` | — | 零售商/批发商/电商/商超… |
| `attachments` | `Json` | `@default("[]")` | 业务结构见第 7 节；[{mediaId,fileName,mimeType,sizeBytes,visibility:PRIVATE}] |
| `agreementVersion` | `String` | `@default("dealer-2026-09")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `agreedAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `consentIp` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `claimTokenHash` | `String?` | `@unique` | 敏感字段，仅授权服务使用 |
| `claimExpiresAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `ApplicationStatus` | `@default(SUBMITTED)` | 枚举值见第 6 节 |
| `remark` | `String?` | — | 审核意见/补件要求 |
| `reviewedBy` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `reviewedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([status, createdAt])`；`@@index([applicantId, status])`

### ProductCategory

[schema 原始定义](../../apps/api/prisma/schema.prisma#L495)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `code` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `slug` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `parentId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `parent` | `ProductCategory?` | `@relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)` | 关联导航 |
| `children` | `ProductCategory[]` | `@relation("CategoryTree")` | 关联导航 |
| `products` | `Product[]` | — | 关联导航 |
| `active` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `sortOrder` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `attributeTemplate` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `filterableFields` | `String[]` | `@default(["category", "age", "scene", "skill", "stock", "price"])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `description` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `coverImage` | `Json?` | — | 业务结构见第 7 节 |
| `seo` | `Json?` | — | 业务结构见第 7 节 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### Product

[schema 原始定义](../../apps/api/prisma/schema.prisma#L516)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `slug` | `String` | `@unique` | SEO 路由 /products/[slug] |
| `summary` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `description` | `String?` | — | 富文本 HTML（CMS 编辑器输出） |
| `ageGuidance` | `String?` | — | 适龄与成人监护提示（公开 PDP） |
| `ageMin` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `ageMax` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `scenes` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `skills` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `tags` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `markets` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `publishAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `unpublishAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `specifications` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `playGuide` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `productFaq` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `relatedSlugs` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `associations` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `archiveRedirect` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `resources` | `Json` | `@default("[]")` | 业务结构见第 7 节；[{label,url,type}] 说明书/证书/视频 |
| `categoryId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `category` | `ProductCategory?` | `@relation(fields: [categoryId], references: [id], onDelete: SetNull)` | 关联导航 |
| `status` | `ProductStatus` | `@default(DRAFT)` | 枚举值见第 6 节 |
| `variants` | `ProductVariant[]` | — | 关联导航 |
| `gallery` | `Json` | `@default("[]")` | 业务结构见第 7 节；[{mediaId,url,alt,sort}]（媒体中心 MD） |
| `seo` | `Json?` | — | 业务结构见第 7 节；{title,description,keywords,ogImage} |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([categoryId, status])`；`@@index([status])`

### ProductVariant

[schema 原始定义](../../apps/api/prisma/schema.prisma#L552)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `productId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `product` | `Product` | `@relation(fields: [productId], references: [id], onDelete: Cascade)` | 关联导航 |
| `sku` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String?` | — | 变体展示名（颜色/尺寸组合） |
| `attrs` | `Json` | `@default("{}")` | 业务结构见第 7 节；{color:'red',size:'S'} |
| `msrpCents` | `Int?` | — | 零售建议价（B2C） |
| `salePriceCents` | `Int?` | — | 零售促销价（B2C：sale 优先于 msrp） |
| `b2bDefaultPriceCents` | `Int?` | — | 默认 B2B 批发价（链尾兜底） |
| `weightGrams` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `barcode` | `String?` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `availabilityPolicy` | `String` | `@default("IN_STOCK_ONLY")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `backorderLimit` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `leadTimeDays` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `marketInventory` | `MarketInventory[]` | — | 关联导航 |
| `marketPrices` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `status` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `stock` | `Stock?` | — | 关联导航 |
| `priceRules` | `PricingRule[]` | — | 关联导航 |
| `cartItems` | `CartItem[]` | — | 关联导航 |
| `orderItems` | `OrderItem[]` | — | 关联导航 |
| `purchaseOrderItems` | `PurchaseOrderItem[]` | — | 关联导航 |
| `sortOrder` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([productId, status])`

### Stock

[schema 原始定义](../../apps/api/prisma/schema.prisma#L583)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `variantId` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `variant` | `ProductVariant` | `@relation(fields: [variantId], references: [id], onDelete: Cascade)` | 关联导航 |
| `available` | `Int` | `@default(0)` | 可售 |
| `reserved` | `Int` | `@default(0)` | 锁定（下单未支付） |
| `lowThreshold` | `Int` | `@default(5)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `source` | `String` | `@default("MANUAL")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `sourceUpdatedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `syncError` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### PriceBook

[schema 原始定义](../../apps/api/prisma/schema.prisma#L596)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `code` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `label` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `rules` | `PricingRule[]` | `@relation("RuleBook")` | 关联导航 |
| `companies` | `DealerPriceBook[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### PricingRule

[schema 原始定义](../../apps/api/prisma/schema.prisma#L610)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `variantId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variant` | `ProductVariant` | `@relation(fields: [variantId], references: [id], onDelete: Cascade)` | 关联导航 |
| `scope` | `PricingScope` | — | 枚举值见第 6 节 |
| `priority` | `Int` | `@default(0)` | 同 scope 内更大优先 |
| `companyId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany?` | `@relation("RuleCompany", fields: [companyId], references: [id], onDelete: Cascade)` | 关联导航 |
| `bookId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `book` | `PriceBook?` | `@relation("RuleBook", fields: [bookId], references: [id], onDelete: Cascade)` | 关联导航 |
| `tierId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `tier` | `DealerTier?` | `@relation("RuleTier", fields: [tierId], references: [id], onDelete: Cascade)` | 关联导航 |
| `priceCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `minQty` | `Int` | `@default(1)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `active` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `note` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `market` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | `@default("USD")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `startsAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `endsAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([variantId, scope, active])`；`@@index([companyId, bookId, tierId])`

### CmsPage

[schema 原始定义](../../apps/api/prisma/schema.prisma#L642)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `slug` | `String` | `@unique` | home/about/privacy/… |
| `title` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sections` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `status` | `CmsPageStatus` | `@default(DRAFT)` | 枚举值见第 6 节 |
| `seo` | `Json?` | — | 业务结构见第 7 节 |
| `kind` | `String` | `@default("PAGE")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `locale` | `String` | `@default("en")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `market` | `String` | `@default("ALL")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `publishAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `unpublishAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `revision` | `Int` | `@default(1)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `author` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `category` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `productIds` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `sortOrder` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `translations` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([kind, sortOrder])`

### MediaAsset

[schema 原始定义](../../apps/api/prisma/schema.prisma#L667)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `key` | `String` | `@unique` | 对象存储 key（本地磁盘路径或云存储） |
| `fileName` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `mimeType` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sizeBytes` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `checksum` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `alt` | `String` | `@default("")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `title` | `String` | `@default("")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `language` | `String` | `@default("en")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `resourceType` | `String` | `@default("OTHER")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `tags` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `decorative` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `publishedAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `usageLocations` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `version` | `Int` | `@default(1)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `previousVersionId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `scanStatus` | `String` | `@default("LEGACY_UNSCANNED")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `derivatives` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `companyIds` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `productIds` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `qualification` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `visibility` | `MediaVisibility` | `@default(PUBLIC)` | 枚举值见第 6 节 |
| `uploader` | `Staff?` | `@relation("Uploader", fields: [uploadedById], references: [id], onDelete: SetNull)` | 关联导航 |
| `uploadedById` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([visibility, createdAt])`；`@@index([checksum, visibility])`

### DealerAddress

[schema 原始定义](../../apps/api/prisma/schema.prisma#L698)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany` | `@relation(fields: [companyId], references: [id], onDelete: Cascade)` | 关联导航 |
| `label` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `kind` | `String` | `@default("BOTH")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `address` | `Json` | — | 业务结构见第 7 节 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([companyId])`

### DealerInvitation

[schema 原始定义](../../apps/api/prisma/schema.prisma#L710)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `company` | `DealerCompany` | `@relation(fields: [companyId], references: [id], onDelete: Cascade)` | 关联导航 |
| `email` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `role` | `DealerMemberRole` | `@default(VIEWER)` | 枚举值见第 6 节 |
| `tokenHash` | `String` | `@unique` | 敏感字段，仅授权服务使用 |
| `expiresAt` | `DateTime` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `consumedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([companyId, email])`

### DealerApplicationDraft

[schema 原始定义](../../apps/api/prisma/schema.prisma#L723)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `userId` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `data` | `Json` | — | 业务结构见第 7 节 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### DealerProcurementCart

[schema 原始定义](../../apps/api/prisma/schema.prisma#L729)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `userId` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `companyId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `lines` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### PurchaseOrderShipment

[schema 原始定义](../../apps/api/prisma/schema.prisma#L736)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `PurchaseOrder` | `@relation(fields: [orderId], references: [id], onDelete: Cascade)` | 关联导航 |
| `carrier` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `trackingNumber` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `lines` | `Json` | — | 业务结构见第 7 节 |
| `shippedAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `dedupeKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId])`

### PurchaseOrderPayment

[schema 原始定义](../../apps/api/prisma/schema.prisma#L748)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `PurchaseOrder` | `@relation(fields: [orderId], references: [id], onDelete: Cascade)` | 关联导航 |
| `idempotencyKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `amountCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `mode` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("PENDING")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `providerReference` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `checkoutUrl` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `events` | `PurchaseOrderPaymentEvent[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |
| `refunds` | `PurchaseOrderRefund[]` | — | 关联导航 |

模型级约束：`@@index([orderId])`

### PurchaseOrderPaymentEvent

[schema 原始定义](../../apps/api/prisma/schema.prisma#L766)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `eventId` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `payment` | `PurchaseOrderPayment` | `@relation(fields: [paymentId], references: [id], onDelete: Cascade)` | 关联导航 |
| `payloadHash` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### ContactMessage

[schema 原始定义](../../apps/api/prisma/schema.prisma#L776)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `email` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `country` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `subject` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `content` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `ContactStatus` | `@default(NEW)` | 枚举值见第 6 节 |
| `handledBy` | `String?` | — | Staff id |
| `handledAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `source` | `String` | `@default("CONTACT")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `priority` | `String` | `@default("NORMAL")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `assignedTo` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `assignedTeam` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `tags` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `history` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `attachments` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([status, createdAt])`；`@@index([source, priority, createdAt])`

### CmsRevision

[schema 原始定义](../../apps/api/prisma/schema.prisma#L800)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `pageId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `revision` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `snapshot` | `Json` | — | 业务结构见第 7 节 |
| `actorId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@unique([pageId, revision])`

### SiteSetting

[schema 原始定义](../../apps/api/prisma/schema.prisma#L810)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `key` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `value` | `Json` | — | 业务结构见第 7 节 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### SiteRedirect

[schema 原始定义](../../apps/api/prisma/schema.prisma#L816)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `source` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `destination` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `Int` | `@default(301)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### AnalyticsEvent

[schema 原始定义](../../apps/api/prisma/schema.prisma#L825)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `name` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `path` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `properties` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([name, createdAt])`

### NewsletterSubscription

[schema 原始定义](../../apps/api/prisma/schema.prisma#L834)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `email` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `locale` | `String` | `@default("en")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("PENDING")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `tokenHash` | `String` | `@unique` | 敏感字段，仅授权服务使用 |
| `consentVersion` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `expiresAt` | `DateTime` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### NotificationOutbox

[schema 原始定义](../../apps/api/prisma/schema.prisma#L845)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `kind` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `dedupeKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `payload` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("PENDING")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `attempts` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `availableAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `lockedUntil` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `lastError` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sentAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([status, availableAt])`

### Cart

[schema 原始定义](../../apps/api/prisma/schema.prisma#L866)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `userId` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` | 关联导航 |
| `items` | `CartItem[]` | — | 关联导航 |
| `mergeKeys` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### CartItem

[schema 原始定义](../../apps/api/prisma/schema.prisma#L877)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `cartId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `cart` | `Cart` | `@relation(fields: [cartId], references: [id], onDelete: Cascade)` | 关联导航 |
| `variantId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variant` | `ProductVariant` | `@relation(fields: [variantId], references: [id], onDelete: Cascade)` | 关联导航 |
| `quantity` | `Int` | `@default(1)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `unitPriceCents` | `Int` | — | 加购时快照价（sale ?? msrp） |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@unique([cartId, variantId])`；`@@index([cartId])`

### Order

[schema 原始定义](../../apps/api/prisma/schema.prisma#L893)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `calculationSnapshot` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderNo` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `userId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Restrict)` | 关联导航 |
| `status` | `OrderStatus` | `@default(PENDING)` | 枚举值见第 6 节 |
| `subtotalCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `totalCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | `@default("USD")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `market` | `String` | `@default("US")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `discountCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `taxCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `couponCode` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingMethod` | `String` | `@default("STANDARD")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingAddress` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `billingAddress` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `paymentStatus` | `String` | `@default("UNPAID")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `reservationExpiresAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `payments` | `RetailPayment[]` | — | 关联导航 |
| `shipments` | `RetailShipment[]` | — | 关联导航 |
| `returns` | `RetailReturn[]` | — | 关联导航 |
| `refunds` | `RetailRefund[]` | — | 关联导航 |
| `items` | `OrderItem[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([userId, createdAt])`；`@@index([status, createdAt])`

### OrderItem

[schema 原始定义](../../apps/api/prisma/schema.prisma#L926)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `priceSource` | `String` | `@default("MSRP")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `weightGrams` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `Order` | `@relation(fields: [orderId], references: [id], onDelete: Cascade)` | 关联导航 |
| `variantId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variant` | `ProductVariant?` | `@relation(fields: [variantId], references: [id], onDelete: SetNull)` | 关联导航 |
| `productName` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sku` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variantName` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `quantity` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `unitPriceCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `lineCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippedQuantity` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `returnedQuantity` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId])`；`@@index([variantId])`

### RedirectRule

[schema 原始定义](../../apps/api/prisma/schema.prisma#L950)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `sourcePath` | `String` | `@unique` | /old-path（不含域名） |
| `targetUrl` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `statusCode` | `Int` | `@default(301)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `active` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### AuthenticationSession

[schema 原始定义](../../apps/api/prisma/schema.prisma#L961)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `ownerId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `ownerKind` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `authVersion` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `mfaVerified` | `Boolean` | `@default(false)` | 敏感字段，仅授权服务使用 |
| `ip` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `userAgent` | `String?` | — | 敏感字段，仅授权服务使用 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `lastSeenAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `expiresAt` | `DateTime` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `revokedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([ownerKind, ownerId, revokedAt])`

### RetailMarket

[schema 原始定义](../../apps/api/prisma/schema.prisma#L977)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `code` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `label` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | `@default("USD")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `retailEnabled` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `countries` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `taxBps` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `expressCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `freeShippingAboveCents` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `reservationMinutes` | `Int` | `@default(30)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentMode` | `String` | `@default("DEMO")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `inventoryDisplay` | `String` | `@default("STATUS")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `allowPreorder` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `allowBackorder` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `defaultSort` | `String` | `@default("featured")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingRules` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `taxRegionRates` | `Json` | `@default("{}")` | 业务结构见第 7 节 |
| `taxMode` | `String` | `@default("CONFIGURED")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `shippingMode` | `String` | `@default("CONFIGURED")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### RetailCoupon

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1000)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `code` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `market` | `String` | `@default("US")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `percentBps` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `amountCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `minimumCents` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `startsAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `endsAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `maxUses` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `uses` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `active` | `Boolean` | `@default(true)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `freeShipping` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `productIds` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `userIds` | `String[]` | `@default([])` | 字段语义按名称及所属业务 DTO/服务解释 |
| `perUserLimit` | `Int?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### RetailPayment

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1018)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `Order` | `@relation(fields: [orderId], references: [id], onDelete: Restrict)` | 关联导航 |
| `idempotencyKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `mode` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("PENDING")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `amountCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `providerReference` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `checkoutUrl` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId])`

### RetailPaymentEvent

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1034)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `eventId` | `String` | `@id` | 字段语义按名称及所属业务 DTO/服务解释 |
| `paymentId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `payloadHash` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：无显式 `@@` 声明。

### RetailShipment

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1042)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `Order` | `@relation(fields: [orderId], references: [id], onDelete: Restrict)` | 关联导航 |
| `idempotencyKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `carrier` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `trackingNumber` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `trackingUrl` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `items` | `Json` | — | 业务结构见第 7 节 |
| `deliveredAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId])`

### RetailReturn

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1056)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `Order` | `@relation(fields: [orderId], references: [id], onDelete: Restrict)` | 关联导航 |
| `reason` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `description` | `String` | `@default("")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `attachments` | `Json` | `@default("[]")` | 业务结构见第 7 节 |
| `resolution` | `String` | `@default("REFUND")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("REQUESTED")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `items` | `Json` | — | 业务结构见第 7 节 |
| `staffNote` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId])`

### RetailRefund

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1072)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `Order` | `@relation(fields: [orderId], references: [id], onDelete: Restrict)` | 关联导航 |
| `returnId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `idempotencyKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `amountCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `reason` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("PENDING")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `providerReference` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId])`

### RetailPriceHistory

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1087)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `variantId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `actorId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `before` | `Json` | — | 业务结构见第 7 节 |
| `after` | `Json` | — | 业务结构见第 7 节 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([variantId, createdAt])`

### StaffLoginChallenge

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1098)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `tokenHash` | `String` | `@unique` | 敏感字段，仅授权服务使用 |
| `staffId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `authVersion` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `setupSecret` | `String?` | — | 敏感字段，仅授权服务使用 |
| `attempts` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `expiresAt` | `DateTime` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `consumedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([staffId, expiresAt])`

### AccountAddress

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1111)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `userId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` | 关联导航 |
| `label` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `recipient` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `phone` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `country` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `region` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `city` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `postalCode` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `line1` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `line2` | `String` | `@default("")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `isDefaultBilling` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `isDefaultShipping` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([userId])`

### AccountFavorite

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1131)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `userId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Cascade)` | 关联导航 |
| `productId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@unique([userId, productId])`

### AccountPrivacyRequest

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1140)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `userId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `user` | `User` | `@relation(fields: [userId], references: [id], onDelete: Restrict)` | 关联导航 |
| `type` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("OPEN")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `reason` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `resolution` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `handledBy` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `resolvedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([status, createdAt])`

### MarketInventory

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1155)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `variantId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `variant` | `ProductVariant` | `@relation(fields:[variantId],references:[id],onDelete:Cascade)` | 关联导航 |
| `market` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `available` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `reserved` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `lowThreshold` | `Int` | `@default(5)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `source` | `String` | `@default("MANUAL")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `syncError` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `sourceUpdatedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@id([variantId,market])`

### PurchaseOrderReturn

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1169)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `PurchaseOrder` | `@relation(fields:[orderId],references:[id],onDelete:Cascade)` | 关联导航 |
| `requestedById` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `idempotencyKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `reason` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("REQUESTED")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `decisionReason` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `approvedById` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `carrier` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `trackingNumber` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `receivedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `receiveKey` | `String?` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `receiptHash` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `items` | `PurchaseOrderReturnItem[]` | — | 关联导航 |
| `refunds` | `PurchaseOrderRefund[]` | — | 关联导航 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId,status])`

### PurchaseOrderReturnItem

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1190)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `returnId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `request` | `PurchaseOrderReturn` | `@relation(fields:[returnId],references:[id],onDelete:Cascade)` | 关联导航 |
| `orderItemId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderItem` | `PurchaseOrderItem` | `@relation(fields:[orderItemId],references:[id],onDelete:Cascade)` | 关联导航 |
| `quantity` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `receivedQuantity` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `restockQuantity` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@unique([returnId,orderItemId])`

### PurchaseOrderRefund

[schema 原始定义](../../apps/api/prisma/schema.prisma#L1201)

| 字段 | 类型 | 默认/字段约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `orderId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `order` | `PurchaseOrder` | `@relation(fields:[orderId],references:[id],onDelete:Cascade)` | 关联导航 |
| `paymentId` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `payment` | `PurchaseOrderPayment` | `@relation(fields:[paymentId],references:[id],onDelete:Cascade)` | 关联导航 |
| `returnId` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `request` | `PurchaseOrderReturn?` | `@relation(fields:[returnId],references:[id],onDelete:SetNull)` | 关联导航 |
| `requestedById` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `approvedById` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `idempotencyKey` | `String` | `@unique` | 字段语义按名称及所属业务 DTO/服务解释 |
| `amountCents` | `Int` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `currency` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `reason` | `String` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `cancelOrder` | `Boolean` | `@default(false)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `status` | `String` | `@default("REQUESTED")` | 字段语义按名称及所属业务 DTO/服务解释 |
| `decisionReason` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `providerReference` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `attempts` | `Int` | `@default(0)` | 字段语义按名称及所属业务 DTO/服务解释 |
| `lastError` | `String?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `availableAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `completedAt` | `DateTime?` | — | 字段语义按名称及所属业务 DTO/服务解释 |
| `createdAt` | `DateTime` | `@default(now())` | 字段语义按名称及所属业务 DTO/服务解释 |
| `updatedAt` | `DateTime` | `@updatedAt` | 字段语义按名称及所属业务 DTO/服务解释 |

模型级约束：`@@index([orderId,status])`；`@@index([status,availableAt])`

## 6. 完整枚举值域

未在本节列出的 String 状态字段不是 Prisma 枚举，业务值域由 DTO/状态机校验。

### RfqStatus

`DRAFT`, `SUBMITTED`, `QUOTED`, `ACCEPTED`, `REJECTED`, `EXPIRED`

### PurchaseOrderStatus

`PENDING_REVIEW`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `COMPLETED`, `CANCELLED`

### AccountStatus

`PENDING`, `ACTIVE`, `SUSPENDED`

### StaffStatus

`ACTIVE`, `DISABLED`

### CompanyStatus

`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`, `CLOSED`

### ApplicationStatus

`SUBMITTED`, `UNDER_REVIEW`, `MORE_INFO_REQUIRED`, `APPROVED`, `REJECTED`

### ProductStatus

`DRAFT`, `SCHEDULED`, `ACTIVE`, `HIDDEN`, `ARCHIVED`

### OrderStatus

`PENDING`, `CONFIRMED`, `FULFILLED`, `CANCELLED`

### PricingScope

`COMPANY_SPECIFIC`, `PRICE_TABLE`, `TIER_LEVEL`, `B2B_DEFAULT`

### MediaVisibility

`PUBLIC`, `REGISTERED`, `DEALER_ONLY`, `INTERNAL`

### ContactStatus

`NEW`, `ASSIGNED`, `WAITING_CUSTOMER`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`

### TokenType

`EMAIL_VERIFY`, `PASSWORD_RESET`, `STAFF_2FA`

### AuditActorKind

`ANON`, `CUSTOMER`, `STAFF`

### CmsPageStatus

`DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`

### DealerMemberRole

`OWNER`, `BUYER`, `VIEWER`

## 7. JSON、敏感数据与事务边界

JSON 的 `{}` / `[]` 默认值只表示空对象/数组，不表示可以保存任意业务内容。下表把字段族对应到实际输入校验与服务端构造代码；接口响应使用服务端投影，数据库结构不是公开 API 的响应契约。

| 字段族 | 结构与约束 | 校验/构造来源 |
| --- | --- | --- |
| DealerRfq/DealerQuote.items，PurchaseOrder.adjustments/地址 | SKU/数量/金额由服务端校验后生成版本快照；报价不可变；转单核对 revision，金额为整数分，地址随订单保存 | [B2B DTO](../../apps/api/src/dealer/dto/b2b.dto.ts)、[B2B 服务](../../apps/api/src/dealer/b2b.service.ts) |
| DealerCompany.profile/catalogPolicy/purchaseSettings，申请 attachments、草稿 data、企业地址、采购车/发货 lines | 企业配置、地址对象、私有附件引用及 SKU 数量行；企业归属、成员权限和条款状态由服务端实时检查，不从客户端 companyId 推定授权 | [门户 DTO](../../apps/api/src/dealer/dto/portal.dto.ts)、[门户服务](../../apps/api/src/dealer/dealer-portal.service.ts)、[申请 DTO](../../apps/api/src/dealer/dto/dealer-application.dto.ts) |
| ProductCategory.attributeTemplate/coverImage/seo，Product 的规格/FAQ/关联/资源/图库/SEO，Variant.attrs/marketPrices | 属性模板与属性对象；FAQ、资源、图片和关联列表；图片/附件引用校验；市场价格需币种与整数分金额一致，公开响应不含经销商底价 | [商品管理 DTO](../../apps/api/src/catalog/dto/catalog-admin.dto.ts)、[商品管理服务](../../apps/api/src/catalog/catalog-admin.service.ts)、[目录投影](../../apps/api/src/catalog/catalog.service.ts) |
| CmsPage.sections/seo/translations，CmsRevision.snapshot | 白名单区块数组、多语言内容对象、SEO 对象、完整修订快照；富文本清理、发布排程与语言完整性一起校验 | [CMS DTO](../../apps/api/src/cms/dto/cms.dto.ts)、[CMS 服务](../../apps/api/src/cms/cms.service.ts) |
| MediaAsset.derivatives | 原始图片生成的衍生资源列表；大小、MIME、存储键由服务端产生，继承鉴权与扫描边界 | [媒体服务](../../apps/api/src/media/media.service.ts) |
| Order.calculationSnapshot/地址，RetailMarket.shippingRules/taxRegionRates，发货/退货 items/attachments，RetailPriceHistory.before/after | 服务端结算拆分与地址快照、税运规则、SKU 履约/退货行、私有售后附件、价格前后状态；支付/退款核对原付款、金额币种及幂等流水 | [零售 DTO](../../apps/api/src/order/commerce.dto.ts)、[零售服务](../../apps/api/src/order/commerce.service.ts)、[税运计算](../../apps/api/src/order/tax-shipping.service.ts)、[售后附件](../../apps/api/src/order/return-evidence.service.ts) |
| Staff.permissionOverrides，AuditLog.before/after | 动作权限覆盖对象，审计前后快照；权限实时生效，敏感动作须 MFA，审计不应写入明文凭证 | [员工控制器](../../apps/api/src/admin/staff.controller.ts)、[角色与动作守卫](../../apps/api/src/rbac/roles.guard.ts)、[审计服务](../../apps/api/src/audit/audit.service.ts) |
| SiteSetting.value，AnalyticsEvent.properties | 按 setting key 校验的站点设置和有限事件属性；分析数据按用户同意采集，不保存任意令牌/个人敏感内容 | [平台 DTO](../../apps/api/src/platform/platform.dto.ts)、[平台服务](../../apps/api/src/platform/platform.service.ts) |
| ContactMessage.history | 联系工单状态/处理事件历史，由服务端追加并按后台权限查看 | [联系服务](../../apps/api/src/contact/contact.service.ts) |

密码哈希、MFA 材料、令牌哈希、会话标识、私有附件存储键、IP/邮件/地址属于受限数据；本字典只列字段定义，不提供任何真实值。企业数据通过所属企业或父订单关系隔离，零售订单按本人身份隔离；不可直接向浏览器返回完整 Prisma 对象。库存先预留、取消/超时释放、发货消耗，数据库条件更新与事务防止超卖；状态流转需校验旧状态，支付和退款需要持久化幂等记录。实际删除受外键、保留期限和业务状态约束，不能因为某关系声明 Cascade 就绕过业务权限删除。

## 8. 接口交接定位

接口前缀为 `/api/v1`。读取某接口时按 Controller 的 HTTP 方法和路由定位，顺序核对 DTO → 守卫/角色/动作权限/MFA → 服务的归属校验/事务/响应投影；不能仅凭数据库字段或旧 API 摘要调用。通用响应及错误码见 [API README](../../apps/api/README.md)，测试凭证见 [操作手册](../operation-manual.md#11-课程测试账号与密码)。

| 业务 | 当前接口实现入口 | 重点核对 |
| --- | --- | --- |
| 登录/会话/账户 | [认证](../../apps/api/src/auth/auth.controller.ts)、[账户](../../apps/api/src/account/account.controller.ts)、[员工](../../apps/api/src/admin/staff.controller.ts) | HttpOnly 会话、撤销、本人归属、员工 MFA 与动态动作权限 |
| 商品/价格/库存 | [公开目录](../../apps/api/src/catalog/catalog.controller.ts)、[商品后台](../../apps/api/src/catalog/catalog-admin.controller.ts)、[价格](../../apps/api/src/pricing/pricing-admin.controller.ts) | 公开白名单、市场/币种、上架状态、员工写权限和库存事务 |
| 购物车/零售 | [购物车](../../apps/api/src/cart/cart.controller.ts)、[订单](../../apps/api/src/order/order.controller.ts)、[交易与售后](../../apps/api/src/order/commerce.controller.ts) | 游客幂等合并、所有权、结算重算、支付 webhook 签名与退款匹配 |
| 企业申请/采购 | [申请与目录](../../apps/api/src/dealer/dealer.controller.ts)、[门户](../../apps/api/src/dealer/dealer-portal.controller.ts)、[询报价/PO](../../apps/api/src/dealer/b2b.controller.ts)、[企业售后](../../apps/api/src/dealer/b2b-after-sales.controller.ts) | 实时企业/成员权限、价格授权、条款、版本冲突、私有 PDF、退款幂等 |
| 内容/媒体/工单 | [CMS](../../apps/api/src/cms/cms.controller.ts)、[媒体](../../apps/api/src/media/media.controller.ts)、[联系](../../apps/api/src/contact/contact.controller.ts) | 草稿预览与发布、真实类型/扫描、短期签名、私有归属和 MFA |
| SEO/分析/通知 | [平台](../../apps/api/src/platform/platform.controller.ts)、[站点地图](../../apps/api/src/platform/seo-map.controller.ts)、[通知](../../apps/api/src/notifications/notifications.controller.ts) | 安全重定向、市场语言、同意与数据最小化、通知重试及死信处理 |

上述入口直接链接当前受版本控制的 DTO/Controller/Service；成员交接时仍需本人确认阅读和业务验收，不能由工具代签。当前数据结构同步已完成，正式商户、税票、批准价格/素材、生产资源与人工验收仍按外部前提处理。
