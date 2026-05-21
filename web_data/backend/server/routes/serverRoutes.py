from functions import server
from fastapi import APIRouter, Request, Header

router = APIRouter(prefix="/server", tags=["Utils"])

@router.get("/config")
async def getConfig():
    return await server.printconfig()

@router.post("/config")
async def editConfig(request:Request):
    return await server.editConfig(request)