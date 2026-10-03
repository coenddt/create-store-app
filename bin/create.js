#!/usr/bin/env node
'use strict';

/**
 * create-store-app — 脚手架 CLI。
 * 步骤 2：仅参数校验与 usage 输出；模板复制逻辑见步骤 5。
 * 契约：退出码 0 成功 / 2 参数错误 / 3 目标目录已存在且无 --force。
 */

const USAGE = [
  '用法: create-store-app <target-dir> [--lang node|python] [--force]',
  '',
  '  <target-dir>  必填，目标目录',
  '  --lang        语言模板，缺省 node（node | python）',
  '  --force       目标目录已存在且非空时覆盖',
].join('\n');

process.stderr.write(USAGE + '\n');
process.exit(2);
