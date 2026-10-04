#!/usr/bin/env node
'use strict';

/**
 * create-store-app — 脚手架 CLI。
 *
 * 契约：
 *   create-store-app <target-dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]
 *   - 无 <target-dir> 且为 TTY 时进入交互问答；--yes 全取默认（node + rest）。
 *   - 退出码：0 成功 / 2 参数错误 / 3 目标目录已存在且无 --force。
 *   - 生成方式：复制 templates/<lang>/** 到目标目录，占位符 __APP_NAME__ 替换为
 *     <target-dir> 的 basename（文件内容与路径名都替换，如 schema/__APP_NAME__/）。
 */

const fs = require('fs');
const path = require('path');
const readline = require('node:readline/promises');

const LANGS = ['node', 'python'];
const SKINS = ['rest', 'graphql', 'grpc'];                 // 网关三皮；MCP 本轮不做
const NODE_SKIN_PKG = { rest: 'store-api-node', graphql: 'store-graphql-node', grpc: 'store-grpc-node' };
const DEFAULTS = { lang: 'node', skins: ['rest'] };
const PLACEHOLDER = '__APP_NAME__';
const TEMPLATES = path.join(__dirname, '..', 'templates');

const USAGE = [
  '用法: create-store-app <target-dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]',
  '  无 <target-dir> 且为 TTY 时进入交互问答；--yes 全取默认（node + rest）。',
].join('\n');

function fail(code, msg) {
  process.stderr.write(`create-store-app: ${code}: ${msg}\n`);
  if (code === 'ERR_ARGS') process.stderr.write(USAGE + '\n');
  process.exit(code === 'ERR_ARGS' ? 2 : 3);
}

/** 纯函数：argv → {dir, lang, skins, force, yes, help}；参数非法即 fail */
function resolveOptions(argv) {
  const o = { dir: null, lang: null, skins: null, force: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') o.force = true;
    else if (a === '--yes') o.yes = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--lang') { o.lang = argv[++i]; if (o.lang === undefined) fail('ERR_ARGS', '--lang 缺少取值'); }
    else if (a === '--skins') { const v = argv[++i]; if (v === undefined) fail('ERR_ARGS', '--skins 缺少取值'); o.skins = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []; }
    else if (a.startsWith('-')) fail('ERR_ARGS', `未知参数 ${a}`);
    else if (o.dir === null) o.dir = a;
    else fail('ERR_ARGS', `多余参数 ${a}`);
  }
  if (o.lang !== null && !LANGS.includes(o.lang)) fail('ERR_ARGS', `不支持的语言 ${o.lang}（可选 ${LANGS.join(' | ')}）`);
  if (o.skins !== null) {
    const bad = o.skins.filter((s) => !SKINS.includes(s));
    if (bad.length) fail('ERR_ARGS', `不支持的协议皮 ${bad.join(',')}（可选 ${SKINS.join(' | ')}）`);
    if (o.skins.length === 0) fail('ERR_ARGS', '至少选择 1 个协议皮');
  }
  return o;
}

/** 单次问答 */
async function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(prompt); } finally { rl.close(); }
}

async function askDir() {
  return (await ask('目标目录: ')).trim() || null;
}

async function askLang() {
  const v = (await ask('语言 (node/python) [node]: ')).trim() || DEFAULTS.lang;
  if (!LANGS.includes(v)) fail('ERR_ARGS', `不支持的语言 ${v}（可选 ${LANGS.join(' | ')}）`);
  return v;
}

async function askSkins() {
  const picked = [];
  for (const s of SKINS) {
    const def = DEFAULTS.skins.includes(s);                 // rest 默认启用，其余默认关闭
    const ans = (await ask(`启用协议皮 ${s}? ${def ? '(Y/n)' : '(y/N)'}: `)).trim().toLowerCase();
    const on = ans === '' ? def : (ans === 'y' || ans === 'yes');
    if (on) picked.push(s);
  }
  if (!picked.length) fail('ERR_ARGS', '至少选择 1 个协议皮');
  return picked;
}

/** 递归复制模板并做占位符替换（文件内容与路径名都替换） */
function copyTree(srcDir, dstDir, appName) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const name = entry.name.split(PLACEHOLDER).join(appName);
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, name);
    if (entry.isDirectory()) {
      copyTree(src, dst, appName);
    } else {
      const text = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dst, text.split(PLACEHOLDER).join(appName));
    }
  }
}

/** 按所选协议皮生成 node skins 装配块（注入 __SKINS_START__/__SKINS_END__ 之间） */
function nodeSkinsBlock(skins) {
  const L = ['    skins: {', '      http: { port: Number(process.env.PORT || 3000) },'];
  if (skins.includes('rest')) L.push("      rest: { enabled: true, prefix: '/api' },");
  if (skins.includes('graphql')) L.push("      graphql: { enabled: true, path: '/graphql' },");
  if (skins.includes('grpc')) L.push('      grpc: { enabled: true, port: Number(process.env.GRPC_PORT || 50051) },');
  L.push('    },');
  return L.join('\n');
}

/** python import 段：有皮即引入 build（无皮为空） */
function pySkinsImportBlock(skins) {
  return skins.length ? 'from store_gateway import build' : '';
}

/** 按所选协议皮生成 python 网关装配块（注入 # __SKINS_START__/# __SKINS_END__ 之间） */
function pySkinsBlock(skins) {
  const args = [];
  if (skins.includes('rest')) args.push('rest={"enabled": True, "prefix": "/api"}');
  if (skins.includes('graphql')) args.push('graphql={"enabled": True, "path": "/graphql"}');
  if (skins.includes('grpc')) args.push('grpc={"enabled": True, "port": int(os.environ.get("GRPC_PORT", "50051"))}');
  const call = args.length === 1 ? `build(store, ${args[0]})`
    : `build(store,\n           ${args.join(',\n           ')})`;
  return `    gw = ${call}\n    gw.run("127.0.0.1", int(os.environ.get("PORT", "3000")))`;
}

