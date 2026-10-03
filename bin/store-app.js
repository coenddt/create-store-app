#!/usr/bin/env node
'use strict';
// 管理 CLI：版本 / 帮助 / 能力清单 / 生成透传。零依赖；选项模型单一来源 = bin/create.js。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { LANGS, SKINS } = require('./create.js');            // 单一来源，禁在本文件重录
const PKG = require(path.join(__dirname, '..', 'package.json'));

const SKIN_DESC = { rest: 'RESTful（store-api）', graphql: 'GraphQL（store-graphql）', grpc: 'gRPC（store-grpc）' };
const HELP = [
  'store-app — 管理 create-store-app 脚手架',
  '',
  '用法:',
  '  store-app --version | -v          打印版本',
  '  store-app --help | -h             打印本帮助',
  '  store-app list [--json]           列出可用语言与协议皮',
  '  store-app create <dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]',
  '  store-app --params-file <file>    整包参数 { cmd, opts }（遵循 cli-args-rules）',
].join('\n');

function fail(msg) {
  process.stderr.write(`store-app: ERR_ARGS: ${msg}\n`);
  return 2;
}

/** list：确定性输出（版本 / 语言 / 皮） */
function cmdList(asJson) {
  const data = { version: PKG.version, langs: LANGS, skins: SKINS.map((s) => ({ id: s, desc: SKIN_DESC[s] })) };
  if (asJson) { process.stdout.write(JSON.stringify(data, null, 2) + '\n'); return 0; }
  process.stdout.write(`create-store-app v${PKG.version}\n语言: ${LANGS.join(', ')}\n协议皮: ${SKINS.join(', ')}\n`);
  return 0;
}

/** create：透传 bin/create.js，零新语义（继承其输出与退出码） */
function cmdCreate(argv) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'create.js'), ...argv], { stdio: 'inherit' });
  return r.status == null ? 2 : r.status;
}

/** --params-file 整包 { cmd, opts } → argv（dir 作位置参数置前，布尔 true 省略取值） */
function flattenParams(pkg) {
  const opts = pkg.opts || {};
  const argv = [];
  if (pkg.cmd) argv.push(pkg.cmd);
  if (opts.dir != null) argv.push(String(opts.dir));
  for (const [k, v] of Object.entries(opts)) {
    if (k === 'dir' || v === false || v == null) continue;
    argv.push('--' + k);
    if (v !== true) argv.push(String(v));
  }
  return argv;
}

function main(argv) {
  let args = argv.slice();
  const pf = args.indexOf('--params-file');
  if (pf >= 0) {
    const file = args[pf + 1];
    if (!file) return fail('--params-file 缺少取值');
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return fail(`无法读取参数文件 ${file}: ${e.message}`); }
    args = flattenParams(parsed);
  }
  const cmd = args[0];
  if (cmd === undefined) { process.stdout.write(HELP + '\n'); return 0; }
  if (cmd === '--version' || cmd === '-v') { process.stdout.write(`create-store-app v${PKG.version}\n`); return 0; }
  if (cmd === '--help' || cmd === '-h') { process.stdout.write(HELP + '\n'); return 0; }
  if (cmd === 'list') {
    const unknown = args.slice(1).filter((a) => a !== '--json');
    if (unknown.length) return fail(`未知参数 ${unknown[0]}`);
    return cmdList(args.includes('--json'));
  }
  if (cmd === 'create') return cmdCreate(args.slice(1));
  return fail(`未知子命令 ${cmd}`);
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main };
