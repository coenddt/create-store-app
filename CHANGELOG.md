# Changelog

## 0.2.0 (2026-10-04)

### Breaking（定义零落点 / 目录即落点 / 依赖下限抬升）

- **定义零落点**：模板 `schema/**/*.json` 不再声明定位字段；落点由「定义目录布局 + `store.config.json` 连接配置」解析
  —— `<defs-root>/` 一级目录 = `database`，PostgreSQL 再加二级 = `schema`（Mongo / MySQL / SQLite 无此级），更深层级自由并在装载时打平。
- **`namespace` 一词移除**：旧「子目录相对路径 → `defn.namespace`」表述整体改由落点目录约定取代。
- **依赖下限抬升**：模板 `nodejs-store` `^3.3.0 → ^4.0.0`；模板 `storepy` `>=3.3.0 → >=4.0.0`（对齐 4.0.0 的落点 / 翻译 / 命名契约）。

### Migration

1. 按新语义重排 `schema/` 目录：一级目录 = `database`，PostgreSQL 再加二级 = `schema`。
2. 从定义文件中删除任何定位字段（`source` / `database` / `schema` / `namespace`）。
3. 用 `store.config.json` 声明 `sources`（`kind` + `databases`）与 `defs`。
4. 重新生成项目（模板依赖下限已抬升到 4.x）。

### Docs

- 模板 README 与顶层 README 写入「定义目录与落点约定」（`SPEC:LOCATION` 片段），并由 `tools/check-spec-snippets.js` 在 CI 校验各载体逐字一致。
