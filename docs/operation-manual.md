# WEMOVE SPORTS 系统操作手册

版本：v0.3　日期：2026-09-07　责任人：倪依玲（组员 D）

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

### 注册与认证

- `/customer/register`：填写姓名、邮箱、密码，并确认本人满 18 岁。
- 若启用邮箱验证，从 Mailpit 邮件打开 `/verify-email?token=...`，点击 Verify email。
- `/customer/login`：登录成功后进入账户中心。
- 忘记密码：登录页进入 `/forgot-password`；打开邮件中的 `/reset-password?token=...` 设置新密码。

### 购物车和订单

- 商品详情选择 SKU、数量后加入购物车；未登录会跳转登录并带回原页面。
- `/customer/account` 可改数量、移除或清空购物车。
- Place order 会创建 PENDING 订单、保存整数分价格快照并锁定库存。
- 客户只可取消 PENDING 订单；取消后库存自动返还。

## 3. 经销商

- `/dealer/apply` 分步提交企业资料。资质附件可选，仅支持 PDF/JPG/PNG 且不超过 5 MB，以私有媒体存储；登录客户提交会绑定本人账号。
- 后台批准后，重新登录 `/dealer/login`，进入 `/dealer/catalog` 查看所属企业授权价。
- `/dealer/quick-order` 每行输入 `SKU, 数量`，最多 100 行；系统逐行返回重复、未授权、无价格或库存不足错误。
- 当前 Quick Order 只做安全校验与报价预览；RFQ/PO 落库等待企业业务单据模型评审。

## 4. 后台员工

### 登录与 MFA

- `/admin/login` 使用独立 Staff 账号，客户账号不能登录后台。
- 首次敏感操作前，通过 API/管理流程完成 MFA setup 和 confirm。
- 后台写操作输入认证器当前 6 位动态码；连续错误会锁定。

### 经销商审核

- `/admin/dealers` 查看申请和私有资质附件（临时签名链接），填写意见和 MFA。
- 补件、拒绝必须写原因；批准会在事务中建立/批准企业并绑定申请人为 OWNER。

### 商品、SKU、库存和订单

- `/admin/products` 新建商品与 SKU，填写适龄提示、整数分价格和初始库存；上架/归档需确认及 MFA。
- SKU 唯一；库存不能为负。
- `/admin/orders` 按状态筛选；允许 PENDING→CONFIRMED→FULFILLED，PENDING/CONFIRMED→CANCELLED，非法转换会拒绝。

### CMS、媒体和联系工单

- `/admin/cms` 新建草稿，sections 必须是 JSON 数组；发布前草稿不会出现在公共接口。
- `/admin/media` 仅允许 JPG、PNG、WebP、PDF，单文件不超过 5 MB；私有文件通过 60 秒签名链接下载。
- `/admin/contacts` 查看访客留言，用 MFA 更新 NEW/IN_PROGRESS/RESOLVED/CLOSED 状态。

## 5. SEO 与健康检查

- `/robots.txt` 禁止抓取 customer/dealer/admin/api。
- `/sitemap.xml` 包含公共静态页和最多 100 个当前上架商品。
- `/catalog`、`/help`、`/about-us` 分别永久重定向到新路径。
- `/api/v1/health/live` 只检查进程；`/api/v1/health/ready` 在 PostgreSQL 或 Redis 不可用时返回 503。

## 6. 常见问题

- 页面显示服务暂不可用：确认 API 8080、PostgreSQL、Redis 均启动，并检查 ready 探针。
- 登录后又回到登录页：会话 Cookie 已过期/吊销；重新登录，不要把 JWT 写入 localStorage。
- MFA 一直失败：校准手机时间，等待下一组 TOTP；锁定后按安全窗口等待。
- 邮件未收到：本地检查 Mailpit；生产检查 SMTP 与 `APP_BASE_URL`，不要在日志公开令牌。
- 上传被拒：核对扩展名、真实 MIME 和 5 MB 限制。

## 7. 最终手册待补证据

组员 D 需在冻结版本补入：首页、注册邮件、购物车结算、经销商审核、商品/SKU、订单、CMS、媒体、工单、robots/sitemap 的实际截图，并标注图号、操作账号角色和日期。截图不得包含密码、JWT、MFA secret 或完整邮箱令牌。
