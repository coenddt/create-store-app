import asyncio
import os
from pathlib import Path

from pymongo import AsyncMongoClient

from fns import FNS
from py_store import create_app
# __SKINS_IMPORT_START__
from store_gateway import build
# __SKINS_IMPORT_END__

ROOT = Path(__file__).resolve().parent.parent


async def main():
    client = AsyncMongoClient(os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017"))
    # 落点由「目录 + store.config.json」承载（L1=database、PG L2=schema、L3+ 打平）；
    # 加载经 create_app 的 config 走宿主 load_defs（core 纯规划，禁在此写落点/主从谓词）
    app = await create_app(datasource=client[os.environ.get("MONGO_DB", "__APP_NAME__")],
                           config=str(ROOT / "store.config.json"),
                           fns=FNS)
    store = app["store"]
    # __SKINS_START__
    gw = build(store, rest={"enabled": True, "prefix": "/api"})
    gw.run("127.0.0.1", int(os.environ.get("PORT", "3000")))
    # __SKINS_END__
    return app


if __name__ == "__main__":
    asyncio.run(main())
