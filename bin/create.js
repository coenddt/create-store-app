#!/usr/bin/env node
'use strict';

/**
 * create-store-app — 脚手架 CLI。
 *
 * 契约（01 文档 §4.2）：
 *   create-store-app <target-dir> [--lang node|python] [--force]
 *   - <target-dir> 必填；已存在且非空时需 --force，否则 ERR_TARGET_EXISTS。
 *   - --lang 缺省 node。
 *   - 退出码：0 成功 / 2 参数错误 / 3 目标目录已存在且无 --force。
 *   - 生成方式：复制 templates/<lang>/** 到目标目录，占位符 __APP_NAME__ 替换为
 *     <target-dir> 的 basename（仅替换文件内容，不改文件名）。
 */

const fs = require('fs');
const path = require('path');

const LANGS = ['node', 'python'];
const PLACEHOLDER = '__APP_NAME__';
const TEMPLATES = path.join(__dirname, '..', 'templates');

const USAGE = [
  '用法: create-store-app <target-dir> [--lang node|python] [--force]',
  '',
  '  <target-dir>  必填，目标目录',
  '  --lang        语言模板，缺省 node（node | python）',
  '  --force       目标目录已存在且非空时覆盖',
].join('\n');

function fail(code, msg) {
  process.stderr.write(`create-store-app: ${code}: ${msg}\n`);
  if (code === 'ERR_ARGS') process.stderr.write(USAGE + '\n');
  process.exit(code === 'ERR_ARGS' ? 2 : 3);
}

function parseArgs(argv) {
  const opts = { dir: null, lang: 'node', force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') opts.force = true;
    else if (a === '--lang') {
      opts.lang = argv[++i];
      if (opts.lang === undefined) fail('ERR_ARGS', '--lang 缺少取值');
    } else if (a === '-h' || a === '--help') {
      process.stdout.write(USAGE + '\n');
      process.exit(0);
    } else if (a.startsWith('-')) {
      fail('ERR_ARGS', `未知参数 ${a}`);
    } else if (opts.dir === null) {
      opts.dir = a;
    } else {
      fail('ERR_ARGS', `多余参数 ${a}`);
    }
  }
  return opts;
}

/** 递归复制模板并做占位符替换（内容替换；文件名保持不变） */
function copyTree(srcDir, dstDir, appName) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dst, appName);
    } else {
      const text = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dst, text.split(PLACEHOLDER).join(appName));
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.dir) fail('ERR_ARGS', '缺少 <target-dir>');
  if (!LANGS.includes(opts.lang)) {
    fail('ERR_ARGS', `不支持的语言模板 ${opts.lang}（可选 ${LANGS.join(' | ')}）`);
  }

  const templateDir = path.join(TEMPLATES, opts.lang);
  if (!fs.existsSync(templateDir)) fail('ERR_ARGS', `模板缺失：${templateDir}`);

  const target = path.resolve(opts.dir);
  const appName = path.basename(target);

  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) fail('ERR_TARGET_EXISTS', `目标已存在且不是目录：${target}`);
    if (fs.readdirSync(target).length > 0 && !opts.force) {
      fail('ERR_TARGET_EXISTS', `目标目录已存在且非空（加 --force 覆盖）：${target}`);
    }
  }

  copyTree(templateDir, target, appName);
  process.stdout.write(`已生成 ${opts.lang} 应用骨架：${target}\n`);
  process.stdout.write(
    opts.lang === 'node'
      ? `下一步: cd ${opts.dir} && npm install && npm start\n`
      : `下一步: cd ${opts.dir} && pip install -e . && python impl/bootstrap.py\n`
  );
  process.exit(0);
}

main();
