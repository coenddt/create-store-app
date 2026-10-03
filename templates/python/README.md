# __APP_NAME__

由 `create-store-app` 生成的数据驱动应用骨架（common-store / py-store）。

## 结构

```
schema/Order.json   定义即数据：纯 JSON schema（无函数值）
impl/bootstrap.py   入口：调用 py_store 的 create_app 初始化数据层
scripts/publish-defs.py  把定义发布到 meta-store
seed/seed.json      示例种子数据
cases/smoke.json    冒烟用例
```

> Python 侧本轮只到数据层（`create_app`）；协议面（store-api-py / store-graphql-py）留待后续。

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

把 `schema/` 下定义发布到 meta-store：

```bash
META_URL=http://127.0.0.1:8600 python scripts/publish-defs.py
```

环境变量：`META_URL`（必填，meta-store 地址）、`ACTOR`（默认 `ci`）。任一发布失败退出码 1。
仅用标准库（`urllib`），不新增依赖；预览清单用 `--dry-run`。

## 运行

```bash
pip install pymongo storepy
python impl/bootstrap.py
```

环境变量：`MONGO_URI`（默认 `mongodb://127.0.0.1:27017`）、`MONGO_DB`（默认 `__APP_NAME__`）。

## 降级事件如何查

运行期的降级 / 拦截 / 兜底事件统一落内建 `__feedback`（`create_app` 默认接线，`feedback=False` 可关），经数据层查询：

```python
rows = await app["store"].query(
    "__feedback($condition:@c0){ code, type, layer, message, hint, tenant, env, now }",
    {"c0": {}},
)
```

字段：`type` / `code` / `layer` / `message` / `hint`（+ `tenant` / `env` / `now`）。该表 `write` 白名单为空——业务 GQL 不可篡改审计。
