'use strict';

/**
 * 把 schema/ 目录下定义（递归）发布到 meta-store。
 * 目录约定：schema 目录下 .json 递归发现；子目录相对路径 → defn.namespace；`_` 前缀文件/目录忽略。
 * 环境变量：META_URL（必填）；ACTOR（默认 ci）。
 * 用法：node scripts/publish-defs.js [--dry-run]   失败（含同名重复）退出码 1（不静默）。
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_DIR = path.join(__dirname, '..', 'schema');

/** 递归收集定义：返回 [{ rel, name, namespace, defn }]（可单测：纯 IO + 映射，无网络）。 */
function collectDefs(root = SCHEMA_DIR) {
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`ERR:PUBLISH schema 目录不存在：${root}`);
  }
  const out = [];
  const seen = new Map(); // name -> rel（同名报错：持久化键为 name，禁覆盖）
  const walk = (absDir) => {
    for (const e of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (e.name.startsWith('_')) continue;                  // `_` 前缀忽略
      const abs = path.join(absDir, e.name);
      if (e.isDirectory()) { walk(abs); continue; }
      if (!e.name.endsWith('.json')) continue;
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const relDir = path.posix.dirname(rel);
      const namespace = relDir === '.' ? undefined : relDir; // 子目录 → namespace
      const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
      for (const defn of Array.isArray(raw) ? raw : [raw]) {
        const name = defn.name || path.basename(e.name, '.json');
        if (seen.has(name)) {
          throw new Error(`ERR:PUBLISH 同名定义重复：${name}（${seen.get(name)} 与 ${rel}）——持久化键为 name，禁覆盖`);
        }
        seen.set(name, rel);
        out.push({ rel, name, namespace, defn: { ...defn, name, ...(namespace ? { namespace } : {}) } });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && !process.env.META_URL) { console.error('ERR:PUBLISH 需要 META_URL'); process.exit(1); }
  let defs;
  try { defs = collectDefs(); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
  let failed = 0;
  for (const d of defs) {
    if (dryRun) { console.log(`[dry] ${d.rel} ${d.name}${d.namespace ? ` ns=${d.namespace}` : ''}`); continue; }
    const r = await fetch(`${process.env.META_URL}/meta/defs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defn: d.defn, actor: process.env.ACTOR || 'ci' }),
    });
    if (r.ok) { console.log(`[publish] ${d.rel} ${d.name} ok`); continue; }
    failed += 1;
    console.error(`[publish] ${d.rel} ${d.name} 失败 ${r.status} ${await r.text()}`);
  }
  // 用 exitCode 而非 process.exit：立即退出会在 undici 句柄关闭途中触发 libuv 断言（Windows）
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
module.exports = { collectDefs };
