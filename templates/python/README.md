# __APP_NAME__

由 `create-store-app` 生成的数据驱动应用骨架（common-store / py-store）。

## 结构

```
schema/Order.json   定义即数据：纯 JSON schema（无函数值）
impl/bootstrap.py   入口：调用 py_store 的 create_app 初始化数据层
seed/seed.json      示例种子数据
cases/smoke.json    冒烟用例
```

> Python 侧本轮只到数据层（`create_app`）；协议面（store-api-py / store-graphql-py）留待后续。

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
