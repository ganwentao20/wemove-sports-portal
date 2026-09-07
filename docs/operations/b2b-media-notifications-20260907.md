# B2B、媒体与通知功能及验证记录

记录日期：2026-09-07 至 2026-09-08。本文记录合并 main 后的实际代码、局部隔离验证及部署前提；最终整合 SHA、全仓构建、三浏览器和远程 CI 由最终验收记录单独确认。

## 原文要求与实现入口

| 原文范围 / 原审计缺口 | 实际实现 | 入口与代码 |
| --- | --- | --- |
| §4.8、§6.1、§13.4，G01–G02 | 匿名申请一次性邮箱认领、过期重发；匹配已验证账号后绑定；账号草稿、补件重提、审核、批准创建 OWNER；协议版本/时间/IP、通知和审计 | `/dealer/apply`、`/dealer/application`、`/admin/dealers`；`dealer-portal.service.ts` |
| §6.2 Dashboard | 本企业状态/等级/区域/销售联系人、未付款及待确认计数、最近 RFQ/订单、授权最新文件、已发布公告 | `/dealer/dashboard`；`DealerPortalService.dashboard()` |
| §6.7，G03 | 法定/显示名称、税号、网站、类型、区域、币种、账期/联系人；总部/账单/收货地址和默认项；OWNER/BUYER/VIEWER、一次性邀请、即时停用、最后 OWNER 保护；企业强制 MFA 与 Closed 历史保留 | `/dealer/company`、`/admin/dealers/company?id=…`；首次条款及公开目录审核由身份模块配套实现 |
| B2B-001～003、§6.4，G04 | 产品/分类/具体变体、市场/渠道授权；净价、MSRP、币种、有效期、价格来源及阶梯；MOQ/倍数/箱规/箱重/交期；价格优先级由共享定价引擎执行 | `/dealer/catalog`、公共 PDP 的 `DealerProductPurchase`；`catalog-policy.ts`、`DealerService.catalog()` |
| B2B-004/005/007，G05 | CSV 上传及逐行错误、BOM/引号解析、采购车批量保存、粘贴 SKU；精确/状态/隐藏库存；全局与市场库存双池、同步失败阻断、预售/欠单容量 | `/dealer/quick-order`、`/dealer/catalog`；共享 `InventoryService` |
| QTE-001～006，G06 | PDP/采购车建立 RFQ；目标日期/备注/私有附件；销售填写折扣、税运费、付款/交货条款、有效期；不可变版本、拒绝原因、到期检查及通知 | `/dealer/procurement`、`/admin/b2b`；`B2bService` |
| ORD-B2B-001～007，G07 | 企业可用付款方式、客户 PO Number 可设必填、地址簿快照、Pending Review；信用卡会话/签名回调及线下收款核实；分批数量/运单/防超发；报价/确认/发票/装箱 PDF；复购重新检查现行授权/库存/价格 | `/dealer/procurement`、`/admin/b2b`；`b2b-payment.service.ts`、`b2b-pdf.ts` |
| ADM-O-002/003/006/007 | 员工基于当前有效报价代建独立 B2B PO；记录员工与授权原因，不写入虚假的客户接受或条款记录；只允许有限的有原因修改；未支付取消、已支付全额/部分退款、按行退货验收/可售回库、资金与库存幂等补偿 | `/admin/b2b` 的 Create purchase order for company；两端采购单的 Returns, refunds & after-sales history；`b2b-after-sales.service.ts` |
| B2B-006、§10.3、§20.2，G08/D03 | Public/Registered/Dealer-only/Internal；企业/产品授权短时签名；私有资质与普通资料分开；SHA-256 去重、320/768/1440 WebP、版本前驱、实际使用位置、删除引用检查、清理重试、扫描隔离 | `/dealer/downloads`、`/dealer/downloads?registered=1`、`/admin/media`；`media.service.ts` |
| §10/§14 媒体检索发布 | 标题、语言、文件类型、标签、alt/装饰图、发布时间；真实图片/PDF/MP4/WebM 格式校验；未来文件不出现在列表、搜索或 unsigned 下载；staff 可通过授权签名预览 | `/admin/media`、公共/注册/经销商下载；统一搜索下载分支同步语言/发布时间 |
| §19，G11 | 可编辑多语言模板、账号/订阅偏好与站点默认回退；变量缺失进入 DEAD、不发送空占位符；内部收件组真实逐个入队、令牌不外传；加密队列、延迟、发送租约、失败退避、原子事件去重、重试与审计 | `/admin/notifications`、平台投递队列；`notifications/` |

