import functions.auth as auth
import functions.helpers.utils as utils
from fastapi import APIRouter, Request, status, UploadFile, File

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
async def route_register(request: Request):
    return await auth.create_user(request)

@router.post("/login")
async def route_login(request: Request):
    return await auth.login_user(request)

@router.get("/list")
async def route_list_public_users(request:Request):
    return await auth.get_users_public(request)

@router.get("/info")
async def get_user_info(request:Request):
    return await auth.get_user_info(request)

@router.post("/update")
async def self_update(request: Request):
    return await auth.self_update(request)


@router.post("/avatar")
async def update_avatar(request: Request,file: UploadFile = File(...)):
    try:
        return await auth.update_avatar(request,file)
    except Exception:
        return utils.format_response(reason="Registration failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

@router.put("edit")
async def route_edit_user(request: Request):
    return await auth.update_user(request)

@router.delete("/user/delete")
async def route_delete_user(request: Request):
    return await auth.delete_user(request)

# API Key Routes
@router.post("/token")
async def generate_api_token(request: Request):
    return await auth.create_api_token(request)

@router.delete("/token")
async def delete_api_token(request: Request):
    return await auth.delete_api_token(request)

@router.get("/token")
async def list_api_tokens(request: Request):
    return await auth.list_all_tokens(request)