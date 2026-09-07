# WEMOVE 部署、备份、恢复与监控

更新：2026-09-08。本文区分已经执行的本机验证、交付的运行代码、仍需正式环境完成的验收。不要把开发分支 CI #44 或历史部署记录当作最终整合版本证据。

## 1. 交付内容

| 文件 | 功能 |
| --- | --- |
| `infra/production/Dockerfile` | Node 22 多阶段 API、Prisma 迁移、Next standalone、扫描器；PostgreSQL 16 与 pgBackRest 镜像 |
| `infra/production/compose.yml` | 独立项目、私有数据库/Redis、API、Web、Caddy、ClamAV、持久媒体卷、可选完整监控栈 |
| `infra/production/Caddyfile` | 自动证书/HTTPS 跳转、反向代理、主动健康检查、HTTP 压缩、安全响应头、访问日志敏感令牌过滤 |
| `scripts/ops-scanner.mjs` | 有认证的二进制扫描接口；ClamAV INSTREAM 协议；恶意文件拒绝、超时/不确定结果拒绝 |
| `scripts/ops-backup*.mjs`、`ops-restore.mjs` | 一致性快照导出、AES-256-GCM 加密、认证 manifest、密文 SHA256、媒体归档、禁止覆盖原库的恢复和逐表行数验证 |
| `scripts/ops-pgbackrest.mjs`、`ops-pitr-restore.mjs` | 日常物理全量/差异备份、WAL 归档、独立新卷时间点恢复 |
| `infra/production/systemd/` | 每日全量和每六小时差异备份定时器，首次安装需主机运维执行 |
| `scripts/ops-metrics.mjs`、`infra/production/monitoring/` | Prometheus、服务探针、业务/备份告警、Alertmanager、项目日志集中到 Loki |
| `.github/workflows/ci.yml` | 最终提交的类型、lint、单测、迁移、DB/邮件集成、浏览器/无障碍、依赖审计、加密恢复、生产镜像检查 |

`infra/docker-compose.yml` 保留为开发环境。生产、Staging、UAT 使用不同主机或不同 Compose project、域名、密钥、数据库、Redis 和媒体卷；不要共用生产数据。主机系统时间需同步，否则 TOTP、签名回调、证书和恢复时间点会出错。

## 2. 首次部署

运行主机要求 Linux、Docker Engine/Compose、Node 22+；为 ClamAV 签名库和数据库预留实际内存与持久磁盘。正式域名 A/AAAA 指向主机，允许入站 TCP 80/443 和 UDP 443、证书服务/SMTP/支付/ClamAV 签名更新所需出站连接。错误 AAAA 记录也会影响证书签发。

1. 将 `infra/production/.env.example` 复制到独立受保护环境文件，填写所有空必填项。`RELEASE` 使用通过最终验收的 Git revision，不能使用随时变化的开发分支名。各密钥分别随机生成，使用 base64url 可避免 Redis URL 编码问题；DATABASE_URL 的密码仍须 URL 编码。
2. 正式发件域、SMTP、支付创建接口及签名回调密钥由已选供应商提供；后台零售市场只有完成供应商联调后才能启用 provider 支付。部署默认禁止 demo 支付。零售回调地址为 `https://<DOMAIN>/api/v1/commerce/payment-webhook`，经销商回调以当前 B2B controller 契约为准。
3. 生产数据通过受控后台配置/导入完成。**不要向生产执行开发 seed**：它含验收账号和示例内容。首个管理员须采用独立初始凭据，首次登录完成 MFA，交接后修改密码。
4. 对 Staging/UAT 设置 `DEPLOYMENT_ENV=staging`，使用其独立域名/凭据，构建和运行环境保持一致；robots 禁止索引还应结合网络访问限制。
5. 在仓库根目录执行（以下为运维操作说明，本轮没有在生产执行）：

```sh
docker compose --env-file /etc/wemove/production.env -f infra/production/compose.yml config --quiet
docker compose --env-file /etc/wemove/production.env -f infra/production/compose.yml build
docker compose --env-file /etc/wemove/production.env -f infra/production/compose.yml up -d
docker compose --env-file /etc/wemove/production.env -f infra/production/compose.yml ps
node scripts/ops-pgbackrest.mjs --action check --env-file /etc/wemove/production.env --project wemove-production
node scripts/ops-pgbackrest.mjs --action full --env-file /etc/wemove/production.env --project wemove-production
```

