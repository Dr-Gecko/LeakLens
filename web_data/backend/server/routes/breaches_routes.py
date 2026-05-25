import functions.breaches as breach
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
router = APIRouter(prefix="/breaches", tags=["Leaklens"])

@router.get("/stats")
async def get_stats_data(request:Request):
    return await breach.pull_stats_data()

@router.get("/list")
async def list_breaches(request:Request):
    return await breach.pull_breaches()

@router.get("/search")
async def search_breaches(request: Request, table_name: str, search_value: str, search_field: str = None,limit:int = 100):
    return await breach.search_all_columns(table_name, search_value, search_field=search_field,limit=limit)

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

