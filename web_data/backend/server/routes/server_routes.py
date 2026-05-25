from functions import server
from fastapi import APIRouter, Request, Header

router = APIRouter(prefix="/server", tags=["Utils"])

@router.get("/config")
async def get_config():
    return await server.printconfig()

@router.post("/config")
async def edit_config(request:Request):
    return await server.edit_config(request)