/** node 依赖注入：直接加皮包（替换文本以逗号开头，无皮为空以保持 JSON 合法） */
function nodeDepsReplacement(skins) {
  return skins.map((s) => `,\n    "${NODE_SKIN_PKG[s]}": "^0.1.0"`).join('');
}

/** python 依赖注入：用 gateway extras 承载三皮（避免 extras 与直连依赖双轨） */
function pyDepsReplacement(skins) {
  return skins.length ? `, "store-gateway-py[${skins.join(',')}]"` : '';
}

/** 标记区间替换（保留标记本身）；标记缺失即抛 ERR_TEMPLATE，不静默 */
function replaceBlock(text, startMark, endMark, body) {
  const s = text.indexOf(startMark), e = text.indexOf(endMark);
  if (s < 0 || e < 0) throw new Error(`ERR_TEMPLATE 标记缺失：${startMark}`);
  return text.slice(0, s + startMark.length) + (body ? '\n' + body : '') + '\n' + text.slice(e);
}

/** 字面量替换（依赖注入点）；标记缺失即抛 ERR_TEMPLATE，不静默 */
function replaceLiteral(text, mark, body) {
  if (!text.includes(mark)) throw new Error(`ERR_TEMPLATE 标记缺失：${mark}`);
  return text.split(mark).join(body);
}

function replaceFile(file, fn) {
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
}

/** 按 lang 对生成物做标记替换（node：bootstrap.js + package.json；python：bootstrap.py + pyproject.toml） */
function applySkins(target, lang, skins) {
  if (lang === 'node') {
    replaceFile(path.join(target, 'impl', 'bootstrap.js'),
      (t) => replaceBlock(t, '// __SKINS_START__', '// __SKINS_END__', nodeSkinsBlock(skins)));
    replaceFile(path.join(target, 'package.json'),
      (t) => replaceLiteral(t, '__SKIN_DEPS__', nodeDepsReplacement(skins)));
  } else {
    replaceFile(path.join(target, 'impl', 'bootstrap.py'), (t) => {
      const out = replaceBlock(t, '# __SKINS_IMPORT_START__', '# __SKINS_IMPORT_END__', pySkinsImportBlock(skins));
      return replaceBlock(out, '# __SKINS_START__', '# __SKINS_END__', pySkinsBlock(skins));
    });
    replaceFile(path.join(target, 'pyproject.toml'),
      (t) => replaceLiteral(t, ', "__SKIN_DEPS__"', pyDepsReplacement(skins)));
  }
}

async function main() {
  const o = resolveOptions(process.argv.slice(2));
  if (o.help) { process.stdout.write(USAGE + '\n'); process.exit(0); }

  // 非 TTY 且完全未指定（无 --yes / --lang）：
  //   无 <target-dir> ⇒ 报错退 2（禁静默挂起）；给了 <target-dir> ⇒ 参数式调用，语言/皮取默认
  if (!o.yes && !o.lang && !process.stdin.isTTY && !o.dir) {
    fail('ERR_ARGS', '非交互终端请显式传 --lang（或用 --yes 取默认）');
  }
  const interactive = !o.yes && !o.lang && !!process.stdin.isTTY;   // 无 --yes / --lang 且 TTY ⇒ 进入问答

  let dir = o.dir;
  if (!dir) {
    if (!interactive) fail('ERR_ARGS', '缺少 <target-dir>');
    dir = await askDir();
    if (!dir) fail('ERR_ARGS', '缺少 <target-dir>');
  }
  const lang = o.lang || (interactive ? await askLang() : DEFAULTS.lang);
  const skins = o.skins || (interactive ? await askSkins() : DEFAULTS.skins);
  if (!skins.length) fail('ERR_ARGS', '至少选择 1 个协议皮');

  const templateDir = path.join(TEMPLATES, lang);
  if (!fs.existsSync(templateDir)) fail('ERR_ARGS', `模板缺失：${templateDir}`);

  const target = path.resolve(dir);
  const appName = path.basename(target);

  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) fail('ERR_TARGET_EXISTS', `目标已存在且不是目录：${target}`);
    if (fs.readdirSync(target).length > 0 && !o.force) {
      // 非交互（--yes / 非 TTY）不覆盖，沿用退出码 3；TTY 时询问是否覆盖（等价 --force）
      if (o.yes || !process.stdin.isTTY) fail('ERR_TARGET_EXISTS', `目标目录已存在且非空（加 --force 覆盖）：${target}`);
      const yn = (await ask('目标目录已存在且非空，覆盖？(y/N): ')).trim().toLowerCase();
      if (yn !== 'y' && yn !== 'yes') fail('ERR_TARGET_EXISTS', `目标目录已存在且非空（加 --force 覆盖）：${target}`);
    }
  }

  copyTree(templateDir, target, appName);
  applySkins(target, lang, skins);
  process.stdout.write(`已生成 ${lang} 应用骨架：${target}\n`);
  process.stdout.write(
    lang === 'node'
      ? `下一步: cd ${dir} && npm install && npm start\n`
      : `下一步: cd ${dir} && pip install -e . && python impl/bootstrap.py\n`
  );
  process.exit(0);
}

if (require.main === module) main();
module.exports = { LANGS, SKINS, USAGE };
