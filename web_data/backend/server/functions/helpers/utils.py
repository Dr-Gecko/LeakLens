import re
from typing import Any
from fastapi import status
from decimal import Decimal
from warnings import deprecated
from functions.helpers import database
from fastapi.responses import JSONResponse
from datetime import datetime, timezone, date
# Breaches Table Format
def safe_table_name(name: str) -> str:
    name=name.replace(" ","_").lower()
    if not re.fullmatch(r"[A-Za-z0-9_]+", name):
        raise ValueError("Invalid table name")
    return name
def generate_breach_table(breach_name):
    adapted_table_name=safe_table_name(breach_name)
    breach_table=f"""
    create table {adapted_table_name} (
        id int auto_increment primary key,
        uuid varchar(255),
        name TEXT null,
        socials TEXT null,
        pii TEXT null,
        extra TEXT null,
    )"""
    return breach_table,adapted_table_name

allowed_self_edit_columns = {
    "email",
    "avatar",
    "password",
    "username"
}
allowed_manager_edit_columns = {
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
@deprecated("Use api_response",stacklevel=10)
def format_response(data: Any = None, status_code: int = status.HTTP_200_OK, reason: str = "success"):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": reason,
            "data": clean_json(data) if data is not None else {},
        },
    )

def api_response(data: Any = None,message: str = "Success",status_code: int = status.HTTP_200_OK,success: bool | None = None,meta: dict | None = None,error: dict | None = None):
    if success is None:
        success = status_code < 400
    return JSONResponse(status_code=status_code,content={"success": success,"status_code": status_code,"message": message,"timestamp": datetime.now(timezone.utc).isoformat(),"data": clean_json(data) if data is not None else {},"meta": meta or {},"error": error})

def clean_json(data):
    if isinstance(data, list):
        return [clean_json(item) for item in data]

    if isinstance(data, dict):
        return {key: clean_json(value) for key, value in data.items()}

    if isinstance(data, (datetime, date)):
        return data.isoformat()

    if isinstance(data, Decimal):
        return int(data) if data % 1 == 0 else float(data)

    return data

async def reset_table_count(table,db):
    await database.execute_batch(["SET @num := 0",f"UPDATE {table} SET id = @num := (@num+1)",f"ALTER TABLE {table} AUTO_INCREMENT = 1",], database=db)