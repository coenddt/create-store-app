const path = require('node:path');
const fns = require('./fns');
const { createApp } = require('nodejs-store');
const { MongoClient } = require('mongodb');

const { META_TENANT, META_ENV } = process.env;

// 落点由「目录 + store.config.json」承载（L1=database、PG L2=schema、L3+ 打平）；
// 加载经 createApp 的 config 走宿主 store.loadDefs（core 纯规划，禁在此写落点/主从谓词）
const CONFIG = path.join(__dirname, '..', 'store.config.json');

(async () => {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  await createApp({
    datasource: client.db(process.env.MONGO_DB || '__APP_NAME__'),
    config: CONFIG,
    fns,
    // __SKINS_START__
    skins: {
      http: { port: Number(process.env.PORT || 3000) },
      rest: { enabled: true, prefix: '/api' },
    },
    // __SKINS_END__
    // 配了 ns 才开启发布-重载闭环（publish → POST /-/reload → 新定义可见）；未配为 null
    reload: META_TENANT && META_ENV ? { tenant: META_TENANT, env: META_ENV } : null,
  });
  console.log('listening on http://127.0.0.1:' + (process.env.PORT || 3000));
})();
