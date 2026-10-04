# __APP_NAME__

由 `create-store-app` 生成的数据驱动应用骨架（common-store / py-store）。

## 结构

```
store.config.json   装载配置：sources（连接 kind + databases）+ defs（定义根）
schema/<db>/Order.json   定义即数据：纯 JSON schema；落点由目录层级承载
impl/bootstrap.py   入口：create_app（config=store.config.json）初始化后经 store-gateway 起协议面
scripts/publish-defs.py  把定义（经 core 纯规划落点）发布到 meta-store
seed/seed.json      示例种子数据
cases/smoke.json    冒烟用例
```

> `impl/bootstrap.py` 在 `create_app` 初始化数据层后，用 `store-gateway` 起协议面；
> 协议皮由脚手架的 `--skins` 决定（`rest` / `graphql` / `grpc`，至少 1 个），
> 依赖经 `store-gateway-py[<皮...>]` extras 引入。

## 落点目录约定

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

把 `schema/` 下定义发布到 meta-store：

```bash
META_URL=http://127.0.0.1:8600 python scripts/publish-defs.py
```

环境变量：`META_URL`（必填，meta-store 地址）、`ACTOR`（默认 `ci`）。任一发布失败退出码 1。
仅用标准库（`urllib`），不新增依赖；预览清单用 `--dry-run`。

## 运行

```bash
pip install -e .        # 依赖含 store-gateway-py[<由 --skins 决定的皮>]
python impl/bootstrap.py
```

环境变量：`MONGO_URI`（默认 `mongodb://127.0.0.1:27017`）、`MONGO_DB`（默认 `__APP_NAME__`）、`PORT`（默认 `3000`）、`GRPC_PORT`（选 `grpc` 时，默认 `50051`）。

## 降级事件如何查

运行期的降级 / 拦截 / 兜底事件统一落内建 `__feedback`（`create_app` 默认接线，`feedback=False` 可关），经数据层查询：

```python
rows = await app["store"].query(
    "__feedback($condition:@c0){ code, type, layer, message, hint, tenant, env, now }",
    {"c0": {}},
)
```

字段：`type` / `code` / `layer` / `message` / `hint`（+ `tenant` / `env` / `now`）。该表 `write` 白名单为空——业务 GQL 不可篡改审计。
