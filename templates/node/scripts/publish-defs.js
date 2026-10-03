'use strict';

/** 把 schema/ 下定义发布到 meta-store。环境变量 META_URL（必填）；失败即退出码 1（不静默）。 */

const fs = require('node:fs');
const path = require('node:path');

const META_URL = process.env.META_URL;
if (!META_URL) { console.error('ERR:PUBLISH 需要 META_URL'); process.exit(1); }

(async () => {
  const dir = path.join(__dirname, '..', 'schema');
  let failed = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const defn of Array.isArray(raw) ? raw : [raw]) {
      const r = await fetch(`${META_URL}/meta/defs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defn, actor: process.env.ACTOR || 'ci' }),
      });
      if (r.ok) { console.log(`[publish] ${f} ${defn.name} ok`); continue; }
      failed += 1;
      console.error(`[publish] ${f} ${defn.name} 失败 ${r.status} ${await r.text()}`);
    }
  }
  // 用 exitCode 而非 process.exit：立即退出会在 undici 句柄关闭途中触发 libuv 断言（Windows）
  process.exitCode = failed ? 1 : 0;
})();
