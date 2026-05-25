import re
from typing import Any
from fastapi import status
from decimal import Decimal
from datetime import datetime, date
from fastapi.responses import JSONResponse
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
        extra TEXT null
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
def format_response(data: Any = None, status_code: int = status.HTTP_200_OK, reason: str = "success"):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": reason,
            "data": data if data is not None else {},
        },
    )
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
