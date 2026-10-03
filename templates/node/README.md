# __APP_NAME__

由 `create-store-app` 生成的数据驱动应用骨架（common-store / nodejs-store）。

## 结构

```
schema/Order.json   定义即数据：纯 JSON schema（无函数值）
impl/bootstrap.js   入口：调用 nodejs-store 的 createApp 起服务
seed/seed.json      示例种子数据
cases/smoke.json    冒烟用例（GET /api/Order → 200）
```

## 运行

```bash
npm install
npm start            # 默认 http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/Order
```

环境变量：`MONGO_URI`（默认 `mongodb://127.0.0.1:27017`）、`MONGO_DB`（默认 `__APP_NAME__`）、`PORT`（默认 `3000`）。
