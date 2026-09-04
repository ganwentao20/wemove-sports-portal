## 变更说明（Summary）

<!-- 用 1-3 句话说明本 PR 做了什么、为什么 -->

## 关联 Issue

- Closes #<!-- issue 编号（无则删此行）-->

## 变更类型

- [ ] feat（新功能）
- [ ] fix（缺陷修复）
- [ ] refactor（重构，行为不变）
- [ ] test（测试）
- [ ] docs / chore（文档与杂项）

## 变更范围

<!-- 目录/接口/数据表，例如：apps/web/app/(storefront)/products、apps/api/src/catalog、schema: ProductVariant -->

## 自查清单（提交前逐项勾选）

- [ ] 本地已通过：`npm run typecheck`、`npm run lint`、`npm test`
- [ ] 改了 `schema.prisma`：已运行 `npm run db:migrate` 并**提交迁移 SQL**
- [ ] 新增/修改 API：遵守统一响应体（见 docs/development-conventions.md），未泄露敏感字段（密码哈希/经销商底价等）
- [ ] 涉及前端：移动端无横向溢出（硬指标），数据访问走 `lib/api.ts`
- [ ] README / docs 需要同步的内容已更新

## 测试与验证

<!-- 如何复现验证：命令、接口示例、页面路径。有截图更好（答辩素材） -->

## 备注

<!-- 依赖、待办、风险 -->
