import functions.breaches as breach
from fastapi import APIRouter, Request, Header
from fastapi.responses import StreamingResponse


router = APIRouter(prefix="/breaches", tags=["Leaklense"])

@router.get("/stats")
async def getStatsData(request:Request):
    return await breach.pullStatsData()

@router.get("/list")
async def listBreaches(request:Request):
    return await breach.pullBreaches()

@router.get("/search")
async def searchBreaches(request: Request, table_name: str, search_value: str, search_field: str = None,limit:int = 100):
    return await breach.searchAllColumns(table_name, search_value, search_field=search_field,limit=limit)

@router.post('/create')
async def createBreach(request: Request):
    return await breach.create_breach(request)

@router.get("/reload")
async def reload_breach_count(request: Request):
    return StreamingResponse(
        breach.reload_count_stream(request),
        media_type="text/event-stream"
    )