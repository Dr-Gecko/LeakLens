import asyncio
from functions import server
from functions.helpers import config as config
from fastapi import APIRouter, Request

router = APIRouter(prefix="/server", tags=["Utils"])


@router.get("/config")
async def get_config():
    return await server.printconfig()


@router.post("/config")
async def edit_config(request: Request):
    return await server.edit_config(request)

@router.get("/stats")
async def get_container_stats():
    container_names = config.get_config_value("api.containers_to_monitor")
    stats_data = await asyncio.gather(*[asyncio.to_thread(server.get_single_container_stats, name) for name in container_names])
    return {
        "status": "success",
        "data": stats_data,
    }