import asyncio
from functions import server
from fastapi import APIRouter, Request
from functions.auth import verify_auth_role
from functions.helpers import config as config
router = APIRouter(prefix="/server", tags=["Utils"])

@router.get("/config")
async def get_config(request:Request):
    auth_token = request.headers.get("api-key")
    verified = await verify_auth_role(auth_token)    
    if verified[0]!=True: return verified[1] 
    return await server.return_config()

@router.get("/info")
async def get_config(request:Request):
    auth_token = request.headers.get("api-key")
    verified = await verify_auth_role(auth_token)    
    if verified[0]!=True: return verified[1] 
    return await server.leak_lens_info()


@router.post("/config")
async def edit_config(request: Request):
    return await server.edit_config(request)

@router.get("/stats")
async def get_container_stats(request:Request):
    auth_token = request.headers.get("api-key")
    verified = await verify_auth_role(auth_token)    
    if verified[0]!=True: return verified[1] 
    container_names = config.get_config_value("api.containers_to_monitor")
    stats_data = await asyncio.gather(*[asyncio.to_thread(server.get_single_container_stats, name) for name in container_names])
    return {
        "status": "success",
        "data": stats_data,
    }