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

test('publish-defs 递归收集：子目录→namespace、`_` 忽略、同名报错', () => {
  const { collectDefs } = require(path.join(__dirname, '..', 'templates', 'node', 'scripts', 'publish-defs.js'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-defs-'));
  try {
    fs.mkdirSync(path.join(dir, 'Inv'), { recursive: true });
    fs.mkdirSync(path.join(dir, '_draft'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'Order.json'), JSON.stringify({ name: 'Order', fields: {} }));
    fs.writeFileSync(path.join(dir, 'Inv', 'Item.json'), JSON.stringify({ name: 'Item', fields: {} }));
    fs.writeFileSync(path.join(dir, '_draft', 'Hidden.json'), JSON.stringify({ name: 'Hidden', fields: {} }));
    const defs = collectDefs(dir);
    assert.deepStrictEqual(defs.map((d) => d.rel), ['Inv/Item.json', 'Order.json']);
    assert.strictEqual(defs[0].namespace, 'Inv');
    assert.strictEqual(defs[0].defn.namespace, 'Inv');
    assert.strictEqual(defs[1].namespace, undefined);
    // 同名重复 → 显式报错
    fs.writeFileSync(path.join(dir, 'Inv', 'Order.json'), JSON.stringify({ name: 'Order', fields: {} }));
    assert.throws(() => collectDefs(dir), /同名定义重复/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--yes 默认：node + rest（依赖补齐 store-api-node + skins 装配）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-store-app-'));
  const target = path.join(dir, 'demo');
  const r = spawnSync(process.execPath, [CLI, target, '--yes'], { encoding: 'utf8' });
  try {
    assert.strictEqual(r.status, 0, r.stderr);
    const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies['store-api-node'], 'store-api-node 缺失（rest 已启用却未声明）');
    const boot = fs.readFileSync(path.join(target, 'impl', 'bootstrap.js'), 'utf8');
    assert.ok(boot.includes("rest: { enabled: true, prefix: '/api' }"), 'rest 装配缺失');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--lang node --skins rest,graphql,grpc：三皮包 + 三装配', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-store-app-'));
  const target = path.join(dir, 'demo');
  const r = spawnSync(process.execPath, [CLI, target, '--lang', 'node', '--skins', 'rest,graphql,grpc', '--yes'], { encoding: 'utf8' });
  try {
    assert.strictEqual(r.status, 0, r.stderr);
    const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    for (const k of ['store-api-node', 'store-graphql-node', 'store-grpc-node']) {
      assert.ok(pkg.dependencies[k], 'missing ' + k);
    }
    const boot = fs.readFileSync(path.join(target, 'impl', 'bootstrap.js'), 'utf8');
    assert.ok(boot.includes("rest: { enabled: true, prefix: '/api' }"));
    assert.ok(boot.includes("graphql: { enabled: true, path: '/graphql' }"));
    assert.ok(boot.includes('grpc: { enabled: true, port:'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--lang python --skins rest,graphql：gateway extras + import + build 调用', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-store-app-'));
  const target = path.join(dir, 'demo');
  const r = spawnSync(process.execPath, [CLI, target, '--lang', 'python', '--skins', 'rest,graphql', '--yes'], { encoding: 'utf8' });
  try {
    assert.strictEqual(r.status, 0, r.stderr);
    const pt = fs.readFileSync(path.join(target, 'pyproject.toml'), 'utf8');
    assert.ok(pt.includes('"store-gateway-py[rest,graphql]"'), 'gateway extras 缺失');
    const boot = fs.readFileSync(path.join(target, 'impl', 'bootstrap.py'), 'utf8');
    assert.ok(boot.includes('from store_gateway import build'), 'import 缺失');
    assert.ok(boot.includes('gw = build(store,'), 'build 调用缺失');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('参数错误 / 非 TTY：bogus ⇒ 2；非交互无 --lang --yes ⇒ 2', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-store-app-'));
  const target = path.join(dir, 'demo');
  try {
    const bad = spawnSync(process.execPath, [CLI, target, '--skins', 'bogus', '--yes'], { encoding: 'utf8' });
    assert.strictEqual(bad.status, 2);
    assert.ok(bad.stderr.includes('ERR_ARGS'), 'stderr 缺 ERR_ARGS');
    const noTty = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
    assert.strictEqual(noTty.status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