Compose 等待数据库、Redis、扫描器健康和迁移成功后启动 API，随后启动 Web/Caddy。API/Web 以非 root 用户运行，根文件系统只读；媒体和 Next 缓存分别使用显式卷/tmpfs。原始媒体仅在 API 私有卷；访问仍经过业务授权及签名，不由 Caddy 直接公开。ClamAV 初次下载签名需要时间；生产上传在扫描不可用时失败关闭。

对实际部署应固定每个基础镜像的已审核 digest（Compose 提供镜像覆盖项，应用镜像使用 RELEASE 标签）；不要把默认版本标签当作永不变化的产物。保存当次镜像 digest、迁移列表、验收报告及配置版本，密钥单独保管。

## 3. 数据库全量、差异与时间点恢复

数据库镜像将 pgBackRest 配置写入 postgres 专属文件：repo1 位于 `backupdata`，备份与 WAL 加密，保留七份全量和 28 份差异；WAL 连续归档且 `archive_timeout=300`。这是恢复能力配置，实际 RPO 受事务活动、WAL 归档延迟及异地存储健康影响，必须用监控和演练确认。只有首次成功全量之后才能承诺时间点恢复。

本机 backup 卷与数据库卷同时丢失仍会造成数据损失。因此生产必须配置第二个独立故障域的 S3 兼容仓库，填写全部 `PGBACKREST_S3_*`，将 `BACKUP_REPOSITORIES=1,2`，备份命令加 `--repos 1,2`。S3 bucket 权限、加密钥匙的离线保存、生命周期与访问审计由正式资源负责人落实。本轮未创建外部 bucket。

安装定时器前，在 `/etc/wemove/ops.env` 配置：

```text
WEMOVE_ENV_FILE=/etc/wemove/production.env
WEMOVE_PROJECT=wemove-production
WEMOVE_BACKUP_REPOS=1,2
```

将 `systemd/` 下三个文件放入系统 unit 目录，调整仓库实际路径（默认 `/opt/wemove`），执行 `systemctl daemon-reload` 后启用两只 timer。全量为 UTC 02:00，差异为 UTC 08:00、14:00、20:00。通过 `systemctl list-timers`、对应 service journal 和 `ops-pgbackrest --action info` 核对执行结果。成功任务发布只含备份时间/大小/仓库编号的指标文件；未备份/超时会告警。加密数据库备份不包含媒体，媒体使用下一节的完整备份，并将加密产物异地保存。

时间点恢复脚本仅允许**不存在的** `wemove_restore_*` 卷。设置已离线保管的 `PGBACKREST_CIPHER_PASS` 后：

```sh
node scripts/ops-pitr-restore.mjs --backup-volume wemove-production_backupdata --target-volume wemove_restore_incident --image wemove-postgres:<tested-release> --time 2026-09-07T08:00:00Z
```

脚本只准备独立新卷，不切流量。随后用同一已测试 PostgreSQL 镜像启动隔离实例，挂载恢复卷及原 backup 卷（只读），传入同一 passphrase、`PGBACKREST_REPOSITORY_READONLY=true`、`PGBACKREST_SKIP_INIT=true`，命令 `postgres -c archive_mode=off`。PostgreSQL 会取回 WAL、恢复到指定 UTC 时刻并 promote。检查恢复日志、`pg_is_in_recovery()`、订单/支付/库存/用户关键记录，以及恢复目标之前/之后的验收标记；验证完成才计划应用切流。需要异地 S3 恢复时按 pgBackRest 官方 repo2 恢复流程使用独立新卷和同版本工具，不能覆盖仍在运行的数据库目录。

## 4. 可移植加密备份与恢复演练

`OPS_BACKUP_KEY` 是 base64 编码的 32 字节密钥，**不同于** pgBackRest passphrase；不得放入命令行参数或提交仓库。完整备份包含数据库及媒体，会暂时停止明确列出的 API/后台 worker 以保持媒体一致性，结束或失败后恢复原先运行状态。调用者必须给出精确 Compose project，脚本核对所有容器标签；在维护窗口执行并列出所有可能写入的 worker。

