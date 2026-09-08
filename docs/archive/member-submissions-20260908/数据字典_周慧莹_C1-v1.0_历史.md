

\# WEMOVE SPORTS · 数据字典 v1.0



> 归属：组员 C（周慧莹） · 基线：schema.prisma @ main ceac929



> 用途：字段、类型、约束、业务含义的单一事实源；与 schema.prisma 同步维护。



> 状态：C1 复核任务交付物（schedule-current.md 要求 "待 C 复核数据字典"）



\## 1. 通用约定



| 约定 | 规则 |

|---|---|

| 金额 | 一律 `Int` 存"分"（`\*Cents` 后缀），避免浮点误差 |

| 主键 | `String @id @default(cuid())` |

| 时间戳 | 所有业务表必含 `createdAt/updatedAt` |

| 软删除 | 不使用软删除；用 `status` 枚举表达业务状态 |

| 多租户隔离 | 所有 dealer 业务数据挂 `companyId` |

| 引擎取价链 | COMPANY\_SPECIFIC > PRICE\_TABLE > TIER\_LEVEL > B2B\_DEFAULT；零售走 sale ?? msrp |

| ESM 导入 | 相对导入带 `.js` 后缀（NestJS + ESM 约定） |

| 数据访问 | 一律走 PrismaService；敏感字段不进 select/response |



\## 2. 商品域（MC）



\### 2.1 ProductCategory（商品分类）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 分类 ID |

| code | String | 是 | @unique, 正则 \[A-Z0-9\_] | 分类编码（大写） |

| slug | String | 是 | @unique, 正则 \[a-z0-9-] | URL slug |

| name | String | 是 | | 分类名 |

| parentId | String? | 否 | FK 自身, onDelete SetNull | 父分类（树形） |

| active | Boolean | 是 | 默认 true | 是否启用 |

| sortOrder | Int | 是 | 默认 0 | 排序 |



\### 2.2 Product（商品主数据）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 商品 ID |

| name | String | 是 | MaxLength 160 | 商品名 |

| slug | String | 是 | @unique, 正则 \[a-z0-9-] | SEO 路由 /products/\[slug] |

| summary | String? | 否 | MaxLength 500 | 摘要 |

| description | String? | 否 | MaxLength 20000 | 富文本 HTML |

| ageGuidance | String? | 否 | MaxLength 500 | 适龄/成人监护提示 |

| resources | Json | 否 | 默认 \[] | \[{label,url,type}] 说明书/证书/视频 |

| gallery | Json | 否 | 默认 \[] | \[{mediaId,url,alt,sort}] 媒体中心引用 |

| seo | Json? | 否 | {title,description,keywords,ogImage} | SEO 元数据 |

| categoryId | String? | 否 | FK ProductCategory, onDelete SetNull | 分类 |

| status | ProductStatus | 是 | 默认 DRAFT | DRAFT/ACTIVE/ARCHIVED |



\### 2.3 ProductVariant（变体/SKU）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 变体 ID |

| productId | String | 是 | FK Product, onDelete Cascade | 所属商品 |

| sku | String | 是 | @unique, 大写 | 库存编码 |

| name | String? | 否 | MaxLength 120 | 颜色/尺寸组合名 |

| attrs | Json | 否 | 默认 {} | {color,size,...} |

| msrpCents | Int? | ⚠️ | ≥0 | 零售建议价（B2C 必填，与 salePrice 二选一） |

| salePriceCents | Int? | ⚠️ | ≥0 | 零售促销价（优先于 msrp） |

| b2bDefaultPriceCents | Int? | ⚠️ | ≥0 | B2B 批发兜底价（B2B 必填） |

| weightGrams | Int? | 否 | ≥0 | 重量（运费计算） |

| status | Boolean | 是 | 默认 true | 是否上架 |

| sortOrder | Int | 是 | 默认 0 | 排序 |



> ⚠️ 业务约束（DTO 层）：msrpCents 与 salePriceCents 至少一个非空。



\### 2.4 Stock（库存）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| variantId | String | 是 | @id, FK ProductVariant, onDelete Cascade | 变体 ID（1:1） |

| available | Int | 是 | 默认 0, ≥0 | 可售库存 |

| reserved | Int | 是 | 默认 0, ≥0 | 锁定库存（下单未支付） |



> 扣减规则：在事务内 `updateMany` + `available: { gte: qty }` 原子扣减；取消/履约按状态机释放预留。



\### 2.5 PriceBook（价格表）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 价格表 ID |

| code | String | 是 | @unique | 价格表编码 |

| label | String | 是 | | 显示名 |



\### 2.6 PricingRule（价格规则）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 规则 ID |

| variantId | String | 是 | FK ProductVariant, onDelete Cascade | 变体 |

| scope | PricingScope | 是 | 枚举 | COMPANY\_SPECIFIC/PRICE\_TABLE/TIER\_LEVEL/B2B\_DEFAULT |

| priority | Int | 是 | 默认 0 | 同 scope 内更大优先 |

| companyId | String? | 否 | FK DealerCompany, onDelete Cascade | scope=COMPANY\_SPECIFIC 时必填 |

| bookId | String? | 否 | FK PriceBook, onDelete Cascade | scope=PRICE\_TABLE 时必填 |

