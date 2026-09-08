# ADR-0002：M1/MB 承接及企业采购数据模型

日期：2026-09-07。责任人：甘文韬。来源：组长明确要求同时完成原组长和 B2B 两份分工；本记录为实施决策，不冒充团队例会纪要。

团队现为五人，B2B 由甘文韬接管。保留 M1/MA/MB/MC/MD/ME 模块标识，其中 M1/MB 同属甘文韬；保留既有贡献与远端分支。

新增 DealerPriceBook、DealerRfq、DealerQuote、PurchaseOrder、PurchaseOrderItem 五个模型和两个状态枚举，配套迁移 `20260907140000_b2b_procurement`。只新增关系，不重写已有 B2C Order，也不修改 C 的价格优先级算法。

RFQ/Quote 用服务端校验和生成的 JSON 保存不可变商品/数量/价格快照；PO 行关联 ProductVariant 并以 Restrict 保留履约所需 SKU。企业和创建用户关联 Restrict，避免删除历史采购单据。库存仍使用既有 Stock 表的 available/reserved；RFQ/PO 行锁、条件库存更新与审计在一个事务内。

独立 PO 明确企业归属、报价版本和收货/税费快照；代价是新增迁移与界面。C 的数据字典和 API 规格需补充新增实体，当前远端数据字典分支保留供复核。

实现范围与状态机见 `../b2b-state-machines.md`。列表最多显示最近 100 份，历史报价完整保留。扩展分页、ERP、物流、支付或正式财税能力需另行规划。
