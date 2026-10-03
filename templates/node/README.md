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

## 发布定义

把 `schema/` 下定义发布到 meta-store（发布后经 `POST /-/reload` 才对协议面可见）：

```bash
META_URL=http://127.0.0.1:8600 npm run defs:publish
```

环境变量：`META_URL`（必填，meta-store 地址）、`ACTOR`（默认 `ci`）。任一发布失败退出码 1。
