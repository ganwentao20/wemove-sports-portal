# CI #49 整合验收证据

来源：[GitHub Actions #49](https://github.com/ganwentao20/wemove-sports-portal/actions/runs/34147768469)，2026-09-08 北京时间完成。此目录是该次 artifact 的原字节摘录，不是文档整理时重新执行的测试；完整运行步骤及日志仍由 GitHub 提供。

源码 `0d33eef8a8d1bdd78be20c6977c2f6b1f179aee8` 已整合 main `5642da2`，CI 检出 `d35819d`，实测 tree 为 `9c5e9dbd57f722e5471e013d90db70b1ffabf99d`。PR #10 仍是草稿，不能将整合检出理解为已合并 main。

| 文件 | 用途 |
| --- | --- |
| [acceptance-revision.json](acceptance-revision.json) | 源码、main、CI 检出及树一致性 |
| [lighthouse/summary.json](lighthouse/summary.json) | 四模板三次冷浏览器样本、有限样本 API P95 |
| `lighthouse/*.json` | 12 份原始 Lighthouse 报告，可复核样本与评分；HTML 仍在完整 artifact |
| [ops-runtime-report.json](ops-runtime-report.json) | 生产镜像实际运行、29 迁移、62 表与 4096 字节媒体恢复、应用恢复 |
| [ops-restore-report.json](ops-restore-report.json) | 较早的独立数据库恢复，不包含媒体恢复 |
| [ops-scanner-report.json](ops-scanner-report.json) | 真实 ClamAV clean/EICAR、鉴权及故障演练 |
| [ops-pitr-report.json](ops-pitr-report.json) | full/diff/WAL 时间点恢复隔离演练 |
| [首页 390](screenshots/home-390.png)、[首页 1440](screenshots/home-1440.png)、[后台 CMS](screenshots/admin-cms.png) | 三张 CI 真实页面截图，测试数据不冒充正式业务内容 |
| [manifest.json](manifest.json) | artifact 来源、ZIP 哈希、各文件源路径、长度和 SHA-256 |

该轮日志分别记录 110 单测、169 DB/HTTP/邮件用例、67 浏览器/性能用例通过。这些数字来自不同测试层，不相加为独立需求覆盖率。详细限制见[测试报告 v0.6](../../test-report.md)：未据此完成最终 100 并发/90% 浏览与 10% 登录混合压测、真机人工无障碍、生产商户联调或现场 SLA。

后续提交的 CI 以 [PR Checks](https://github.com/ganwentao20/wemove-sports-portal/pull/10/checks) 为准；本目录保持 #49 证据不改写。
