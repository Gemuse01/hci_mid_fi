# backend/api_news.py
from typing import List, Union

from fastapi import APIRouter, Query
from .news_service import get_all_news

router = APIRouter()


@router.get("/api/news")
async def api_get_news(
    symbols: Union[List[str], str] = Query(
        ...,
        description="티커 목록. 예: ?symbols=TSLA&symbols=MSFT 또는 ?symbols=TSLA,MSFT",
    )
):
    if isinstance(symbols, list):
        symbol_list: List[str] = [s.strip() for s in symbols if s.strip()]
    else:
        symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]

    print("[api_get_news] symbols =", symbol_list)

    items = get_all_news(symbol_list)

    print(f"[api_get_news] total items returned = {len(items)}")

    return {"items": items}
