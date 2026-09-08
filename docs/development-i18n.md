# 中英文界面开发与回归

URL 中的 `/zh`、`/en` 优先于语言偏好；用户主动切换后，`wm_locale` Cookie 记住所选语言。没有语言前缀的内部链接继续使用该偏好。切换保留当前页面、查询条件、锚点，并同步登录后的站内返回地址。`wm_market` 与三类登录会话独立保存。

官网页头以及统一登录、客户、经销商和后台页面均提供语言入口。根布局统一设置 HTML 语言，服务端标题与客户端文案使用同一语言；404 与错误页也有语言入口。

## 界面覆盖

| 区域 | 覆盖内容 |
|---|---|
| 官网 | 首页、商品目录和详情、搜索、比较、关于品牌、品质安全、隐私、条款、联系、经销商查询、文章、FAQ、支持与下载、订阅及 Cookie 偏好 |
| 账户与交易 | 统一登录与旧入口跳转、注册、邮箱验证、找回及重置密码、资料、地址、心愿单、设备与双因素认证、购物车、结算、订单和售后 |
| 经销商 | 申请及进度、条款、工作台、企业资料与成员、授权目录、快速订购和 CSV 预览、采购购物车、询价报价、采购订单、售后、资料下载及安全设置 |
| 管理后台 | 运营工作台、商品与库存、内容与预览、媒体、经销商审核、客户与员工、权限、联系收件箱、价格与市场、订单、企业采购、报表、审计、SEO、通知及站点设置 |

## 新增文案

- 客户端使用 `useUiText()`；服务端使用 `await getUiText()`。按区域维护 `apps/web/lib/ui-public.ts`、`ui-account.ts`、`ui-admin.ts`；共用文案在 `ui-i18n.ts`。
- 数字、币种、数量等通过 `t("Amount ({currency})", { currency })` 插值。翻译按钮、提示、表头、占位符、无障碍标签、状态显示和页面元信息。
- `option.value`、角色及状态编码、SKU、权限编码、提交字段保持原值。业务数据需要显示名称时，只在呈现处应用翻译。
- API 异常用 `uiError()` 呈现：保留明确的中文业务提示，未知英文异常提供中文操作提示。
- 企业名、用户留言、文件名及历史交易快照保留原文。CMS 和商品内容取已发布且完整的译文；草稿不会因界面选择中文而公开。用户新增内容需在后台补充并发布对应译文。

## 演示内容补齐

在 `apps/api` 目录执行下面命令，仅补原始演示数据缺失的译文。脚本可重复执行，保留已有编辑内容与译文草稿，不重置价格或库存。

```powershell
node prisma/seed-catalog-locales-cli.ts
node prisma/seed-content-locales-cli.ts
```

## 回归验证

先启动本地服务，再运行独立的语言用例。该配置复用已运行服务，不在 API 热更新间隙启动第二个实例。

```powershell
powershell.exe -NoProfile -File scripts/start-local.ps1
npx playwright test --config=playwright.locale.config.ts
npm run typecheck
npm test -w api
npm run build
```

语言用例覆盖 Chromium、Firefox、WebKit，包括双向切换、无前缀链接记忆、URL 条件保留、表单错误、商品及购物车译名、真实登录与 MFA、全部主要门户以及字典遗漏检查。权限验证采用临时账户、企业及商品，测试结束后清理；不修改演示账号的密码或 MFA。

完整 CI 仍使用 `playwright.config.ts` 及 HTTPS 代理验证生产构建。语言用例的默认本地入口为 `http://localhost:3000`，可通过 `WEMOVE_LOCALE_BASE_URL` 指定已运行的其他测试地址。

2026-09-08 本地验证：Chromium、WebKit 各 26 项语言用例通过（含失败定位后的重跑），API 154 项单测、前后端类型检查、API lint 及生产构建通过。Firefox 可执行文件在本机报 `spawn UNKNOWN`，其 23 项浏览器用例未能启动，不记为通过；3 项纯逻辑检查通过。当前结果属于本地工作区，后续合入主线仍需运行最终提交的 CI。
