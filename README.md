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
