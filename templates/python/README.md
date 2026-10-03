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
