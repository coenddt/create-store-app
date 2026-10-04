'use strict';

/**
 * create-store-app 冒烟用例：生成到临时目录并校验关键文件存在 / 退出码契约。
 * 语义依据：01 文档 §3.1 / §4.2；共享分层与多落点择优 06 §4.8（目录语义 + 主从）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'create.js');

// 模板 scripts/publish-defs.js 顶层 `require('nodejs-store')`：本仓未装依赖，
// 经 NODE_PATH 指向相邻 nodejs-store 仓（其 package name = nodejs-store）+ LOCAL_CORE=1
// 加载相邻 rust-store 调试产物（与 nodejs-store 自身用例同口径）。
process.env.LOCAL_CORE = '1';
process.env.NODE_PATH = [process.env.NODE_PATH, path.join(__dirname, '..', '..')]
  .filter(Boolean).join(path.delimiter);
Module._initPaths();

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
    for (const f of ['package.json', 'store.config.json', 'schema/demo/Order.json', 'impl/bootstrap.js', 'seed/seed.json', 'cases/smoke.json', 'README.md']) {
      assert.ok(fs.existsSync(path.join(target, f)), 'missing ' + f);
    }
    const pkg = fs.readFileSync(path.join(target, 'package.json'), 'utf8');
    assert.ok(!pkg.includes('__APP_NAME__'), '__APP_NAME__ 未替换');
    assert.ok(pkg.includes('"demo"'), 'basename 未写入');
    // store.config.json 内 __APP_NAME__ 亦被替换为 basename
    const cfg = JSON.parse(fs.readFileSync(path.join(target, 'store.config.json'), 'utf8'));
    assert.deepStrictEqual(cfg.sources.default.databases, ['demo']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('python 模板：生成关键文件', () => {
  const { dir, target, r } = gen('python');
  try {
    assert.strictEqual(r.status, 0, r.stderr);
    for (const f of ['pyproject.toml', 'store.config.json', 'schema/demo/Order.json', 'impl/bootstrap.py', 'seed/seed.json', 'cases/smoke.json', 'README.md']) {
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

test('publish-defs 目录语义：落点（L1=db、PG L2=schema、L3 打平）+ 主从 + `_`/非 .json 忽略 + 同名主 ≥2 报错', (t) => {
  let planDefs;
  try {
    ({ planDefs } = require(path.join(__dirname, '..', 'templates', 'node', 'scripts', 'publish-defs.js')));
  } catch (e) {
    // 模板脚本顶层 require('nodejs-store')：本仓不装依赖，靠 NODE_PATH 指向相邻
    // nodejs-store 仓（仅 monorepo 布局可满足）。CI 单仓 checkout 下显式跳过并上报，
    // 不静默失守（本地/CI 均可从测试输出看到 skip）。
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
    return t.skip('跳过：未解析到 nodejs-store（需 monorepo 相邻仓布局）');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-defs-'));
  try {
    fs.mkdirSync(path.join(dir, 'schema', 'sales_db', 'inventory'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'schema', 'sales_db', '_draft'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'schema', 'analytics_db', 'app', 'report'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'store.config.json'), JSON.stringify({
      sources: {
        mongoMain: { kind: 'mongodb', databases: ['sales_db'] },
        pgMain: { kind: 'pg', databases: ['analytics_db'] },
      },
      defs: ['schema'],
    }));
    fs.writeFileSync(path.join(dir, 'schema', 'sales_db', 'Order.json'), JSON.stringify({ name: 'Order', fields: {} }));
    fs.writeFileSync(path.join(dir, 'schema', 'sales_db', 'inventory', 'Item.json'), JSON.stringify({ name: 'Item', fields: {} }));           // Mongo：L2 打平
    fs.writeFileSync(path.join(dir, 'schema', 'sales_db', '_draft', 'Hidden.json'), JSON.stringify({ name: 'Hidden', fields: {} }));         // `_` 前缀忽略
    fs.writeFileSync(path.join(dir, 'schema', 'sales_db', 'note.txt'), 'x');                                                                 // 非 .json 忽略
    fs.writeFileSync(path.join(dir, 'schema', 'analytics_db', 'Order.json'), JSON.stringify({ name: 'Order', replica: true }));              // 从：同名主在 sales_db
    fs.writeFileSync(path.join(dir, 'schema', 'analytics_db', 'app', 'Customer.json'), JSON.stringify({ name: 'Customer', fields: {} }));    // PG：L2 = schema
    fs.writeFileSync(path.join(dir, 'schema', 'analytics_db', 'app', 'report', 'Monthly.json'), JSON.stringify({ name: 'Monthly', fields: {} })); // PG：L3 打平

    const items = planDefs(path.join(dir, 'store.config.json'));
    const locOf = (n) => {
      const hit = items.find((it) => it.defn.name === n && !it.defn.replica);
      return hit && hit.location;
    };

    // L1 = database；Mongo L2 打平；PG L2 = schema；PG L3 打平
    assert.deepStrictEqual(locOf('Order'), { source: 'mongoMain', database: 'sales_db', schema: null });
    assert.deepStrictEqual(locOf('Item'), { source: 'mongoMain', database: 'sales_db', schema: null });
    assert.deepStrictEqual(locOf('Customer'), { source: 'pgMain', database: 'analytics_db', schema: 'app' });
    assert.deepStrictEqual(locOf('Monthly'), { source: 'pgMain', database: 'analytics_db', schema: 'app' });
    // `_` 前缀与 `.json` 之外不收集
    assert.strictEqual(items.some((it) => it.defn.name === 'Hidden'), false);

    // 主从识别：同名 Order ⇒ 主在前、其后从
    const ordIdxs = items.map((it, i) => (it.defn.name === 'Order' ? i : -1)).filter((i) => i >= 0);
    assert.strictEqual(ordIdxs.length, 2);
    assert.strictEqual(items[ordIdxs[0]].defn.replica, undefined);
    assert.strictEqual(items[ordIdxs[0]].location.database, 'sales_db');
    assert.strictEqual(items[ordIdxs[1]].defn.replica, true);
    assert.strictEqual(items[ordIdxs[1]].location.database, 'analytics_db');

    // 同名主 ≥2 ⇒ ERR:LOAD 主定义重复
    fs.writeFileSync(path.join(dir, 'schema', 'sales_db', 'inventory', 'Order.json'), JSON.stringify({ name: 'Order', fields: {} }));
    assert.throws(() => planDefs(path.join(dir, 'store.config.json')), /ERR:LOAD 主定义重复/);
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
