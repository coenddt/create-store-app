# create-store-app — common-store 应用脚手架

`create-store-app` 是 common-store 家族的**应用脚手架 CLI**：一条命令生成一个**数据驱动应用**工程骨架，
支持 **Node.js（`nodejs-store`）**与 **Python（`storepy`）**两种模板，并可按需装配 **REST / GraphQL / gRPC** 协议皮。

- 生成方式：复制 `templates/<lang>/**` 到目标目录，把占位符 `__APP_NAME__` 替换为目标目录的 basename
  （**文件内容与路径名都替换**，如 `schema/__APP_NAME__/` → `schema/<app>/`）。
- npm 包名：**`create-store-app`**（当前版本 `0.2.1`）；`bin` 入口：`create-store-app` → `bin/create.js`。

## 状态 / 能力矩阵

| 能力 | 状态 | 说明 |
|---|---|---|
| `node` 模板生成 | ✅ 已实现 | `nodejs-store` + `mongodb` + 协议皮 |
| `python` 模板生成 | ✅ 已实现 | `storepy` + `pymongo` + `store-gateway-py` extras |
| 协议皮 `rest` / `graphql` / `grpc` | ✅ 已实现 | 按 `--skins` 注入依赖与装配块（至少 1 个） |
| MCP 皮 | ❌ 本轮不做 | 代码注释明示：网关三皮，MCP 本轮不做 |
| 交互式问答（TTY） | ✅ 已实现 | 依次问目录、语言、协议皮 |
| 非交互（`--yes` / 非 TTY） | ✅ 已实现 | 取默认 `node` + `rest`；非 TTY 无 `--lang` 时显式报错 |
| 目标目录覆盖（`--force`） | ✅ 已实现 | 已存在且非空时需 `--force` |
| 管理 CLI（`store-app`） | ✅ 已实现 | 版本 / 帮助 / 能力清单 / 生成透传（`node bin/store-app.js`） |
| SPEC 片段一致性校验 | ✅ 已实现 | `tools/check-spec-snippets.js` |

## 目录