## 评分显示（PDP-002）

新增独立产品评分设置，默认关闭，保存于 `specifications.reviews`。后台 `/admin/products` 的 Product rating display 由有商品写权限的员工使用 MFA 保存实际五分制均分、整数评价数和来源，开启前确认数据来自该产品真实评价；没有内置或自动生成品牌评分。0 条、关闭或旧数据无效时，公开 API、PDP 和 Product JSON-LD 都不输出评分；显示和结构化数据共用同一汇总值。评分对象不进入普通规格、不要求翻译；复制产品会清零并关闭原产品评分，修改留有审计。`product-rating.e2e-spec.ts` 2 项已在 2026-09-08 00:16 通过，独立 `tests/browser/product-rating.spec.ts` 已提供供三引擎整合验证。

## 采购与售后操作规则

1. 公司报价和采购单始终保留成交价格快照；当前商品价格更新不会改动已成交金额。接受或员工代建时重新检查公司状态、具体 SKU 授权、MOQ/倍数/箱规及库存。`reserveAt=SUBMIT` 提交预占，`CONFIRM` 人工确认时预占；后者在转单时也检查库存与授权。
2. 员工代建调用 `POST /admin/b2b/rfqs/:id/purchase-order`，参数为报价版本、收货/账单地址、客户 PO/付款方式及必填 `staffReason`。需要后台 B2B 写权限、当前有效员工会话和 MFA。RFQ 必须有当前有效报价；生成的采购单归属原公司及 RFQ 联系人，`adjustments` 和 `dealer.po.manual.create` 审计保留实际员工与理由。重复相同请求返回原单，改变授权说明或地址等内容不能冒充重试。
3. 采购单保存 `market`，全局 Stock 与 MarketInventory 按固定顺序加锁。取消、发货与退货回库均使用原市场，企业资料变化不会释放错误的市场库存。
4. 两端单据下的售后链接进入 `/dealer/purchase-orders/:id/after-sales` 或 `/admin/b2b/purchase-orders/:id/after-sales`。VIEWER 只能查看；企业端拒绝 staff token，后台另查动作权限与 MFA。跨企业读取/修改拒绝。
5. 退货按已发货订单行及剩余数量申请，保存原因，审核前或批准未寄出时可撤回；批准后登记物流；后台逐行确认收货和可售数量。不可售/损坏件不回可用库存。同一验收键及内容重试不重复回库；更改已完成验收内容拒绝。
6. 退款申请先占用可退金额，`REQUESTED/PENDING/AWAITING_OFFLINE/SUCCEEDED` 都计入累计上限；拒绝或未审核撤回释放申请占额。付款和退款使用独立 PO 外键，禁止借用零售交易。已发货商品的企业退款必须关联本单已验收退货；可退商品金额按折扣及税的实际比例限制，运费补偿由后台独立审批。
7. 后台批准银行转账/PO/账期退款后进入 `AWAITING_OFFLINE`。操作员必须完成真实银行转账，再以完整批准金额和外部流水号核实；系统不会把“批准”当作实际退款。线上退款只有服务商返回匹配的已成功金额、币种和退款流水后才成功。
8. 全额取消未发货订单会阻止继续履约；退款确认完成后才释放预占库存。部分退款保留历史交易总额并更新 `PARTIALLY_REFUNDED`，全额为 `REFUNDED`。已取消采购单的晚到卡付款会持久化自动退款任务，不重新预占或再次释放库存。
9. 业务记录 `PurchaseOrderRefund.status=SUCCEEDED`、`amountCents/currency/completedAt/orderId` 是实际退款报表依据；市场取 `PurchaseOrder.market`。退货实收数量见 `PurchaseOrderReturnItem.receivedQuantity`，可售回库数量见 `restockQuantity`。
10. 申请、审核、物流、退货验收、退款结果均保留审计/事务通知；个人数据导出仅提供本人提出的售后记录安全字段，不包含其他企业成员申请或内部幂等键。

