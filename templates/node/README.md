# __APP_NAME__

由 `create-store-app` 生成的数据驱动应用骨架（common-store / nodejs-store）。

## 结构

```
schema/Order.json   定义即数据：纯 JSON schema（无函数值）
impl/bootstrap.js   入口：调用 nodejs-store 的 createApp 起服务
impl/fns.js         计算列回调实现（fnRef → impl），启动时经 fns 注入
scripts/publish-defs.js  把定义发布到 meta-store
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

## schema 目录约定

定义按「一个文件一个 schema（或文件内数组）」组织，脚本递归发现：

```
schema/
  Order.json          # name 取 defn.name，缺省回退文件名
  Inventory/          # 子目录相对路径 → defn.namespace
    Sku.json          #   ⇒ namespace = "Inventory"
  _draft/             # `_` 前缀目录/文件忽略
```

- 递归发现 `schema/**/*.json`；`.json` 之外忽略。
- 子目录 → `defn.namespace`（根目录下的文件不写 namespace）。
- 同一 `name` 出现 ≥2 次 ⇒ 发布失败（持久化键为 `name`，禁静默覆盖）。
- 预览将要发布的清单（不发请求）：`--dry-run`。

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
