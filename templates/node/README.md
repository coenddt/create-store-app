# __APP_NAME__

由 `create-store-app` 生成的数据驱动应用骨架（common-store / nodejs-store）。

## 结构

```
store.config.json   装载配置：sources（连接 kind + databases）+ defs（定义根）
schema/<db>/Order.json   定义即数据：纯 JSON schema；落点由目录层级承载
impl/bootstrap.js   入口：调用 nodejs-store 的 createApp（config=store.config.json）起服务
impl/fns.js         计算列回调实现（fnRef → impl），启动时经 fns 注入
scripts/publish-defs.js  把定义（经 core 纯规划落点）发布到 meta-store
seed/seed.json      示例种子数据
cases/smoke.json    冒烟用例（GET /api/Order → 200）
```

> 定义文件只写 `fnRef` 字符串，函数实现落在 `impl/fns.js`；缺实现时启动即抛
> `ERR_FN_MISSING`（不静默）。

## 运行

```bash
npm install
npm start            # 默认 http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/Order
```

环境变量：`MONGO_URI`（默认 `mongodb://127.0.0.1:27017`）、`MONGO_DB`（默认 `__APP_NAME__`）、`PORT`（默认 `3000`）。
另：`META_TENANT` / `META_ENV`（都设了才开启发布-重载闭环，见下）。

## 协议面

`impl/bootstrap.js` 的 `skins` 块由脚手架按所选协议皮生成（`--skins`，至少 1 个），依赖包随之写入 `package.json`：

| 皮 | 依赖包 | 装配子选项 | 端点 |
|---|---|---|---|
| `rest`（默认） | `store-api-node` | `prefix`（默认 `/api`） | `GET /api/<Model>` |
| `graphql` | `store-graphql-node` | `path`（默认 `/graphql`） | `POST /graphql` |
| `grpc` | `store-grpc-node` | `port`（默认 `GRPC_PORT` / 50051） | gRPC |

`http` 键固定启用（`PORT`，默认 3000），不属协议皮。脚手架默认只装 `rest`，其余皮在 `--skins` 中显式选择。

## 落点目录约定

<!-- SPEC:LOCATION:BEGIN -->
### Location: directory semantics + connection config (definitions carry no location)

A schema definition file contains no location fields (no `source` / `database` / `schema`; `namespace` is removed). Location is resolved from the definition directory layout plus the connection config:

- Under the definitions root `<defs-root>/`: the first directory level is the `database`; PostgreSQL adds a second level for `schema` (Mongo / MySQL / SQLite have no such level); deeper levels are free-form and flattened at load time (no hierarchy semantics).
- The connection config (`store.config.json`) declares `sources` (`kind` + `databases`) and `defs`; `kind` decides whether that database directory is read one level deeper for `schema`.
- Location fields are `source` / `database` / `schema` (PG only) / `collection`; the word `namespace` is removed.
- Same-named schemas: exactly one primary (no `replica`); the rest declare `{ "name": "...", "replica": true }`, add only a link, and must not repeat the structure. Zero or two-or-more primaries is an error.
- A duplicated `name` within one load batch is an error and the service does not start; re-loading the same `name` across versions bumps its version by 1.
- Writes are synchronized within a single connection, across the primary plus all links, in one transaction; a write spanning a cross-connection link is explicitly rejected or degraded with a feedback event (never silent).
<!-- SPEC:LOCATION:END -->

落点（`source` / `database` / `schema`）由「目录层级 + `store.config.json`」承载，**不写进 defn**（禁写 `namespace`/`source`/`database`/`schema`）。定义按「一个文件一个 schema」组织，脚本递归发现：

```
store.config.json
  sources: { <source>: { kind, databases: [...] } }   # 连接与其维护的库
  defs:    ["schema"]                                  # 定义根（相对本文件）

schema/
  <db>/Order.json          # L1 = database（须在 sources 的某连接 databases 中声明）
  <db>/Inventory/Sku.json  # 非 PG：L2+ 打平，仍归属该 db
  pg_db/app/Customer.json  # PG：L2 = schema（"app"）；L3+ 打平
  _draft/                  # `_` 前缀目录/文件忽略
```

- **L1 = database**：目录首段即库名；库名未在 `sources` 中声明 ⇒ 报错。
- **仅 PG 读 L2 = schema**：Postgres 连接的第二段目录即 `schema`；Mongo/MySQL/SQLite 的 L2+ 全部打平（仅影响归属，不改变 database）。
- **主从**：同名定义**恰好一份主**（无 `replica`），其余写 `{ "name": ..., "replica": true }` 为从（从定义只声明链路，发布时**不进控制面**）。
- **报错即退出码非 0**：同名主 ≥2 份 / 主 0 份 / 落点冲突 / 库未声明 / `kind` 非法 ⇒ 抛 `ERR:LOAD`（进程不启动 / 脚本退出码非 0，不静默）。
- 递归发现 `**/*.json`；`.json` 之外忽略；`_` 前缀目录/文件忽略。
- 预览将要发布的清单（落点 source/database/schema，不发请求）：`--dry-run`。

## 发布定义

把 `schema/` 下定义发布到 meta-store，再 `POST /-/reload` 使新定义对协议面可见：

```bash
# 业务进程（需设 META_TENANT / META_ENV 才开启 reload 重建）
META_TENANT=dev META_ENV=local npm start
# 发布定义（META_DB 须与业务进程的 MONGO_DB 同库，二者共用 __schemaDef 表）
META_URL=http://127.0.0.1:8600 npm run defs:publish
# 重装配（重建注册表后原子替换路由；业务进程 PID 不变）
curl -X POST http://127.0.0.1:3000/-/reload
```

环境变量：`META_URL`（必填，meta-store 地址）、`ACTOR`（默认 `ci`）。任一发布失败退出码 1。

## 降级事件如何查

运行期的降级 / 拦截 / 兜底事件统一落内建 `__feedback`（`createApp` 默认接线，`feedback: false` 可关），可用 GQL 查询：

```bash
curl "http://127.0.0.1:3000/api/__feedback"
```

字段：`type` / `code` / `layer` / `message` / `hint`（+ `tenant` / `env` / `now`）。该表 `write` 白名单为空——业务 GQL 不可篡改审计。
