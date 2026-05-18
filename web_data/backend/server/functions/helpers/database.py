import asyncio
import os
from typing import Any, Sequence

import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def make_connection(database: str | None = None):
    return mysql.connector.connect(
        host=_require_env("mysql_host"),
        port=int(os.getenv("sql_port", "3306")),
        user=_require_env("mysql_user"),
        password=_require_env("mysql_password"),
        database=database or os.getenv("mysql_backend_db"),
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