## 支付及退款服务商契约

- 卡收款使用 `B2B_PAYMENT_CREATE_URL`、`B2B_PAYMENT_WEBHOOK_SECRET`、可选 `B2B_PAYMENT_API_TOKEN`。回调验证时间戳、HMAC、付款 ID、金额、币种和事件幂等；未配置时 CARD 明确不可用。`B2B_PAYMENT_MODE=DEMO` 是演示模式，生产默认禁止。
- 线上退款增加 `B2B_PAYMENT_REFUND_URL`。生产强制 HTTPS、禁止重定向、15 秒超时；非生产仅额外允许 localhost HTTP，用于真实协议回归。
- 请求 JSON：`refundId, idempotencyKey, orderId, paymentId, paymentReference, amountCents, currency, reason`。`idempotency-key` 为固定退款 ID；`x-payment-timestamp` 为毫秒时间戳；`x-payment-signature` 是 HMAC-SHA256(secret, timestamp + '.' + 原始 JSON)。重试必须对相同退款 ID 返回同一外部交易，不能再扣一次退款金额。
- 成功响应必须包含 `status: "SUCCEEDED"`、非空 `providerReference`、准确 `amountCents` 和 `currency`。HTTP 错误、超时或不匹配响应保持 `PENDING / PROVIDER_REFUND_UNCONFIRMED`，不会宣称已退款。后台可重试，worker 每 60 秒处理到期任务并指数退避；`B2B_REFUND_WORKER=false` 可暂停。并发重试使用数据库租约。

## 媒体、通知与外部前提

- 文件需先通过账号/企业/产品授权，签名最长 300 秒；到期文件、未来发布文件及待隐私清理文件不可公开下载。资格附件不会进入普通经销商资料中心。
- 媒体校验长度、真实格式及 EICAR 测试标记，并支持二进制 POST 至 `MEDIA_SCAN_URL`，响应必须为 `{ "clean": true }`。可选 `MEDIA_SCAN_TOKEN`；`MEDIA_SCAN_REQUIRED=true` 时未经 CLEAN 的文件不能上传成功/下载，旧文件须后台重新扫描。基础格式/EICAR 检查不等于专业病毒库。
- 物理文件位于 API 工作目录的 `media_private`。隐私删除后 unlink 失败会把文件标为 `PENDING_DELETE`，创建持久 `media-cleanup:` 任务；worker 租约重试，后台能看待处理/保留状态。共享附件仍有商业、公开目录、CMS 或其他真实引用时保留并说明，不能删除仍在使用的资料。
- 内置 en/zh 模板可按业务事件编辑并扩展其他语言；没有配置对应语言时按站默认及 en 回退，用户输入和业务标识保持原文。可配置的多语言能力不代表运营方已提供所有语言的正式文案。
- SMTP 发件人与凭据仅由 `SMTP_HOST/PORT/SECURE/USER/PASS`、`EMAIL_FROM` 提供。`NOTIFICATION_ENCRYPTION_KEY` 与数据库备份需一起受控管理。默认 worker 每 15 秒处理到期队列，`NOTIFICATION_WORKER=false` 暂停。
- `SiteSetting.notificationTemplates` 保存模板；`SiteSetting.notifications` 的 `dealer/support/orders` 数组保存内部邮箱。组为空会明确返回未配置，不伪造内部送达。模板缺变量以 `DEAD / TEMPLATE_MISSING_VARIABLE:变量名` 留存加密输入，修正后重试；成功后清除载荷密文。营销退订不拦截订单/密码等事务通知。
- 真实收款/退款商户、SMTP 及邮件域名认证、专业扫描服务、生产持久卷/对象存储/CDN、正式税务发票或财务系统没有由项目代码自动提供。原因是尚无所选服务商的真实账号、密钥、业务规则及生产部署；现有协议和本地真实 HTTP/SMTP 回归不能替代外部联调。原站完整经销商/商业素材与正式翻译仍由数据所有者提供。基础设施备份恢复及公网部署验证由最终运维报告记录。

