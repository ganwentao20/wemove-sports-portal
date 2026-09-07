# WEMOVE SPORTS 系统操作手册

版本：v0.4　日期：2026-09-07　责任人：倪依玲（组员 D）；本轮 B2B 章节由甘文韬补充

## 1. 启动与演示准备

1. 在仓库根目录执行 `npm ci`。
2. 复制 `apps/api/.env.example` 为 `apps/api/.env`。
3. 执行 `npm run db:up`、`npm run db:deploy`、`npm run db:seed`。
4. 执行 `npm run dev`。
5. 访问 Web `http://localhost:3000`、API 就绪探针 `http://localhost:8080/api/v1/health/ready`、Mailpit `http://localhost:8025`。

演示密码只可用于本地/测试；生产环境必须替换 JWT 密钥、管理员密码、MFA 密钥和邮件配置。

## 2. 访客与客户

### 浏览、搜索和联系

- 首页进入 Products，可用分类和 URL 查询筛选；商品卡只展示零售价。
- Search 输入关键词进入结果页；无结果时显示空态。
- Contact 填写姓名、邮箱、主题和至少 10 个字符的内容。成功后页面显示已接收提示。

> **截图占位：图 1**
> - **图号**：图 1
> - **页面**：首页、商品入口和联系入口
> - **操作账号角色**：访客
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：本地或测试环境，`http://localhost:3000`
> - **图片**：`[此处插入图 1：首页截图]`


### 注册与认证

- `/customer/register`：填写姓名、邮箱、密码，并确认本人满 18 岁。
- 若启用邮箱验证，从 Mailpit 邮件打开 `/verify-email?token=...`，点击 Verify email。
- `/customer/login`：登录成功后进入账户中心。
- 忘记密码：登录页进入 `/forgot-password`；打开邮件中的 `/reset-password?token=...` 设置新密码。

> **截图占位：图 2**
> - **图号**：图 2
> - **页面**：注册页面和 Mailpit 注册验证邮件
> - **操作账号角色**：访客；Mailpit 为测试邮箱查看者
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：`http://localhost:3000/customer/register`、`http://localhost:8025`
> - **图片**：`[此处插入图 2：注册邮件截图，隐藏完整验证令牌]`

### 购物车和订单

- 商品详情选择 SKU、数量后加入购物车；未登录会跳转登录并带回原页面。
- `/customer/account` 可改数量、移除或清空购物车。
- Place order 会创建 PENDING 订单、保存整数分价格快照并锁定库存。
- 客户只可取消 PENDING 订单；取消后库存自动返还。

> **截图占位：图 3**
> - **图号**：图 3
> - **页面**：购物车、结算结果和客户订单
> - **操作账号角色**：注册客户
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：`http://localhost:3000/customer/account`
> - **图片**：`[此处插入图 3：购物车结算截图]`

## 3. 经销商

- `/dealer/apply` 分步提交企业资料。资质附件可选，仅支持 PDF/JPG/PNG 且不超过 5 MB，以私有媒体存储；登录客户提交会绑定本人账号。
- 后台批准后，重新登录 `/dealer/login`，进入 `/dealer/catalog` 查看所属企业授权价。
- `/dealer/quick-order` 每行输入 `SKU, 数量`，最多 100 行；系统逐行返回重复、未授权、无价格或库存不足错误。
- 校验全部通过后填写 Request title，点击 Create RFQ draft；进入 `/dealer/procurement` 后点击 Submit for quotation。
- 销售报价后可查看最新和历史版本、有效期、税费与运费。OWNER/BUYER 可接受或拒绝；VIEWER 只读。
- 接受报价后填写收货信息并确认，创建企业 PO 并预留库存。重复同版本接受返回已有 PO。
- PO 仅在 PENDING_REVIEW 时可取消；取消库存自动返还。企业暂停、成员撤销、过期或旧版本报价会被服务端拒绝。

> **截图占位：图 4**
> - **图号**：图 4
> - **页面**：经销商申请和后台审核
> - **操作账号角色**：访客/经销商成员；Staff 管理员
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：`/dealer/apply`、`/admin/dealers`
> - **图片**：`[此处插入图 4：经销商审核截图，隐藏申请人敏感信息]`

## 4. 后台管理

### 4.1 商品、SKU、库存和订单

- `/admin/products` 新建商品与 SKU，填写适龄提示、整数分价格和初始库存；上架/归档需确认及 MFA。
- `/admin/dealers` 查看申请和私有资质附件（临时签名链接），填写意见和 MFA。

