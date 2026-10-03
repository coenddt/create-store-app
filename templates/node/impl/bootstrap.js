const schemas = require('../schema/Order.json');
const fns = require('./fns');
const { createApp } = require('nodejs-store');
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  await createApp({
    datasource: client.db(process.env.MONGO_DB || '__APP_NAME__'),
    schemas: Array.isArray(schemas) ? schemas : [schemas],
    fns,
    skins: {
      http: { port: Number(process.env.PORT || 3000) },
      rest: { enabled: true, prefix: '/api' },
    },
  });
  console.log('listening on http://127.0.0.1:' + (process.env.PORT || 3000));
})();
