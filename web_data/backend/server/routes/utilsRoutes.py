from fastapi import APIRouter, Request, Header, status, UploadFile, File
import functions.utilities as utilities
import functions.helpers.utils as utils

router = APIRouter(prefix="/utils", tags=["Utilities"])


@router.post("/avatar")
async def updateAvatar(request: Request, api_key: str = Header(..., alias="API-KEY"),file: UploadFile = File(...)):
    try:
        return await utilities.updateAvatar(request,api_key,file)
    except Exception:
        return utils.formatResponse(reason="Registration failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
