# 首版压测方案（组员 E · 工程与质量）

> 对应任务卡 E2「首版压测准备」与需求文档 ④ 的非功能指标（N-01/N-02）。
> 本文件为方案与口径，执行结果与截图后续归档进 ⑤ 测试报告（与 CI 结果一致可复核）。

## 1. 目标指标（口径与需求一致）

| 编号 | 指标 | 口径 | 目标 |
|---|---|---|---|
| N-01 | 关键页首屏性能 | 浏览器首屏 ≤2.5s；API 层以 `/products`、`/products/:slug` 为代理口径 | P95 响应时间尽量接近且不显著劣化（本地基线） |
| N-02 | 并发稳定性 | 100 并发，只读 + 登录混合场景 | 错误率 0；不因本压测误触全局 IP 限流（12000/min，见备注） |
| N-04 | 安全 | 公开商品接口不泄漏 B2B 底价字段 | 冒烟测试已断言，压测响应抽样复核 |

> 备注：全局限流默认 12000/min（约 200 req/s），代码见 `apps/api/src/common/rate-limit.middleware.ts`。
> 压测容量场景前用 `$env:GLOBAL_RATE_LIMIT_PER_MIN="600000"` 启动 API 提限，避免 429 干扰吞吐读数；
> 默认限流下的 429 结果单独作为「安全防护生效」证据保留。

## 2. 压测环境

- 机器：Lenovo 笔记本（本地单机），Windows；日期：2026-09-06
- 依赖：`npm run db:up`（PostgreSQL 16 / Redis 7）+ `npm run dev:api`（NestJS dev watch 模式，http://localhost:8080/api/v1）
- 数据：`npm run db:seed` 演示数据
- 工具：autocannon 8.0.0（npx 临时安装，未写入仓库依赖）
- 说明：dev 模式数字偏保守；答辩演示按相同环境复现即可，报告须注明机器与模式

## 3. 场景与工具

### 阶段一：只读基线（autocannon）

```powershell
# 默认限流（验证 429 防护）
npx autocannon -c 100 -d 30 "http://localhost:8080/api/v1/products"
npx autocannon -c 100 -d 30 "http://localhost:8080/api/v1/products/strike-kids-bowling-set-6-pin"

# 容量基线（先提限再启动 API：$env:GLOBAL_RATE_LIMIT_PER_MIN="600000"; npm run dev:api）
npx autocannon -c 100 -d 30 "http://localhost:8080/api/v1/products"
npx autocannon -c 100 -d 30 "http://localhost:8080/api/v1/products/strike-kids-bowling-set-6-pin"
```

记录：Avg / P99 / Max 延迟、每秒请求数、2xx 与 429 数。

### 阶段二：只读 + 登录混合（k6，后续补脚本）

- 场景比例：90% 浏览商品（列表/详情）+ 10% 登录（customer@wemove.local / Demo@123456）
- 并发：100（VU 阶梯：0 → 100）
- 预期输出：各场景 P95、错误率、429 次数
- 脚本建议路径：`infra/load-test/login-mix.js`（下轮补齐并随 ⑤ 报告附执行结果）

## 4. 首轮实测记录（2026-09-06）

### 4.1 默认限流（安全防护验证：12000/min）

| 场景 | 2xx | 429（非 2xx） | Avg | P99 | Max | 平均每秒请求（含被限部分） | 结论 |
|---|---|---|---|---|---|---|---|
| GET /products | 12,000 | ≈66,247 | 37.9 ms | 135 ms | 338 ms | ≈2,608 | 窗口内放行数精确等于 12000，超限返回 429，防护按设计生效 |
| GET /products/:slug | 11,279 | ≈79,796 | 32.5 ms | 99 ms | 138 ms | ≈3,036 | 同上 |

### 4.2 提限容量基线（GLOBAL_RATE_LIMIT_PER_MIN=600000）

| 场景 | 总请求 | Avg | P99 | Max | 平均每秒请求 | 错误数 | 结论 |
|---|---|---|---|---|---|---|---|
| GET /products | ≈34k / 30s | 88.9 ms | 132 ms | 264 ms | ≈1,121 | 0 | 100 并发稳定，无错误 |
| GET /products/:slug | ≈42k / 30s | 70.6 ms | 93 ms | 129 ms | ≈1,409 | 0 | 100 并发稳定，无错误 |

### 4.3 结论

- N-01（API 层口径）：100 并发下 P99 为 93–132 ms，最大 264 ms，远低于 2.5 s 指标 ✅
- N-02：100 并发只读场景错误率 0；登录混合场景待阶段二补测
- 安全：默认限流 12000/min 精确生效，超限返回 429（code 42900），可作防护证据
- 说明：autocannon 默认输出无 P95 列，记录以 P99 为准；浏览器首屏指标后续在答辩演示环境用 DevTools 复核

## 5. 交付关联

- ⑤ 测试报告：性能与安全章节直接引用 §4 数据
- 需求追溯矩阵（附录 A）：N-01 / N-02 首轮实测完成，待阶段二与 ⑤ 报告定稿后置 ✅