```sh
node scripts/ops-backup.mjs --container wemove-production-postgres-1 --database wemove --user wemove --output /srv/backups/wemove/20260907 --revision <tested-release> --project wemove-production --quiesce wemove-production-api-1 --media-container wemove-production-api-1
node scripts/ops-restore.mjs --container wemove-production-postgres-1 --database wemove_restore_drill --user wemove --input /srv/backups/wemove/20260907 --media-volume wemove_restore_media
```

输出为 `manifest.json`、`database.dump.enc`、`media.tar.enc`。manifest 含 HMAC，密文含 SHA256 和 GCM tag；恢复先验证元数据与全部文件，随后只创建新库/新媒体卷。数据库采用导出快照，manifest 的每张表行数和 dump 来自同一事务快照；恢复在单事务内执行，并逐表核对行数。已有目标库/卷直接拒绝，不执行 drop 或覆盖。业务一致性、文件可读性和恢复时长仍需按演练清单核实。异地复制时只传完整已生成产物，密钥通过独立渠道保管。

仅验证数据库可用 `--database-only`；该模式不会停止服务，也不包含媒体。CI/本机隔离演练使用 `ops-restore-drill.mjs`，随机临时密钥用于本次完整备份→恢复测试，不保留该测试密钥；该测试产物不可作为日后生产备份使用。新建恢复数据库保留供检查，清理由环境负责人针对精确目标完成。

## 5. 监控、日志和故障处理

准备 `infra/production/secrets/alert-webhook-url`，填写真正的 HTTPS 运维告警接收地址（不是占位值）；文件目录已忽略提交。然后 `docker compose ... --profile monitoring up -d`。

- Prometheus：主机 loopback `9090`；Alertmanager：`9093`；Loki：`3100`，均通过管理 VPN/SSH 隧道访问，不公开管理端口。
- Blackbox 每 30 秒探测 API readiness、Web 和扫描器；API readiness 同时验证数据库及 Redis。
- Caddy 提供 HTTP 延迟、请求计数/5xx；队列积压/死信、过期库存预占、库存同步失败、支付失败比率、搜索无结果、用户同意后的前端错误、数据库连接数/大小、WAL 归档失败、备份过期均有指标或告警。
- Alloy 仅保留当前 Compose project 的 Docker 日志，传入 Loki 保留 30 天；可按 `{project="wemove-production",service="api"}` 或 `service="caddy"` 查询。Docker socket 虽为只读挂载仍提供较高主机权限，因此仅在独立受控运维主机开启 Alloy，不给非运维用户访问该容器。日志不能承载密码、授权头、签名令牌或支付卡数据；Caddy 已删除 Cookie/Authorization 并过滤 token/signature/sig 查询值。
- 发生支付回调失败：按 traceId/订单号核对签名时间窗、供应商事件和幂等状态，不用手动改库伪造支付成功。邮件死信：后台通知工作台核对收件配置与错误后重试。库存源失败：排查来源同步并核对库存，避免简单改可售数量掩盖预占问题。
- 归档/备份告警：先检查仓库可达、密钥、磁盘、pgBackRest check；不要删除仍需恢复的 WAL。服务不可用则检查 `compose ps`、readiness 和对应日志，确认依赖再重启具体服务。

对外月可用率应从独立外部探针统计；本机探针无法证明公网可达、DNS/TLS、跨区域性能或 99.9% 月可用性。此处没有虚构这类生产运行证据。

## 6. 发布和回滚

先在 Staging 用同一 RELEASE 镜像完成下列验收，再记录当前镜像 revision 和成功备份。发布迁移遵循先扩展后迁移后清理，保证前后两版应用短期兼容。用新 RELEASE 执行 compose build/up；健康失败时恢复环境文件的上个已验证 RELEASE，仅重新创建 API/Web，避免重新初始化数据库。迁移通常不能靠镜像回滚撤销；有破坏性 schema/data 变更时停止写入并在隔离新库验证恢复，再计划切换。不得自动执行 `migrate reset`、`down -v` 或覆盖生产卷。

## 7. 本轮实际验证与外部待验收项

已执行：

