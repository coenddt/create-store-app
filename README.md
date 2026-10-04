# create-store-app

Scaffold a data-driven app on common-store (`nodejs-store` / `storepy`).

## 用法

```bash
npx create-store-app <target-dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]
```

- `<target-dir>`：目标目录；省略且为 TTY 时进入交互问答（依次问目录、语言、协议皮）。
- `--lang`：语言模板，缺省 `node`（`node` | `python`）。
- `--skins`：网关协议皮，逗号分隔，**至少 1 个**（`rest` | `graphql` | `grpc`），缺省 `rest`。
- `--yes`：全取默认（`node` + `rest`），不做任何提问。
- `--force`：目标目录已存在且非空时覆盖。

非交互终端（非 TTY）未给 `--lang` 也未给 `--yes` 时直接报错退出，不会挂起等待输入。

退出码：`0` 成功 / `2` 参数错误 / `3` 目标目录已存在且无 `--force`。

## 定义目录与落点约定

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

## 管理 CLI

除脚手架入口 `create-store-app` 外，另提供 `store-app`（`bin/store-app.js`，零依赖）：

```bash
node bin/store-app.js --version          # 打印版本
node bin/store-app.js --help             # 打印用法
node bin/store-app.js list [--json]      # 列可用语言与协议皮
node bin/store-app.js create <dir> [--lang node|python] [--skins rest,graphql,grpc] [--yes] [--force]
```

- `create` 透传 `bin/create.js`，输出与退出码一致；`LANGS` / `SKINS` 以 `bin/create.js` 为唯一来源。
- `--params-file <file>`：整包参数 `{ cmd, opts }`（`opts` 展平为 argv）。
