import asyncio
import json
import os
from pathlib import Path

from pymongo import AsyncMongoClient

from py_store import create_app

ROOT = Path(__file__).resolve().parent.parent


async def main():
    client = AsyncMongoClient(os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017"))
    schemas = json.loads((ROOT / "schema" / "Order.json").read_text(encoding="utf-8"))
    app = await create_app(datasource=client[os.environ.get("MONGO_DB", "__APP_NAME__")],
                           schemas=schemas if isinstance(schemas, list) else [schemas])
    return app


if __name__ == "__main__":
    asyncio.run(main())
