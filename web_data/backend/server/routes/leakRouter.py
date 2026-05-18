from fastapi import APIRouter, Request, Query

import functions.leaklense as leak

router = APIRouter(prefix="/leaklense", tags=["Leaklense"])


@router.get("/stats")
async def upper_stats(request:Request):
    stats_data=await leak.top_stats_data()
    return stats_data
