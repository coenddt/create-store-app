# create-store-app

Scaffold a data-driven app on common-store (`nodejs-store` / `storepy`).

## 用法

```bash
npx create-store-app <target-dir> [--lang node|python] [--force]
```

- `<target-dir>`：必填，目标目录。
- `--lang`：语言模板，缺省 `node`（`node` | `python`）。
- `--force`：目标目录已存在且非空时覆盖。

退出码：`0` 成功 / `2` 参数错误 / `3` 目标目录已存在且无 `--force`。
