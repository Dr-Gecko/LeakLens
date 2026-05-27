import functions.breaches as breach
from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse
from typing import List
router = APIRouter(prefix="/breaches", tags=["Leaklens"])

@router.get("/stats")
async def get_stats_data(request:Request):
    return await breach.pull_stats_data(request)

@router.get("/list")
async def list_breaches(request:Request):
    return await breach.pull_breaches(request)

@router.get("/search")
async def search_breaches(request: Request, table_name: str, search_value: List[str] = Query(default=[]), search_field: List[str] = Query(default=[]), limit: int = 100, offset: int = 0):
    return await breach.search_all_columns(request, table_name, search_value, search_field=search_field, limit=limit, offset=offset)

@router.post('/create')
async def create_breach(request: Request):
    return await breach.create_breach(request)

@router.post('/edit')
async def edit_breach(request: Request):
    return await breach.update_breach(request)

@router.get("/reload")
async def reload_breach_count(request: Request):
    return StreamingResponse(
        breach.reload_count_stream(request),
        media_type="text/event-stream"
    )