| 验证 | 结果 |
| --- | --- |
| `node scripts/ops-config-check.mjs` | 使用临时测试值校验 production+monitoring Compose，通过；不读取真实 .env |
| `node --test scripts/ops-backup.test.mjs scripts/ops-scanner.test.mjs` | 4/4 通过：认证/损坏检测、拒绝业务库覆盖、扫描授权/恶意与不确定结果拒绝、真实 TCP INSTREAM 帧 |
| 加密数据库恢复演练 | 从 `wemove_verify_20260907` 导出，2026-09-08 00:24 恢复到全新 `wemove_restore_1788798262509`；62 张表逐表行数一致；原库未写入 |
| metrics 实机连接隔离数据库 | HTTP `/metrics` 返回队列、支付、库存、搜索、数据库指标；测试进程已停止 |
| 身份、认证、偏好、提交与客服 DB 回归 | identity/auth-flow/auth-token/public-submission/contact-triage 五文件 33/33 通过；新增 Contact 6 个实库场景包含分页、导出 MFA/权限、历史、附件 scanStatus |
| CMS/额外语言/搜索/sitemap DB 回归 | platform-flow 14/14 最新重跑通过，含 fr 与 pt-BR 配置、完整法语发布/检索/sitemap、草稿回退、HIDE 与无效码拒绝 |
| 身份/权限/内容/保留期单元回归 | 24/24 通过；登录 next 外部/反斜杠/控制字符拒绝另有 Node 回归 2/2 |
| 全工作区类型检查 | API 与 Web 均通过（检查时的整合工作区） |

新增已执行的真实容器验证（2026-09-07 23:53–23:56，本机隔离环境）：

| 验证 | 结果 / 证据 |
| --- | --- |
| API/Web/PostgreSQL/扫描器生产 Docker targets | 四个镜像构建并导出成功；日志：.local/ops-{api,web,postgres,scanner}-build.log。是该时点源码的证据，追加业务改动后的最终镜像仍须重建 |
| 真实 ClamAV 容器 + HTTP 扫描器 | .local/ops-scanner-report.json 为 passed:true；正常文件 200/clean=true、EICAR 200/clean=false、无认证401、停止引擎后503；容器已停止 |
| pgBackRest 备份、WAL 与时间点恢复 | .local/ops-pitr-report.json 为 passed:true；原实例有 baseline/before-target/after-target，恢复实例只有前两条且 pg_is_in_recovery()=false，确实恢复到目标并 promote；容器已停止、独立卷保留 |
| Caddy 镜像内配置校验 | .local/ops-caddy-check.log 为 Valid configuration；仅格式提示。不是正式域名证书或公网健康验证 |
| Prometheus/Promtool 配置校验 | .local/ops-prometheus-check.log 为 SUCCESS，1 个规则文件、12 条规则；不表示真实告警接收人已收到通知 |

最终源码冻结后追加的运行验证（2026-09-08 01:00，本机独立 Compose 环境）：

| 验证 | 结果 / 证据 |
| --- | --- |
| API、迁移、Web 最终生产镜像 | `finalverify-20260908` 三个 targets 均构建导出成功；API/migrate 最后重建已包含 MFA 30 秒边界修复及 CSV SKU 大小写规范化/历史 SKU 兼容修复，复用未改动的最终 Web 镜像（字体/图片性能调整）；`.local/ops-{api,migrate,web}-final-build.log` |
| 真实生产服务启动 | `.local/ops-runtime-report.json` 为 `passed:true`；新项目 `wemove-runtime-1788800411192` 启动 PostgreSQL、Redis、ClamAV、扫描器、迁移、API、Web；迁移镜像在空库完成 29 个迁移，API readiness 200 且 DB/Redis 均 up |
| Web 与 API 同源代理 | 生产 Web `/en/products` 返回 200、HTML 与真实 main；产品和配置代理 200/code=0；未登录私有账户代理 401。报告记录实际运行的七个镜像 ID |
| 完整数据库和媒体加密备份恢复 | 调用实际备份脚本停止本项目 API 后备份数据库与媒体，并恢复到新库/卷 `wemove_restore_runtime_1788800440993`；62 张表逐表一致，媒体 4096 字节随机二进制验收文件 SHA256 一致；API 自动恢复运行且 readiness 再次通过 |

这次演练没有发布外部端口、申请正式证书或发送外部邮件；临时凭据文件已移除，所有演练容器已停止，独立恢复卷保留。完整媒体恢复采用本次生成的文件，验证的是恢复机制及字节完整性，不代表正式业务媒体、异地副本、恢复容量或生产切流已验收。

