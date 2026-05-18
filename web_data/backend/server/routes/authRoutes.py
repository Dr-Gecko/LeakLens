from fastapi import APIRouter, Request, Header, status
import functions.auth as auth
import functions.helpers.utils as utils

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
async def routeRegister(request: Request):
    try:
        return await auth.createUser(request)
    except Exception:
        return utils.formatResponse(reason="Registration failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.post("/login")
async def routeLogin(request: Request):
    try:
        return await auth.loginUser(request)
    except Exception:
        return utils.formatResponse(reason="Login failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.get("/list")
async def routeListPublicUsers(request: Request, api_key: str = Header(..., alias="API-KEY")):
    try:
        return await auth.getUsersPublic(api_key)
    except Exception:
        return utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.get("/info")
async def getUserInfo(api_key: str = Header(..., alias="API-KEY")):
    try:
        return await auth.getUserInfo(api_key)
    except Exception as error:
        print(error)
        return utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.put("/user/edit")
async def routeEditUser(request: Request, api_key: str = Header(..., alias="API-KEY")):
    try:
        return await auth.updateUser(api_key,request)
    except Exception:
        return utils.format_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            reason="failed"
        )


@router.delete("/user/delete")
async def routeDeleteUser(request: Request, api_key: str = Header(..., alias="API-KEY")):
    try:
        return await auth.delete_user(api_key, request)
    except Exception:
        return utils.format_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            reason="failed"
        )
