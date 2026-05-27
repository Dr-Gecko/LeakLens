import asyncio
import mysql.connector
from typing import Any, Sequence
from functions.helpers.config import load_config


def _require_config(config: dict, path: str):
    value = config

    for key in path.split("."):
        value = value.get(key)

        if value is None:
            raise RuntimeError(f"Missing required config value: {path}")

    return value

def make_connection(database: str | None = None):
    config = load_config()

    return mysql.connector.connect(
        host=_require_config(config, "database.host"),
        port=int(_require_config(config, "database.port")),
        user=_require_config(config, "database.user"),
        password=_require_config(config, "database.password"),
        database=database or _require_config(config, "database.backend_db"),
    )

def close_connection(connection: Any) -> None:
    if connection and connection.is_connected():
        connection.close()


def _fetch_all_sync(statement: str,params: Sequence[Any] | None = None,database: str | None = None) -> list[Any]:
    connection = make_connection(database)
    try:
        cursor = connection.cursor(dictionary=True)
        try:
            cursor.execute(statement, params)
            return cursor.fetchall()
        finally:
            cursor.close()
    finally:
        close_connection(connection)


def _fetch_one_sync(statement, params=None, database=None):
    connection = make_connection(database)

    try:
        cursor = connection.cursor(dictionary=True, buffered=True)

        try:
            cursor.execute(statement, params)
            return cursor.fetchone()
        finally:
            cursor.fetchall()  # clears unread results
            cursor.close()

    finally:
        close_connection(connection)


def _execute_sync(statement: str,params: Sequence[Any] | None = None,database: str | None = None) -> int:
    connection = make_connection(database)
    try:
        cursor = connection.cursor()
        try:
            cursor.execute(statement, params)
            connection.commit()
            return cursor.rowcount
        finally:
            cursor.close()
    finally:
        close_connection(connection)


async def fetch_all(statement: str,params: Sequence[Any] | None = None,database: str | None = None) -> list[Any]:
    return await asyncio.to_thread(_fetch_all_sync,statement,params,database)


async def fetch_one(statement: str,params: Sequence[Any] | None = None,database: str | None = None) -> Any:
    return await asyncio.to_thread(_fetch_one_sync,statement,params,database)


async def execute(statement: str,params: Sequence[Any] | None = None,database: str | None = None,) -> int:
    return await asyncio.to_thread(_execute_sync,statement,params,database)