此前 Docker Hub HEAD EOF 已恢复，不再作为上述验证的阻碍。首次 PITR 报告 .local/ops-pitr-report-first-failure.json 保留失败记录；将 pgBackRest target 从 ISO 字符串规范为 UTC 时间格式后重跑成功，成功目标为 2026-09-07T15:55:35.933Z。演练随机口令没有保留，隔离卷是检查证据，不能当作长期可恢复的生产备份；未修改原有容器或卷。

旧迁移构建日志 `.local/ops-migrate-build.log` 保留并发编辑阶段的 API 编译失败；最终 `.local/ops-migrate-final-build.log` 已成功，且上表真实启动完成全部迁移。不能将较早失败日志或开发分支 CI 当作最终版本证据；最终提交的远程 CI 由主任务另行核对。

用已构建镜像复跑：

- node scripts/ops-scanner-drill.mjs --image wemove-scanner:<tested-release>
- node scripts/ops-pitr-drill.mjs --image wemove-postgres:<tested-release>
- node scripts/ops-runtime-drill.mjs --release <tested-release>

脚本创建带演练标签的独立资源，生成本次随机密钥并输出 JSON 报告。扫描器脚本清理临时容器/网络；PITR 和运行/完整恢复演练停止容器并保留独立卷供检查。CI 已在全部生产镜像构建后纳入这三个真实演练并上传报告；远程结果仍需核对最终提交实际 CI，不能把写入工作流说成远程通过。

运行约束与已交付行为：

- 管理员密码认证只签发挑战，MFA 验证后才发会话；员工停用、权限/成员撤销及登出在下一请求读取数据库生效。高风险导出、角色权限及客服写操作仍要求当前 MFA 码。
- 账户资料与 newsletter 营销状态保持事务一致：账户退订使已有订阅失效，明确重新订阅替换旧链接，token 退订同步账户偏好。密码、订单、客服等事务通知继续入队。公共重复订阅/联系提交有事务锁、幂等键与发送去重。
- 客服列表支持状态、优先级、来源、搜索、团队/未分配筛选和分页；CSV 使用同一筛选并导出所有匹配记录，排除姓名、邮箱、正文和内部备注。保存分配时回填当前值，六种状态、备注、外发邮件和处理人保留历史。附件在强制扫描时仅接受 CLEAN；其他情况下也拒绝清理中/隔离/扫描中资料。
- Analytics 按 `tracking.retentionDays`（1–365，默认 90）每日清理；过期 challenge/一次性令牌保留 7 天后清理，失效会话保留 30 天后清理；不清理审计或隐私请求记录。worker 分布式锁避免多实例重复，`RETENTION_WORKER=false` 可显式禁用；测试环境自动停用定时 worker。
- 后台语言设置保留英文默认，允许 `^[a-z]{2,3}(?:-[A-Z]{2})?$` 代码与地区变体；CMS、搜索、产品与 sitemap 使用已发布的完整译文，缺失按整页英文回退或 HIDE。当前站点固定 UI 字典覆盖 en/zh/fr/de，其他配置语言及尚未翻译的账户/结算等模板跳转完整英文页；sitemap 排除会跳转的语言版本。配置语言不代表已经人工完成该语言的正文。
- 根 skiplink 指向实际的可聚焦 `main`，非 storefront 登录/账户/工作台保持唯一主内容区域。凭据表单在 hydration 完成前禁用并声明 POST，避免未接管时意外 GET 提交；登录 next 只接受规范化后的同源路径。

正式上线还需真实域名/TLS、SMTP送达、支付供应商/回调、异地备份资源及恢复钥匙托管、告警接收端与演练、正式业务数据/媒体的恢复容量验收、生产/异地 PITR 恢复与切流演练、正式品牌/公司信息及审批、跨区域/真机性能、连续外部可用性统计。这些需要真实配置或运行证据，不能由示例数据和本机测试替代。

实现依据：[Docker Compose 启动依赖](https://docs.docker.com/compose/how-tos/startup-order/)、[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)、[PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html)、[pgBackRest 备份与恢复](https://pgbackrest.org/user-guide.html)、[ClamAV 协议](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)、[Prometheus 告警配置](https://prometheus.io/docs/alerting/latest/configuration/)。
