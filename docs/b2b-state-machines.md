# B2B 核心状态机（组员 B）

## 1. 经销商申请审批

`SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED`

- 管理员也可由 `SUBMITTED` 直接要求补件或给出终审结果。
- `SUBMITTED / UNDER_REVIEW → MORE_INFO_REQUIRED` 时必须填写补件要求。
- `MORE_INFO_REQUIRED → UNDER_REVIEW / APPROVED / REJECTED`。
- `APPROVED`、`REJECTED` 为终态，不允许回退；全部审核操作记录员工、时间、意见和审计日志。
- `APPROVED` 必须在同一数据库事务内创建/批准企业、把已登录申请人绑定为 `OWNER`，并将 `companyId` 回填申请；匿名申请须先绑定客户账号。

## 2. RFQ 询价（后续迭代约束）

`DRAFT → SUBMITTED → QUOTED → ACCEPTED / REJECTED / EXPIRED`

- 报价必须版本化，历史版本只读；只有最新有效报价可以接受。
- `ACCEPTED` 后才允许转换采购订单，转换操作必须幂等。

## 3. PO 采购订单（与订单模块联调约束）

`PENDING_REVIEW → CONFIRMED → PROCESSING → SHIPPED → COMPLETED`

- 管理员确认前允许取消为 `CANCELLED`；终态只读保留。
- 金额、税费、收货信息和商品名称必须保存订单快照，不能随商品主数据变化。

## 4. 本期实现边界

- 已实现：申请提交、本人/企业受控查询、管理员列表、审批状态流转、企业/OWNER 绑定、企业/等级/B2B 默认价装配及审计；Quick Order 最多 100 行 SKU 的授权价、重复项与库存逐行校验。
- 等待 B/C 联合确认：价格表授权关系、RFQ 报价版本和企业 PO/收货快照的数据模型；当前 B2C Order 不能冒充企业订单。
- 已实现：申请资质附件限 PDF/JPG/PNG、5 MB，存为 `DEALER_ONLY` 媒体；提交时校验媒体 ID/上传凭据，后台用短时签名链接查看。
- RFQ、PO 本期先锁定状态机和接口边界，避免在跨成员数据模型决议前擅自加表。
