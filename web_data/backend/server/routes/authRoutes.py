import functions.auth as auth
import functions.helpers.utils as utils

from fastapi import APIRouter, Request, Header, status, UploadFile, File

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
async def routeRegister(request: Request):
    return await auth.createUser(request)

@router.post("/login")
async def routeLogin(request: Request):
    return await auth.loginUser(request)

@router.get("/list")
async def routeListPublicUsers(request:Request):
    return await auth.getUsersPublic(request)

@router.get("/info")
async def getUserInfo(request:Request):
    return await auth.getUserInfo(request)

@router.post("/update")
async def selfUpdate(request: Request):
    return await auth.selfUpdate(request)


@router.post("/avatar")
async def updateAvatar(request: Request,file: UploadFile = File(...)):
    try:
        return await auth.updateAvatar(request,file)
    except Exception:
        return utils.formatResponse(reason="Registration failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.put("edit")
async def routeEditUser(request: Request):
    return await auth.updateUser(request)

@router.delete("/user/delete")
async def routeDeleteUser(request: Request):
    return await auth.deleteUser(request)