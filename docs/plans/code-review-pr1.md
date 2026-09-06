# 代码评审记录 · PR#1（dealer 经销商申请接口）

- 评审日期：2026-09-05
- PR：#1 `feat(dealer): 新增经销商申请接口` @Zrj0313（朱容杰），分支 `feature/dealer-app-b`，commit 49f02cc
- 评审人：组长（甘文韬）+ AI 督导；基线 main @833cd47
- 评审方式：拉取 PR 头 → 本地 typecheck/lint/单测 → 逐文件走查

## 机器检查结果（PR 自检通过 ✅）

| 项目 | 结果 |
|---|---|
| typecheck | 0 错 |
| 单测（16 = 既有 10 + dealer 6 + mfa） | 全绿 |
| lint（oxlint） | 0 告警 |

## 总体评价

结构规范、可合并性高：模块目录/ESM `.js` 导入/DTO 校验/统一错误码/Redis 限流复用/select
白名单/单测齐备，与仓库约定一致 —— **首 PR 质量明显高于及格线，值得肯定**。

## 阻塞问题（合并前必须处理）

### 🔴 P0-1 水平越权：邮箱字符串相等 ≠ 归属校验
`dealer.service.ts` `findApplication` 的 `ownsByEmail` 仅比较
`申请.contactEmail === 登录者.email`。但当前系统 `EMAIL_VERIFY_REQUIRED=false`（默认），
任何人都能注册任意邮箱并直接 ACTIVE —— 攻击者可注册他人邮箱后
**读取他人申请（手机号/营业执照附件描述/审核意见 remark）**，构成真实隐私泄漏 + 越权，
触碰安全红线（经销商数据以企业/本人为边界）。

**修复方案（建议，需例会/组长确认后实施）**：
1. schema：`DealerApplication` 增加可空 `userId`（FK → User），提交申请时若已登录则绑定；
2. `findApplication` 归属判定改为：`record.userId === me.sub` **或**
   `record.companyId === me.companyId`（company 需 APPROVED，沿用 login 已注入的边界）；
3. `email 字符串相等` 兜底**删除**（防伪邮箱注册）；
4. 需新增 migration（改 schema 走例会决议流程）。

### 🟡 P1-1 附件字段信任边界（建议尽快定，可后置到 D 的媒体模块）
附件仅客户端自述 `{fileName,key,url}`，无服务端生成依据。当前仅申请人自看，风险低；
但后台审核员若点击申请人填写的 url 存在钓鱼面。建议后续改为**只接收媒体模块返回的
`mediaId`**（由 D 的 `MediaAsset` 上传流程生成），本接口仅存引用。

### 🟡 P1-2 无感问题清单（小）
- 越权探测面：不存在 404 / 非本人 403，语义正确（勿改）；
- 重复申请检查仅按邮箱状态，同一公司多人可重复提交 —— 接受（后续审批流覆盖）；
- DTO 附件未限制数组元素间 key 重复 —— 可加 `@ArrayUnique`。

## 验收门（修复后合并标准）

1. P0-1 修复合入 PR 且本地复测：新注册"他人邮箱"账号无法读取目标申请（403）；
2. 新增单测覆盖：非本人/非本企业 403、本人 200、游客 401（e2e 补 401/403 门禁可随后）；
3. CI 绿后由组长合并，删除分支。

## 备注

- 评审全过程记录由组长在 PR 评论区转达（或本文件存档作为答辩评审证据）。
- 后续 B2B 模块（Quick Order/RFQ/PO）以本 PR 模式为基线迭代。
