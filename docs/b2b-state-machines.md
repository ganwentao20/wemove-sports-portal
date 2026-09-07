# B2B 流程与状态机规范

负责人：甘文韬（M1/MB）。更新：2026-09-07。技术决策见 ADR-0002。

## 1. 申请与资质

`SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED`

管理员可从 SUBMITTED 直接终审或要求补件；SUBMITTED/UNDER_REVIEW 可转 MORE_INFO_REQUIRED；补件后可重新审核或终审。APPROVED/REJECTED 为终态。拒绝和补件须有意见，审核写操作需要 SUPER_ADMIN、MFA 和审计。

批准时同一事务创建/批准企业、绑定申请人为 OWNER、回填 companyId。匿名申请须先绑定账号。资质限 PDF/JPG/PNG、5 MB，私有保存并校验上传凭据；后台用短时签名链接查看。

## 2. 企业与价格授权

目录、Quick Order 和采购单据每次查库核对 ACTIVE 用户、成员关系和 APPROVED 企业。OWNER/BUYER 可提交和接受/拒绝报价；VIEWER 只读。企业暂停或成员权限变化不依赖重新登录生效；跨企业采购单据操作返回 404。

DealerPriceBook 以 companyId+bookId 为联合主键。后台授权/撤权需要 SUPER_ADMIN+MFA，事务审计记录变更前后授权。只有已授权价目表进入价格引擎；优先级仍为企业专属 > 授权价目表 > 等级 > 默认。撤销价目表后仍可使用企业其他合法价格来源。

## 3. Quick Order 与询报价

最多 100 行，数量 1–10000，SKU 规范化并拒绝重复项。逐行校验上架/启用、授权价和库存。修改输入后预览失效；全行合法才可创建 RFQ 草稿。预览不锁库，不承诺未来库存。

`DRAFT → SUBMITTED → QUOTED → ACCEPTED / REJECTED / EXPIRED`

- 草稿保存服务端商品/数量/参考价快照，提交后等待销售报价。
- 报价完整覆盖所有 SKU，各 SKU 恰好一行；报价不能改变询价数量。
- QUOTED 下可发行新版本；旧版不可修改；revision 防止旧页面覆盖新报价。
- 报价包含整数分商品金额、税费、运费、USD 币种和有效期；单行和总额均限制数据库 Int 上限。
- 只接受/拒绝最新有效版本。列表派生 EXPIRED，写操作实时检查有效期；无定时任务也拒绝过期接受。
- 接受时同事务创建 PO 和更新 ACCEPTED。rfqId 唯一键及 RFQ 行锁保证幂等；重试同版本返回已有 PO，不重复锁库、不改收货地址。旧版本返回 409。
- 拒绝/过期需创建新的 RFQ；本期不提供草稿修改/删除接口。

## 4. 企业采购订单

`PENDING_REVIEW → CONFIRMED → PROCESSING → SHIPPED → COMPLETED`

只有 PENDING_REVIEW 可 CANCELLED。保存企业名、商品/SKU/数量/单价、税费/运费/总额、币种、收货信息和报价版本快照。

接受报价时事务内按 variantId 排序条件扣减 available、增加 reserved；任何一行失败整体回滚。取消返还 available 并减少 reserved；发货只减少 reserved；完成不重复扣库。状态、库存和审计同事务提交；非法或重复流转返回 409。

企业 PO 独立于 B2C Order。实际支付、物流承运、正式财税计算、退款/ERP 对接不属于本课程切片；税费/运费由销售明确录入。

## 5. 接口与页面

经销商 `/dealer/quick-order` → `/dealer/procurement`；后台 `/admin/b2b`。所有 API 均带 /api/v1 前缀。

| API | 行为 |
|---|---|
| GET/POST /dealer/rfqs | 本企业最近 100 份 RFQ / 创建草稿 |
| POST /dealer/rfqs/:id/submit | 提交草稿 |
| POST /dealer/rfqs/:id/accept | version + shippingAddress，幂等生成 PO |
| POST /dealer/rfqs/:id/reject | 拒绝最新有效版本 |
| GET /dealer/purchase-orders | 本企业最近 100 份 PO |
| PATCH /dealer/purchase-orders/:id/cancel | 取消待审核 PO |
| GET /admin/b2b/rfqs | 后台 RFQ 列表 |
| POST /admin/b2b/rfqs/:id/quotes | revision + lines + taxCents + shippingCents + validUntil，MFA |
| GET /admin/b2b/purchase-orders | 后台 PO 列表 |
| PATCH /admin/b2b/purchase-orders/:id/status | 履约状态，MFA |
| GET/POST /admin/b2b/price-books | 授权选项 / 创建价目表（写入 MFA） |
| PUT /admin/b2b/companies/:id/price-books | 全量替换授权，空数组撤销全部，MFA |

价目表定价规则继续使用 C 的 `/admin/pricing-rules` API；本轮补充价目表载体和企业授权。前端通过 HttpOnly 同源会话代理传递 MFA，不向浏览器脚本暴露 JWT。

## 6. 验证

`apps/api/test/b2b-flow.e2e-spec.ts` 包含 13 项真实 PostgreSQL HTTP e2e：企业/角色隔离、MFA、授权/撤权、DTO、报价版本/过期、快照、重复转单、多行回滚、并发库存、取消和履约。完整命令与结果见 test-report.md。
