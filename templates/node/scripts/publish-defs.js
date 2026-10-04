'use strict';

/**
 * 把 schema 定义发布到 meta-store。
 * 落点（source/database/schema）与主从由「目录 + store.config.json」决定，
 * 判据唯一在 core（经宿主 `load` 的 `planLoad` 纯规划），本脚本不写落点/主从谓词。
 * 仅发布主定义（`replica: true` 的从定义只声明链路，不进控制面）。
 * 环境变量：META_URL（必填）；ACTOR（默认 ci）。
 * 用法：node scripts/publish-defs.js [--dry-run]   失败（含 ERR:LOAD）退出码 1（不静默）。
 */

const path = require('node:path');
const { load } = require('nodejs-store');

const CONFIG_FILE = path.join(__dirname, '..', 'store.config.json');

/**
 * 读 store.config.json → 按 defs 根收集定义（宿主 load 的 IO：`_` 前缀忽略、仅 .json）
 * → core 纯规划落点与主从。返回装载项 `[{ defn, location }]`（主在前、其后从）。
 */
function planDefs(configPath = CONFIG_FILE) {
  const { config, baseDir } = load.readConfig(configPath);
  const roots = (config.defs || []).map((r) => path.resolve(baseDir, r));
  const files = load.collectFiles(roots);
  return load.planLoad(config, files);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && !process.env.META_URL) { console.error('ERR:PUBLISH 需要 META_URL'); process.exit(1); }
  let items;
  try { items = planDefs(); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
  const masters = items.filter((it) => !(it.defn && it.defn.replica));  // 只发布主定义
  let failed = 0;
  for (const it of masters) {
    const loc = it.location || {};
    const place = [loc.source, loc.database, loc.schema].filter(Boolean).join('/');
    if (dryRun) { console.log(`[dry] ${it.defn.name} ${place}`); continue; }
    const r = await fetch(`${process.env.META_URL}/meta/defs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defn: it.defn, actor: process.env.ACTOR || 'ci' }),
    });
    if (r.ok) { console.log(`[publish] ${it.defn.name} ${place} ok`); continue; }
    failed += 1;
    console.error(`[publish] ${it.defn.name} 失败 ${r.status} ${await r.text()}`);
  }
  // 用 exitCode 而非 process.exit：立即退出会在 undici 句柄关闭途中触发 libuv 断言（Windows）
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
module.exports = { planDefs };