| tierId | String? | 否 | FK DealerTier, onDelete Cascade | scope=TIER\_LEVEL 时必填 |

| priceCents | Int | 是 | ≥0 | 规则价 |

| minQty | Int | 是 | 默认 1, ≥1 | 阶梯起订量 |

| active | Boolean | 是 | 默认 true | 是否生效 |

| note | String? | 否 | | 备注 |



> 引擎取价：按 scope 优先级 COMPANY\_SPECIFIC > PRICE\_TABLE > TIER\_LEVEL > B2B\_DEFAULT，同 scope 按 priority desc + minQty desc 取最大满足档。零售用户只取 variant.msrp/sale，永远不读本表（防越权由服务层保证）。



\## 3. 交易域（MC）



\### 3.1 Cart（购物车）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 购物车 ID |

| userId | String | 是 | @unique, FK User, onDelete Cascade | 一对一 |

| createdAt/updatedAt | DateTime | 是 | | 时间戳 |



\### 3.2 CartItem（购物车行）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 行 ID |

| cartId | String | 是 | FK Cart, onDelete Cascade | 所属购物车 |

| variantId | String | 是 | FK ProductVariant, onDelete Cascade | 变体 |

| quantity | Int | 是 | 默认 1 | 数量 |

| unitPriceCents | Int | 是 | | 加购时快照零售价（sale ?? msrp） |



> 唯一约束：`@@unique(\[cartId, variantId])` 同变体加购合并。



\### 3.3 Order（订单）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 订单 ID |

| orderNo | String | 是 | @unique | 订单号 WM-{时间}-{UUID8} |

| userId | String | 是 | FK User, onDelete Restrict | 下单用户 |

| status | OrderStatus | 是 | 默认 PENDING | PENDING/CONFIRMED/FULFILLED/CANCELLED |

| subtotalCents | Int | 是 | | 商品小计 |

| totalCents | Int | 是 | | 订单总额 |



> 状态机：PENDING → CONFIRMED → FULFILLED；PENDING/CONFIRMED → CANCELLED



\### 3.4 OrderItem（订单行快照）



| 字段 | 类型 | 必填 | 约束 | 业务含义 |

|---|---|---|---|---|

| id | String | 是 | @id cuid | 行 ID |

| orderId | String | 是 | FK Order, onDelete Cascade | 所属订单 |

| variantId | String? | 否 | FK ProductVariant, onDelete SetNull | 变体（可空保快照） |

| productName | String | 是 | | 商品名快照 |

| sku | String | 是 | | SKU 快照 |

| variantName | String? | 否 | | 变体名快照 |

| quantity | Int | 是 | | 数量 |

| unitPriceCents | Int | 是 | | 单价快照 |

| lineCents | Int | 是 | | 行金额快照 |



\## 4. 复核结论



\### ✅ 通过项



\- 金额统一用 `Int \*Cents` 整数存储，避免浮点误差



\- 所有业务表齐全 `createdAt/updatedAt`



\- 引擎取价链与零售兜底逻辑一致（sale ?? msrp）



\- CartItem 合并约束 `@@unique(\[cartId, variantId])` 正确



\- OrderItem.variantId 可空保快照 + `onDelete: SetNull`



\- 库存原子扣减 `updateMany` + `available: { gte }` 条件正确



\- 订单状态机纯函数 + 单测完整（order-state.spec.ts）



\- 购物车行锁 `FOR UPDATE` + 库存条件扣减 + 取消/履约释放 reservation



\- 价格规则 scope 与 companyId/bookId/tierId 引用清理逻辑完整



\### ⚠️ 待改进项（建议下轮迭代）



| 优先级 | 模型 | 改进 |

|---|---|---|

| P1 | PricingRule | 补 `effectiveFrom/effectiveTo DateTime?` 价格有效期 |

| P1 | Order | 补 `paymentStatus` 枚举（与 OrderStatus 解耦，区分已付/未付） |

| P1 | ProductVariant | 价格字段非空业务约束（DTO 层校验 msrp/sale 至少一非空） |

| P2 | OrderItem | 补 `@@index(\[variantId, createdAt])` 复合索引（销量统计） |

| P2 | Stock | 补 `safetyStock/reorderPoint` 库存预警字段 |

| P2 | Product.gallery | 与 MediaAsset 关联改关系表，防悬空引用 |

| P2 | PricingRule | 补 `currency String @default("CNY")` 币种字段 |

| P2 | Order | 补 `shippingFeeCents/taxCents/discountCents` 金额拆分 |

| P3 | CartItem | 补 `sku String` 加购快照（与 OrderItem 设计对齐） |

| P3 | PricingRule.priority | 注释明确 scope asc + priority desc 排序规则 |

| P3 | ProductVariant.b2bDefaultPriceCents | 明确"元数据，引擎以规则表为权威" |



\## 5. 跨模块协作待办（B/C 例会决议）



需在例会上与组员 B（朱容杰）共同评审以下跨域 Schema，\*\*禁止单方改跨域模型\*\*：



1\. \*\*PriceBook 企业授权\*\* — 哪些企业可见哪些价格表



2\. \*\*RFQ 报价版本\*\* — 报价单多次修订的版本管理



3\. \*\*企业 PO 快照\*\* — 采购订单与订单快照的边界



决议后再分别实现对应模块。



