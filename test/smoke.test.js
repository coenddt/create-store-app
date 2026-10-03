'use strict';

/**
 * create-store-app 冒烟用例：生成到临时目录并校验关键文件存在 / 退出码契约。
 * 语义依据：01 文档 §3.1 / §4.2。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'create.js');

function gen(lang) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-store-app-'));
  const target = path.join(dir, 'demo');
  const r = spawnSync(process.execPath, [CLI, target, '--lang', lang], { encoding: 'utf8' });
  return { dir, target, r };
}

test('node 模板：生成关键文件 + __APP_NAME__ 替换为 basename', () => {
  const { dir, target, r } = gen('node');
  try {
    assert.strictEqual(r.status, 0, r.stderr);
    for (const f of ['package.json', 'schema/Order.json', 'impl/bootstrap.js', 'seed/seed.json', 'cases/smoke.json', 'README.md']) {
      assert.ok(fs.existsSync(path.join(target, f)), 'missing ' + f);
    }
    const pkg = fs.readFileSync(path.join(target, 'package.json'), 'utf8');
    assert.ok(!pkg.includes('__APP_NAME__'), '__APP_NAME__ 未替换');
    assert.ok(pkg.includes('"demo"'), 'basename 未写入');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('python 模板：生成关键文件', () => {
  const { dir, target, r } = gen('python');
  try {
    assert.strictEqual(r.status, 0, r.stderr);
    for (const f of ['pyproject.toml', 'schema/Order.json', 'impl/bootstrap.py', 'seed/seed.json', 'cases/smoke.json', 'README.md']) {
      assert.ok(fs.existsSync(path.join(target, f)), 'missing ' + f);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('目标已存在且非空 → 退出码 3', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-store-app-'));
  const target = path.join(dir, 'demo');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'x.txt'), 'x');
  try {
    const r = spawnSync(process.execPath, [CLI, target], { encoding: 'utf8' });
    assert.strictEqual(r.status, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('缺 target-dir → 退出码 2', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.strictEqual(r.status, 2);
});