- [What it is](#what-it-is)
- [When to use / When NOT to use](#when-to-use--when-not-to-use)
- [Installation / 前置条件](#installation--前置条件)
- [Quick start](#quick-start)
- [命令 / 模板参考](#命令--模板参考)
- [场景事例](#场景事例)
- [边界与非目标](#边界与非目标)
- [FAQ](#faq)
- [Development](#development)
- [Related projects](#related-projects)
- [License](#license)

## What it is

`create-store-app` 把「起一个 common-store 数据应用」所需的**最小但完整**的一组文件一次性生成出来：
装载配置、schema 定义、计算列实现、种子数据、冒烟用例、发布脚本。生成即可运行，无需手动拼装。

它在家族架构中的位置（对齐根 `README.md` 的分层）：

| 层 | 组件 | 与本仓的关系 |
|---|---|---|
| 引擎 | `rust-store-core` | 生成工程不直接接触 |
| 宿主 | `nodejs-store` / `storepy` | 生成工程的核心依赖（`node` / `python` 模板各对应一个） |
| 协议皮 | `store-api` / `store-graphql` / `store-grpc` + `store-gateway` | 由 `--skins` 选择，注入依赖与装配 |
| 控制面 | `meta-store` | 生成工程的 `scripts/publish-defs.*` 向其 `POST /meta/defs` 发布定义 |
| **脚手架** | **`create-store-app`** | **本仓：一键生成应用工程** |

两条关键心智：

- **定义即数据**：`schema/**/*.json` 是**纯 JSON**，不含任何定位字段；**落点由「目录层级 + `store.config.json`」解析**
  （详见 [落点目录约定](#落点目录约定)）。
- **回调不可跨进程**：计算列在定义里只写 `fnRef` 字符串，函数实现落在 `impl/fns.*`，启动时注入；
  缺实现时启动即抛 `ERR_FN_MISSING`（不静默）。

## When to use / When NOT to use

**When to use**

- 你要**从零起一个数据应用**：建库、定义 schema、起 REST（或 GraphQL / gRPC）、铺种子数据。
- 你想让 Node.js 与 Python 用**同一套** schema 与 GQL 方言（两个模板产物语义一致）。
- 你要一个**可发布的定义**工程：自带 `scripts/publish-defs.*` 对接 meta-store。

**When NOT to use**

- 你只需要在自己的既有工程里**加一个依赖**（`npm i nodejs-store` / `pip install storepy`）直接调用 —— 不必生成整骨架。
- 你要生成**前端**或**小程序**工程 —— 本仓只生成数据应用（服务端 + 定义）。
- 你要 MCP 协议皮 —— 本轮不做（见「边界与非目标」）。

## Installation / 前置条件

- **Node.js `>=18`**（CLI 自身运行时要求，见 `package.json` 的 `engines`）。
- 生成后的**运行期**前置：
  - Node 模板：**Node.js `>=18`** + 一个可连接的 **MongoDB**（默认 `mongodb://127.0.0.1:27017`）。
  - Python 模板：**Python `>=3.10`**（`requires-python`）+ **`pymongo>=4.9`** + 一个 **MongoDB**。

直接经 npx 使用（无需预先安装）：

```bash
npx create-store-app <target-dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]
```

或全局安装：

```bash
npm i -g create-store-app
```

## Quick start

### Node.js

```bash
npx create-store-app myapp --yes          # 默认 node + rest
cd myapp && npm install && npm start      # REST 起在 http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/Order      # => 返回 Order 列表
```

### Python

```bash
npx create-store-app myapp --lang python --yes
cd myapp && pip install -e . && python impl/bootstrap.py
```

> 前置：一个本地 MongoDB（默认 `mongodb://127.0.0.1:27017`，库名 = 应用名 = 目标目录 basename）。
> 不带 `--yes` / `--lang` 且为 TTY 时进入交互问答（依次问目录、语言、协议皮）。

## 命令 / 模板参考

### CLI：`create-store-app`

来源：[`bin/create.js`](bin/create.js)。

```bash
create-store-app <target-dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]
```

| 参数 / 选项 | 取值 | 缺省 | 含义 |
|---|---|---|---|
| `<target-dir>` | 路径 | — | 目标目录；省略且为 TTY 时进入交互问答 |
| `--lang` | `node` \| `python` | `node` | 语言模板（对应 `templates/<lang>`） |
| `--skins` | 逗号分隔，`rest` \| `graphql` \| `grpc` | `rest` | 网关协议皮，**至少 1 个** |
| `--yes` | 布尔 | `false` | 全取默认（`node` + `rest`），不做任何提问 |
| `--force` | 布尔 | `false` | 目标目录已存在且非空时覆盖 |

- 非交互终端（非 TTY）且既未给 `--lang` 也未给 `--yes`：**直接报错退出**（不挂起等待输入）。
- 交互问答顺序：**目标目录 → 语言 → 协议皮**（`rest` 默认启用，其余默认关闭）。

**退出码**（`bin/create.js` `fail()`）：

| 退出码 | 触发 |
|---|---|
| `0` | 成功 |
| `2` | 参数错误（`ERR_ARGS`：未知参数 / 非法语言 / 非法协议皮 / 缺 `--lang`/`--skins` 取值 / 非交互缺 `--lang` / 缺 `<target-dir>` / 模板缺失） |
| `3` | 目标目录已存在且非空且无 `--force`（`ERR_TARGET_EXISTS`，含目标存在但非目录） |

**生成后打印的下一步**（与 `lang` 对应）：

```
node   => 下一步: cd <dir> && npm install && npm start
python => 下一步: cd <dir> && pip install -e . && python impl/bootstrap.py
```

### 管理 CLI：`store-app`

来源：[`bin/store-app.js`](bin/store-app.js)（零依赖；选项模型单一来源 = `bin/create.js`）。
注意：`store-app` **未声明在 `package.json` 的 `bin` 中**，需显式用 `node bin/store-app.js` 调用。

```bash
node bin/store-app.js --version          # 打印版本
node bin/store-app.js --help             # 打印用法
node bin/store-app.js list [--json]      # 列可用语言与协议皮
node bin/store-app.js create <dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]
node bin/store-app.js --params-file <file>   # 整包参数 { cmd, opts }（opts 展平为 argv）
```

- `create` **透传** `bin/create.js`，输出与退出码一致。
- `--params-file <file>`：JSON 文件 `{ cmd, opts }`；`opts.dir` 作为位置参数置前，`true` 省略取值。
- `list` 非 JSON 输出形如：`create-store-app v0.2.1` / `语言: node, python` / `协议皮: rest, graphql, grpc`。

### 模板结构

两个模板的产物文件名一一对应，仅语言不同。

**`templates/node/`**（Node.js / `nodejs-store`）：

| 文件 | 作用 |
|---|---|
| `package.json` | 依赖与脚本；含 `__SKIN_DEPS__` 注入点，`__APP_NAME__` 为包名 |
| `store.config.json` | 装载配置：`sources`（连接 `kind` + `databases`）+ `defs`（定义根） |
| `schema/__APP_NAME__/Order.json` | **定义即数据**：纯 JSON schema（示例模型 `Order`） |
| `impl/bootstrap.js` | **入口**：调 `nodejs-store` 的 `createApp({datasource, config, fns, skins, reload})` 起服务 |
| `impl/fns.js` | **计算列回调实现**（`fnRef → impl`），启动时经 `fns` 注入 |
| `scripts/publish-defs.js` | 把定义（经 core 纯规划落点）发布到 meta-store |
| `seed/seed.json` | 示例种子数据（`{ "Order": [ ... ] }`） |
| `cases/smoke.json` | 冒烟用例（`GET /api/Order → 200`） |
| `README.md` | 生成工程的说明（含落点约定） |

**`templates/python/`**（Python / `storepy`，import `py_store`）：

| 文件 | 作用 |
|---|---|
| `pyproject.toml` | 依赖与构建；含 `__SKIN_DEPS__` 注入点，`name = "__APP_NAME__"` |
| `store.config.json` | 同 Node：`sources` + `defs` |
| `schema/__APP_NAME__/Order.json` | 纯 JSON schema（与 Node 模板一致） |
| `impl/bootstrap.py` | **入口**：`create_app(datasource, config, fns)` 后经 `store-gateway` 的 `build(...)` 起协议面 |
| `impl/fns.py` | 计算列回调实现（`FNS = {"amountLabel": amount_label}`） |
| `scripts/publish-defs.py` | 发布定义（仅标准库 `urllib`，不新增依赖） |
| `seed/seed.json` | 示例种子数据 |
| `cases/smoke.json` | 冒烟用例（GQL 形式 `Order { _id, title, amount, status }`） |
| `README.md` | 生成工程的说明（含落点约定） |

**模板关键内容**：

- `store.config.json`（两模板相同）：

```json
{
  "sources": { "default": { "kind": "mongodb", "databases": ["__APP_NAME__"] } },
  "defs": ["schema"]
}
```

- `schema/<app>/Order.json`：`{ name, description, idPrefix, fields, computes }`，
  其中 `computes.amountLabel = { "fn": true, "fnRef": "amountLabel", "type": "string", "depends": ["amount"] }`。
- Node 模板依赖（`package.json`，未注入皮前）：`nodejs-store ^4.0.0`、`store-gateway-node ^0.1.0`、`mongodb ^6.21.0`。
- Python 模板依赖（`pyproject.toml`，未注入皮前）：`storepy>=4.0.0`、`pymongo>=4.9`。

### 协议皮注入（`--skins`）

`bin/create.js` 按所选皮对生成物做**标记区间替换**（标记缺失即抛 `ERR_TEMPLATE`，不静默）：

| 皮 | Node 依赖包（`^0.1.0`） | Node 装配子选项 | Python extras |
|---|---|---|---|
| `rest`（默认） | `store-api-node` | `{ enabled: true, prefix: '/api' }` | `store-gateway-py[rest]` |
| `graphql` | `store-graphql-node` | `{ enabled: true, path: '/graphql' }` | `store-gateway-py[graphql]` |
| `grpc` | `store-grpc-node` | `{ enabled: true, port: Number(process.env.GRPC_PORT \|\| 50051) }` | `store-gateway-py[grpc]` |

- Node：注入 `impl/bootstrap.js` 的 `// __SKINS_START__` / `// __SKINS_END__` 块，并把皮包写入
  `package.json` 的 `__SKIN_DEPS__` 位；`http` 键**固定启用**（`PORT`，默认 `3000`），不属协议皮。
- Python：注入 `impl/bootstrap.py` 的 `# __SKINS_IMPORT_START__/# __SKINS_IMPORT_END__`
  （`from store_gateway import build`）与 `# __SKINS_START__/# __SKINS_END__`（`gw = build(store, ...)`），
  并把 `store-gateway-py[<皮...>]` 写入 `pyproject.toml`。
- **至少 1 个皮**：`--skins` 为空数组报 `ERR_ARGS`。

### 生成后的目录结构（示例）

以 `npx create-store-app demo` 为 `node` 模板、默认 `rest` 皮为例（`__APP_NAME__` → `demo`）：

```
demo/
├── package.json            # name = "demo"；deps 含 nodejs-store / store-gateway-node / mongodb / store-api-node
├── store.config.json       # sources.default = { kind: "mongodb", databases: ["demo"] }, defs: ["schema"]
├── schema/
│   └── demo/
│       └── Order.json       # 纯 JSON 定义（Order 示例模型）
├── impl/
│   ├── bootstrap.js         # createApp 起服务（skins 块已按 --skins 注入）
│   └── fns.js               # 计算列实现
├── scripts/
│   └── publish-defs.js      # 发布定义到 meta-store
├── seed/
│   └── seed.json            # 种子数据
├── cases/
│   └── smoke.json           # 冒烟用例
└── README.md
```

Python 模板同构，入口为 `impl/bootstrap.py` / `impl/fns.py`，依赖声明为 `pyproject.toml`。

### 各角色的职责

- **`schema/`**：定义即数据。一文件一 schema；落点（`source`/`database`/`schema`）由**目录层级 + `store.config.json`** 承载，
  **不写进 defn**。
- **`seed/`**：示例种子数据（`{ "<Model>": [ {...} ] }`），用于本地铺初始数据。
- **`cases/`**：冒烟用例（Node 为 HTTP 形式 `{method, path, expect}`；Python 为 GQL 形式 `{gql, expect}`）。
- **`impl/`**：入口与回调实现。定义里的 `fnRef` 字符串在此落成真实函数；缺实现启动即抛 `ERR_FN_MISSING`。

### 落点目录约定

<!-- SPEC:LOCATION:BEGIN -->
### Location: directory semantics + connection config (definitions carry no location)

A schema definition file contains no location fields (no `source` / `database` / `schema`; `namespace` is removed). Location is resolved from the definition directory layout plus the connection config:

- Under the definitions root `<defs-root>/`: the first directory level is the `database`; PostgreSQL adds a second level for `schema` (Mongo / MySQL / SQLite have no such level); deeper levels are free-form and flattened at load time (no hierarchy semantics).
- The connection config (`store.config.json`) declares `sources` (`kind` + `databases`) and `defs`; `kind` decides whether that database directory is read one level deeper for `schema`.
- Location fields are `source` / `database` / `schema` (PG only) / `collection`; the word `namespace` is removed.
- Same-named schemas: exactly one primary (no `replica`); the rest declare `{ "name": "...", "replica": true }`, add only a link, and must not repeat the structure. Zero or two-or-more primaries is an error.
- A duplicated `name` within one load batch is an error and the service does not start; re-loading the same `name` across versions bumps its version by 1.
- Writes are synchronized within a single connection, across the primary plus all links, in one transaction; a write spanning a cross-connection link is explicitly rejected or degraded with a feedback event (never silent).
<!-- SPEC:LOCATION:END -->

落点（`source` / `database` / `schema`）由「目录层级 + `store.config.json`」承载，**不写进 defn**（禁写 `namespace`/`source`/`database`/`schema`）。定义按「一个文件一个 schema」组织，脚本递归发现：

```
store.config.json
  sources: { <source>: { kind, databases: [...] } }   # 连接与其维护的库
  defs:    ["schema"]                                  # 定义根（相对本文件）

schema/
  <db>/Order.json          # L1 = database（须在 sources 的某连接 databases 中声明）
  <db>/Inventory/Sku.json  # 非 PG：L2+ 打平，仍归属该 db
  pg_db/app/Customer.json  # PG：L2 = schema（"app"）；L3+ 打平
  _draft/                  # `_` 前缀目录/文件忽略
```

- **L1 = database**：目录首段即库名；库名未在 `sources` 中声明 ⇒ 报错。
- **仅 PG 读 L2 = schema**：Postgres 连接的第二段目录即 `schema`；Mongo/MySQL/SQLite 的 L2+ 全部打平（仅影响归属，不改变 database）。
- **主从**：同名定义**恰好一份主**（无 `replica`），其余写 `{ "name": ..., "replica": true }` 为从（从定义只声明链路，发布时**不进控制面**）。
- **报错即退出码非 0**：同名主 ≥2 份 / 主 0 份 / 落点冲突 / 库未声明 / `kind` 非法 ⇒ 抛 `ERR:LOAD`（进程不启动 / 脚本退出码非 0，不静默）。
- 递归发现 `**/*.json`；`.json` 之外忽略；`_` 前缀目录/文件忽略。
- 预览将要发布的清单（落点 source/database/schema，不发请求）：`--dry-run`。

### 发布定义（publish-defs）

```bash
# Node
META_URL=http://127.0.0.1:8600 npm run defs:publish
# Python
META_URL=http://127.0.0.1:8600 python scripts/publish-defs.py
# 预览清单（不发请求）
node scripts/publish-defs.js --dry-run     # 或 python scripts/publish-defs.py --dry-run
```

- 环境变量：`META_URL`（**必填**，meta-store 地址）、`ACTOR`（默认 `ci`）。
- **只发布主定义**（`replica: true` 的从定义只声明链路，不进控制面）。
- 落点与主从判据唯一在 core（经宿主 `load` / `py_store.load` 的纯规划），脚本不写落点/主从谓词。
- 任一发布失败（含 `ERR:LOAD`）**退出码 1**（不静默）。

### 生成工程的运行期环境变量

| 变量 | 缺省 | 说明 |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017` | 数据源 |
| `MONGO_DB` | `<app>`（`__APP_NAME__` 替换后） | 库名 |
| `PORT` | `3000` | REST / HTTP 端口 |
| `GRPC_PORT` | `50051` | 选 `grpc` 皮时的端口 |
| `META_TENANT` / `META_ENV` | — | **两者都设**才开启发布-重载闭环（`reload`） |

## 场景事例

### 事例 1：一句命令起一个新数据应用（node 模板）

**业务背景**
要从零起一个订单服务，需要建定义、起 REST、连 Mongo——手工拼装费时且易漏。

**命令 / 调用**

```bash
npx create-store-app myapp --yes
cd myapp && npm install && npm start
curl http://127.0.0.1:3000/api/Order
```

**结果**
`myapp/` 下生成完整骨架（`package.json` / `store.config.json` / `schema/myapp/Order.json` /
`impl/bootstrap.js` / `impl/fns.js` / `scripts/publish-defs.js` / `seed/seed.json` / `cases/smoke.json` / `README.md`），
服务起在 `http://127.0.0.1:3000`，`GET /api/Order` 返回列表。

**优势所在**
一条命令 → 可运行工程；`--yes` 全取默认（`node` + `rest`），无需任何问答，适合脚本化 / CI。

### 事例 2：用 python 模板生成 py-store 应用

**业务背景**
团队有一部分服务用 Python，希望和 Node 端用**同一套** schema 与 GQL 方言。

**命令 / 调用**

```bash
npx create-store-app pyapp --lang python --yes
cd pyapp && pip install -e . && python impl/bootstrap.py
```

**结果**
生成 Python 版骨架（`pyproject.toml` / `impl/bootstrap.py` / `impl/fns.py` / `scripts/publish-defs.py` …），
`create_app(...)` 初始化数据层后经 `store-gateway` 的 `build(...)` 起协议面。

**优势所在**
两种语言的模板产物**文件结构与 schema 语义一一对应**（唯一差别是语言与依赖声明），
跨语言协同时定义层不需要各写一份。

### 事例 3：用生成工程的 seed 铺测试数据

**业务背景**
本地起来后想立刻看到数据，而不是空表。

**命令 / 调用**
生成工程自带 `seed/seed.json`：

```json
{ "Order": [ { "_id": "o1", "title": "示例订单", "amount": 100, "status": "open" } ] }
```

按需把它灌入库（示例数据即 `Order` 集合的一条记录），然后查询：

```bash
curl http://127.0.0.1:3000/api/Order
```

**结果**
返回包含 `o1` 的列表；`computes.amountLabel` 由 `impl/fns.js` 的 `amountLabel` 计算为 `100 元`。

**优势所在**
种子数据与 schema、回调实现**同工程同版本**，起服务即可见数据；计算列演示了「定义写 `fnRef`、实现落 `impl/`」的边界。

### 事例 4：用 cases/smoke.json 跑冒烟用例

**业务背景**
改完定义想快速确认「服务还活着、基本查询没坏」。

**命令 / 调用**
生成工程自带冒烟用例 `cases/smoke.json`：

```json
{ "cases": [ { "name": "list Orders", "method": "GET", "path": "/api/Order", "expect": 200 } ] }
```

（Python 模板的 `cases/smoke.json` 用 GQL 形式：`{ "cases": [ { "name": "query Orders via store", "gql": "Order { _id, title, amount, status }", "expect": "list" } ] }`。）

**结果**
据用例逐个发请求 / 查询并比对期望，一条 `GET /api/Order → 200` 的最小闭环通过。

**优势所在**
冒烟用例随工程生成、随版本管理；改动后跑一遍即可发现回归，无需手写脚本。

### 事例 5：修改 schema 后 publish-defs 重新发布

**业务背景**
给 `Order` 加一个 `status` 字段，要让它进入控制面（meta-store）并被协议面看到。

**命令 / 调用**
改 `schema/<app>/Order.json` 后：

```bash
# 先预览将要发布的清单（落点 source/database/schema，不发请求）
node scripts/publish-defs.js --dry-run
# 正式发布
META_URL=http://127.0.0.1:8600 npm run defs:publish
```

**结果**
脚本经 core 纯规划出落点与主从，**只把主定义** `POST` 到 `<META_URL>/meta/defs`（带 `actor`）；
每条打印 `[publish] Order <source>/<db>/<schema> ok`；重发同名定义版本 +1。

**优势所在**
定义发布与代码解耦：落点/主从判据唯一在 core，脚本**不写谓词**；`--dry-run` 先看清单再发，
失败即退出码 1（不静默）。

### 事例 6：从脚手架起步一路走到带上协议皮

**业务背景**
先想用 REST 起步，后面又要加 GraphQL，不想重构工程。

**命令 / 调用**
生成时一次选齐三种皮：

```bash
node bin/store-app.js create myapp --lang node --skins rest,graphql,grpc --yes
```

（`store-app create` 透传 `bin/create.js`，输出与退出码一致。）

**结果**
`package.json` 同时声明 `store-api-node` / `store-graphql-node` / `store-grpc-node`；
`impl/bootstrap.js` 的 `skins` 块注入三皮装配（`rest` / `graphql` / `grpc`），`http` 固定启用。

**优势所在**
协议皮**按标记区间注入**，标记缺失即抛 `ERR_TEMPLATE`（不静默），脚手架保证生成物一致；
`store-app list` 可随时查看可选语言与皮，`store-app` 与 `create-store-app` 共用同一选项模型（单一来源）。

## 边界与非目标

- **不含 MCP 皮**：本轮不做（代码注释明示：网关三皮 `rest`/`graphql`/`grpc`）。
- **不生成前端 / 小程序**：只生成数据应用（服务端 + 定义 + 脚本）。
- **定义不含定位字段**：落点由目录层级 + `store.config.json` 解析，禁写 `source`/`database`/`schema`/`namespace`。
- **回调不可序列化**：定义只写 `fnRef`，实现必须落 `impl/fns.*`。
- **`store-app` 非 npm bin**：只能用 `node bin/store-app.js` 调用（`package.json` 只声明 `create-store-app`）。

## FAQ

**Q1：`npx create-store-app` 和 `node bin/store-app.js` 什么区别？**
`create-store-app` 是脚手架主入口（`package.json` 的 `bin`）；`store-app` 是**管理 CLI**（版本 / 帮助 / list / 透传 create），
未声明为 bin，需 `node bin/store-app.js` 调用。

**Q2：`--yes` 和交互问答的区别？**
`--yes` 全取默认（`node` + `rest`）且不做任何提问；无 `--yes` / `--lang` 且为 TTY 时进入问答（依次问目录、语言、协议皮）。

**Q3：非 TTY 环境（CI）不传 `--lang` 会怎样？**
直接报错退出（退出码 2，`ERR_ARGS: 非交互终端请显式传 --lang（或用 --yes 取默认）`），**不会挂起等待输入**。

**Q4：目标目录已存在怎么办？**
已存在且**非空**且无 `--force` → 退出码 3（`ERR_TARGET_EXISTS`）。TTY 下会提示「覆盖？(y/N)」；
非交互一律要求 `--force`。目标存在但**不是目录**也报同一错误。

**Q5：为什么一定有 `http` 键？它算协议皮吗？**
`skins.http` **固定启用**（`PORT`，默认 `3000`），不属协议皮；协议皮只有 `rest` / `graphql` / `grpc`。

**Q6：`--skins` 能传空吗？**
不能。至少选 1 个皮，否则报 `ERR_ARGS: 至少选择 1 个协议皮`（退出码 2）。

**Q7：`__APP_NAME__` 会被替换成什么？**
替换为目标目录的 **basename**，**文件内容与路径名都替换**（如 `schema/__APP_NAME__/` → `schema/<app>/`、
`store.config.json` 的 `databases: ["<app>"]`）。

**Q8：改完 schema 后怎么让它生效？**
用 `scripts/publish-defs.*` 发布到 meta-store（`META_URL` 必填）；若业务进程设了 `META_TENANT`/`META_ENV`，
发布-重载闭环会经 `reload` 让新定义对协议面可见。

**Q9：`publish-defs` 会不会把从定义也发上去？**
不会。只发布**主定义**；`replica: true` 的从定义只声明链路，不进控制面。

**Q10：为什么定义里不能写函数？**
定义要能跨进程发布，而函数不可序列化；所以定义只写 `fnRef` 字符串，实现在 `impl/fns.*` 注入，
缺实现启动即抛 `ERR_FN_MISSING`（不静默）。

**Q11：Python 模板的发布脚本要额外装依赖吗？**
不用。`scripts/publish-defs.py` 对外请求**仅用标准库 `urllib`**，不新增依赖。

**Q12：怎么验证 SPEC 片段在各载体间一致？**
在 `create-store-app/` 根目录运行 `node tools/check-spec-snippets.js`，它校验
`README.md` 与两个模板 README 的 `SPEC:LOCATION` 片段逐字一致，不一致则 `exit 1`。

## Development

```bash
npm test        # = node --test
```

- **冒烟用例** `test/smoke.test.js`：生成到临时目录并校验关键文件存在、`__APP_NAME__` 替换、
  协议皮注入、以及退出码契约（`0` / `2` / `3`）。
- 其中 `publish-defs` 目录语义用例需能解析到相邻 `nodejs-store`（monorepo 布局）；
  单仓 checkout 下会**显式跳过并上报**（不静默失守）。
- **SPEC 片段校验**：

```bash
node tools/check-spec-snippets.js      # 在 create-store-app/ 根目录执行
```

- **变更记录**见 [CHANGELOG.md](CHANGELOG.md)（当前 `0.2.1`）。

## Related projects

common-store 家族（分层见根 `README.md`）：

| 层 | 组件 | 关系 |
|---|---|---|
| 宿主 | `nodejs-store` / `storepy`（import `py_store`） | 生成工程的核心依赖（`node` / `python` 模板各对应一个） |
| 协议皮 | `store-api` / `store-graphql` / `store-grpc` + `store-gateway` | 由 `--skins` 注入依赖与装配 |
| 控制面 | `meta-store` | 生成工程的 `scripts/publish-defs.*` 向其发布定义 |
| 脚手架 | **`create-store-app`（本仓）** | 一键生成数据驱动应用 |

- 宿主文档：https://coenddt.github.io/py-store/ · 仓库 https://github.com/coenddt/py-store
- 宿主文档：https://github.com/coenddt/nodejs-store （npm `nodejs-store`）
- 引擎：https://coenddt.github.io/rust-store/ · 仓库 https://github.com/coenddt/rust-store

## License

MIT（见 [LICENSE](LICENSE)，Copyright (c) 2026 丁滔）。