> **截图占位：图 5**
> - **图号**：图 5
> - **页面**：商品/SKU/库存管理和订单工作台
> - **操作账号角色**：Staff 管理员或 Super Admin
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：`/admin/products`、`/admin/orders`
> - **图片**：`[此处插入图 5：商品、SKU 和订单后台截图]`

### 4.2 B2B 报价、采购履约与价格表授权

- `/admin/b2b` 显示 RFQ/PO 和价格表授权；所有保存操作需当前 MFA。
- 对 SUBMITTED/QUOTED 询价逐 SKU 填写 USD 单价、税费、运费和本地有效期，发行新报价。旧版本只读，刷新后才能基于最新 revision 继续报价。
- PO 按 CONFIRMED→PROCESSING→SHIPPED→COMPLETED 操作；确认前可取消；发货才消耗预留库存。
- Create book 建价目表，在公司下勾选后 Save company access；清空勾选保存即撤销授权。价目表内规则继续使用 `/admin/pricing-rules` API，由商品价格模块维护。

### 4.3 CMS、媒体和联系工单

- `/admin/cms` 新建草稿，sections 必须是 JSON 数组；发布前草稿不会出现在公共接口。
- `/admin/media` 仅允许 JPG、PNG、WebP、PDF，单文件不超过 5 MB；私有文件通过 60 秒签名链接下载。
- `/admin/contacts` 查看访客留言，用 MFA 更新 NEW/IN_PROGRESS/RESOLVED/CLOSED 状态。

> **截图占位：图 6**
> - **图号**：图 6
> - **页面**：CMS、媒体中心和联系工单
> - **操作账号角色**：Staff 管理员或 Super Admin
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：`/admin/cms`、`/admin/media`、`/admin/contacts`
> - **图片**：`[此处插入图 6：CMS、媒体和工单后台截图]`

---
## 5. SEO 与健康检查

- `/robots.txt` 禁止抓取 customer/dealer/admin/api。
- `/sitemap.xml` 包含公共静态页和最多 100 个当前上架商品。
- `/catalog`、`/help`、`/about-us` 分别永久重定向到新路径。
- `/api/v1/health/live` 只检查进程；`/api/v1/health/ready` 在 PostgreSQL 或 Redis 不可用时返回 503。

> **截图占位：图 7**
> - **图号**：图 7
> - **页面**：robots、sitemap、重定向和健康检查
> - **操作账号角色**：访客或未登录用户
> - **日期**：`待补（YYYY-MM-DD）`
> - **环境/地址**：`/robots.txt`、`/sitemap.xml`、健康检查地址
> - **图片**：`[此处插入图 7：SEO 与健康检查截图]`

---
## 6. 常见问题

- 页面显示服务暂不可用：确认 API 8080、PostgreSQL、Redis 均启动，并检查 ready 探针。
- 登录后又回到登录页：会话 Cookie 已过期/吊销；重新登录，不要把 JWT 写入 localStorage。
- MFA 一直失败：校准手机时间，等待下一组 TOTP；锁定后按安全窗口等待。
- 邮件未收到：本地检查 Mailpit；生产检查 SMTP 与 `APP_BASE_URL`，不要在日志公开令牌。
- 上传被拒：核对扩展名、真实 MIME 和 5 MB 限制。



## 7. 截图替换清单

### 7.1 图号对照表

| 图号 | 证据内容 | 操作账号角色 | 当前状态 |
|------|----------|-------------|----------|
| 图 1 | 首页、商品入口和联系入口 | 访客 | 待补截图 |
| 图 2 | 注册页面和 Mailpit 验证邮件 | 访客/测试邮箱查看者 | 待补截图 |
| 图 3 | 购物车、结算和客户订单 | 注册客户 | 待补截图 |
| 图 4 | 经销商申请和审核 | 经销商成员/Staff 管理员 | 待补截图 |
| 图 5 | 商品、SKU、库存和订单后台 | Staff 管理员/Super Admin | 待补截图 |
| 图 6 | CMS、媒体和联系工单 | Staff 管理员/Super Admin | 待补截图 |
| 图 7 | robots、sitemap、重定向和健康检查 | 访客/未登录用户 | 待补截图 |

### 7.2 截图规范

1. **标注信息**：每张截图必须保留图号、操作账号角色、日期（格式 `YYYY-MM-DD`）、环境说明。
2. **环境标注**：截图环境为本地/测试环境时，必须在图注中明确标注，不得将本地截图描述为生产环境证据。
3. **敏感信息遮挡**：截图不得包含密码、JWT、MFA secret、数据库连接字符串或完整邮箱验证/重置令牌。
4. **替换方式**：最终提交前，将每个 `[此处插入图 N：...]` 替换为实际图片，并保留上述标注信息。

---
