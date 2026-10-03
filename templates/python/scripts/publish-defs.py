"""把 schema/ 目录下定义（递归）发布到 meta-store。

目录约定：schema/**/*.json；子目录相对路径 → defn.namespace；`_` 前缀文件/目录忽略。
环境变量：META_URL（必填）；ACTOR（默认 ci）。
用法：python scripts/publish-defs.py [--dry-run]   失败（含同名重复）退出码 1（不静默）。
仅用标准库（urllib），不新增依赖。
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parent.parent / 'schema'


def collect_defs(schema_dir=SCHEMA_DIR):
    """递归收集定义：返回 [{rel, name, namespace, defn}]（可单测：纯 IO + 映射，无网络）。"""
    schema_dir = Path(schema_dir)
    if not schema_dir.is_dir():
        raise RuntimeError(f'ERR:PUBLISH schema 目录不存在：{schema_dir}')
    out, seen = [], {}
    for abs_path in sorted(schema_dir.rglob('*.json')):
        parts = abs_path.relative_to(schema_dir).parts
        if any(p.startswith('_') for p in parts):              # `_` 前缀忽略
            continue
        rel = '/'.join(parts)
        namespace = '/'.join(parts[:-1]) or None               # 子目录 → namespace
        raw = json.loads(abs_path.read_text(encoding='utf8'))
        for defn in (raw if isinstance(raw, list) else [raw]):
            name = defn.get('name') or abs_path.stem
            if name in seen:
                raise RuntimeError(
                    f'ERR:PUBLISH 同名定义重复：{name}（{seen[name]} 与 {rel}）——持久化键为 name，禁覆盖'
                )
            seen[name] = rel
            merged = dict(defn, name=name)
            if namespace:
                merged['namespace'] = namespace
            out.append({'rel': rel, 'name': name, 'namespace': namespace, 'defn': merged})
    return out


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    dry_run = '--dry-run' in argv
    if not dry_run and not os.environ.get('META_URL'):
        print('ERR:PUBLISH 需要 META_URL', file=sys.stderr)
        return 1
    try:
        defs = collect_defs()
    except Exception as e:                                     # 同名重复 / 目录缺失
        print(str(e), file=sys.stderr)
        return 1
    failed = 0
    for d in defs:
        if dry_run:
            suffix = f" ns={d['namespace']}" if d['namespace'] else ''
            print(f"[dry] {d['rel']} {d['name']}{suffix}")
            continue
        req = urllib.request.Request(
            f"{os.environ['META_URL']}/meta/defs",
            data=json.dumps({'defn': d['defn'], 'actor': os.environ.get('ACTOR', 'ci')}).encode('utf8'),
            headers={'content-type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req) as r:
                if r.status < 300:
                    print(f"[publish] {d['rel']} {d['name']} ok")
                    continue
                raise RuntimeError(str(r.status))
        except Exception as e:
            failed += 1
            print(f"[publish] {d['rel']} {d['name']} 失败 {e}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