## 验证证据

使用单独 PostgreSQL `wemove_verify_20260907` 与 Redis DB 3，没有修改原开发数据库。迁移由主任务统一部署，B2B 售后迁移为 `20260907310000_purchase_order_after_sales`；员工代建复用现有审计/历史字段，无新增迁移。

| 实际局部运行 | 结果与范围 |
| --- | --- |
| 2026-09-07 23:38，`b2b-flow.e2e-spec.ts` + `b2b-after-sales.e2e-spec.ts` | 29 通过：原采购 23 + 售后 6。覆盖全局/市场库存、授权及撤权、签名付款、部分发货、退款金额并发上限、离线确认、跨企业/MFA、按行退货、晚到付款及外部不确定退款补偿 |
| 2026-09-07 23:48，`b2b-after-sales.e2e-spec.ts` + `notifications-flow.e2e-spec.ts` | 11 通过：售后 6 + 通知 5。额外包含退款撤回、个人导出隔离、企业端 staff 拒绝；通知使用真实本地 SMTP 并检查事务回滚、语言/缺变量、内部组、重试/租约 |
| 2026-09-08 00:01，`b2b-flow.e2e-spec.ts` + `notifications-flow.e2e-spec.ts` | 31 通过：采购 25 + 通知 6。新增员工代建并发幂等、员工/理由审计、无虚假客户接受、延后预占时的撤权/规则/库存复核；新增 6 路并发生产者及两事务同事件原子去重。此后 API/Web 类型检查均通过 |
| 2026-09-08 00:16，`product-rating.e2e-spec.ts` + `b2b-after-sales.e2e-spec.ts` | 8 通过，新增评分开关/边界/权限/来源/复制清零，以及实际成功 B2B 退款进入 market/currency 财务聚合，API/Web 类型检查随后均通过 |
| 媒体局部运行（2026-09-07 23:14） | 数据库 7 + 单元 4 通过：真实 PNG/三尺寸 WebP、checksum、跨公司/衍生图签名、真实 HTTP 扫描和隔离、版本循环、引用删除保护、清理重试、媒体类型/语言/发布校验。之后条款边界由身份模块加测并纳入最终整合运行 |
| API / Web 类型检查（2026-09-07 23:52） | 均通过；之后员工代建与通知并发修复需使用最新一轮结果，不能沿用该时间点替代 |
| `tests/browser/dealer-journey.spec.ts` | 真实浏览器 fixture：首次登录/条款、CSV 错误与有效行、RFQ 提交、真实后台 API 报价、企业接受转 PO、中文默认地址、授权 PDF、退款申请。只清理自身 ID，不运行 seed；浏览器结果由主任务统一记录 |

PDF 使用实际 `purchaseOrderPdf()` 生成，内附 OFL 许可的 Noto Sans CJK SC 字体。样本 `.local/pdf/b2b-order-verification.pdf` 包含中文企业、长中英文地址及 42 个商品行；四页渲染 `.local/pdf/b2b-final-1.png`～`b2b-final-4.png` 已逐页目视检查，重复表头、分页及页脚正常。生成脚本 `.local/verify-b2b-pdf.mjs` 可复跑；可用 `B2B_PDF_FONT` 指定其他获许可字体。

以上测试有重叠，不能把不同时点的通过项直接相加作为最终总数。最终整合代码与远程 CI 必须在所有新增改动保存后重新验证。
