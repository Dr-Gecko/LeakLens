import os
from typing import Any
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import status
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi

load_dotenv()
allowedSelfEditColumns = {
    "email",
    "avatar",
    "password",
}
allowedManagerEditColumns = {
    "email",
    "avatar",
    "last_login_ip",
    "password",
    "role"
}
rbac_reference = {
    "user":0,
    "contributer":1,
    "manager":2,
    "admin":3,
    "owner":4,
    "root":5
}
def formatResponse(data: Any = None, status_code: int = status.HTTP_200_OK, reason: str = "success"):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": reason,
            "data": data if data is not None else {},
        },
    )