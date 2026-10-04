"""把 schema 定义发布到 meta-store。

落点（source/database/schema）与主从由「目录 + store.config.json」决定，
判据唯一在 core（经宿主 ``py_store.load`` 的 ``plan_load`` 纯规划），本脚本不写落点/主从谓词。
仅发布主定义（``replica: true`` 的从定义只声明链路，不进控制面）。

环境变量：META_URL（必填）；ACTOR（默认 ci）。
用法：python scripts/publish-defs.py [--dry-run]   失败（含 ERR:LOAD）退出码 1（不静默）。
对外请求仅用标准库（urllib）。
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

from py_store import load

CONFIG_FILE = Path(__file__).resolve().parent.parent / 'store.config.json'


def plan_defs(config_path=CONFIG_FILE):
    """读 store.config.json → 按 defs 根收集定义（宿主 load 的 IO：``_`` 前缀忽略、仅 .json）
    → core 纯规划落点与主从。返回装载项 ``[{defn, location}]``（主在前、其后从）。
    """
    cfg, base_dir = load.read_config(str(config_path))
    roots = [os.path.abspath(os.path.join(base_dir, r)) for r in (cfg.get('defs') or [])]
    files = load.collect_files(roots)
    return load.plan_load(cfg, files)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    dry_run = '--dry-run' in argv
    if not dry_run and not os.environ.get('META_URL'):
        print('ERR:PUBLISH 需要 META_URL', file=sys.stderr)
        return 1
    try:
        items = plan_defs()
    except Exception as e:                                     # ERR:LOAD（主重复 / 库未声明 / kind 非法…）
        print(str(e), file=sys.stderr)
        return 1
    masters = [it for it in items if not (it.get('defn') or {}).get('replica')]  # 只发布主定义
    failed = 0
    for it in masters:
        defn = it['defn']
        loc = it.get('location') or {}
        place = '/'.join(str(loc[k]) for k in ('source', 'database', 'schema') if loc.get(k))
        if dry_run:
            print(f"[dry] {defn.get('name')} {place}")
            continue
        req = urllib.request.Request(
            f"{os.environ['META_URL']}/meta/defs",
            data=json.dumps({'defn': defn, 'actor': os.environ.get('ACTOR', 'ci')}).encode('utf8'),
            headers={'content-type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req) as r:
                if r.status < 300:
                    print(f"[publish] {defn.get('name')} {place} ok")
                    continue
                raise RuntimeError(str(r.status))
        except Exception as e:
            failed += 1
            print(f"[publish] {defn.get('name')} 失败 {e}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
