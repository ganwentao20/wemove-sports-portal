# 协调记录 · 2026-09-05 main 误推事件

## 事件
- commit `46a7131`（@Linda-123131，标题"更新 CMS 后台与 API"）直推 main：**删除整套
  NestJS API 源码与 Prisma 迁移**，新增并行 Python 后端（main.py/models.py/database.py/routers/）
  及 apps/web 内 Vue 文件 —— 与 ADR-0001（TS 全栈）冲突，CI 自该提交起连续失败。
- 另有 @chenjinglinlin 两次 docs/meetings gitlink 增删提交（净内容为零，无影响）。

## 处置（可逆、未删除任何历史）
1. 原提交保全：`wip/member-d-python-cms` 分支（origin 已推送，46a7131 可随时检出继续探索）；
2. main 上 `git revert 46a7131`（commit 9f4a97d），恢复 TS API 基线；
3. 恢复后本地验证全绿（typecheck/lint/单测 15/e2e 12/build），推送 main。

## 根因与规则
- 根因：main 无分支保护 + 双技术栈认知偏差（成员按 Python 背景尝试 Flask 式后端）。
- 规则（已在 docs/development-conventions.md/README 宣贯，需例会重申）：
  1. 技术栈以 ADR-0001 为准（NestJS+Prisma+Next.js）；不接受第二套并行后端入库 main；
  2. main 只走 PR（组长尽早开启分支保护）；成员对框架有困难先例会/组长讨论，勿静默换栈；
  3. 任何大范围删除/迁移文件的提交必须 PR 评审。

## 待办
- 组长：开 main 分支保护；例会向 D（倪依玲）同步事件与保全分支（wip/member-d-python-cms 可留作个人探索，
  正式 CMS 仍按 NestJS 模块 cms/media 推进）；周慧莹分支 feature/pricing-crud-c 待评审。

## 2026-09-07 政策更新

仓库所有者后续决定取消 `main` 的强制 PR、审核和状态检查门槛，允许已有 Write 权限的协作者直接推送；本节覆盖上文事件发生时制定的“main 只走 PR”临时规则。事故中的技术栈、可逆保全和大范围删除风险仍然成立，因此直推前必须同步主线并运行 `npm run verify`，推送后由提交者跟进主线 CI；Schema、架构切换和大范围删除继续使用独立分支协调。
