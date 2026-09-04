# apps/web — WEMOVE 前台（Next.js 16 · App Router · Tailwind 4）

## 路由分组（= 四大门户前台入口）

| 路径 | 说明 | 负责人 |
|---|---|---|
| `app/(storefront)/` | 品牌官网：`/` `/products`(PLP) `/products/[slug]`(PDP) `/compare` `/play-learn` `/support` `/contact` `/search` | 组员 A |
| `app/customer/` | B2C 用户中心：login/register/account | 组员 A（API：组长/组员 C） |
| `app/dealer/` | 经销商门户：apply/login/dashboard（Quick Order/RFQ/PO 子页待建） | 组员 B |
| `app/admin/` | 运营后台：login/dashboard（PIM/CMS/Media 子页待建） | 组员 D |

## 关键约定

- **SEO（答辩点）**：页面默认 SSR/ISR；`export const revalidate` 增量再生成见 `products/page.tsx` 示例；
  根 `layout.tsx` 已配 metadata；`app/robots.ts` 全站爬虫策略。
- **数据访问**：一律经 `lib/api.ts`（统一响应体 `{code,message,data}`，code!==0 抛 `ApiError`），
  不要散落裸 fetch。本地开发同源代理见 `next.config.ts`。
- **移动端硬指标**：任何表格/对比组件禁止横向溢出（详见根 README 的响应式红线），示例页均为单列布局。
- **安全**：`/customer` `/dealer` `/admin` 页面仅做 UI 隔离；真正的鉴权/RBAC 在 apps/api
  （前端隐藏不等于安全，禁止把权限判断只放前端）。
- **i18n**：海外站点，html lang=en-US；多语言方案待 ADR（路由级/字典级再定）。

## 常用命令（仓库根执行）

```bash
npm run dev:web      # http://localhost:3000
npm run build:web    # 生产构建（ISR 页面在构建期预渲染）
npm run typecheck    # 全仓 TS 检查（web 侧：npx tsc --noEmit）
```
