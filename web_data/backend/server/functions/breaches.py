import re
import ast
import time
import json
import asyncio
import traceback
from fastapi import Request
import functions.auth as auth
import functions.helpers.utils as utils
import functions.helpers.database as database
from functions.helpers import config as config

_col_cache: dict[str, dict] = {}
_COL_CACHE_TTL = 300 
_TEXT_TYPES = frozenset({"varchar", "char", "text", "tinytext", "mediumtext", "longtext", "enum", "set"})


async def _get_table_columns(table_name: str, breach_database: str) -> list[dict] | None:
    now = time.time()
    cached = _col_cache.get(table_name)
    if cached and now - cached["ts"] < _COL_CACHE_TTL:
        return cached["cols"]

    cols = await database.fetch_all(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
        (breach_database, table_name),
        database="information_schema"
    )
    if not cols:
        return None

    _col_cache[table_name] = {"cols": cols, "ts": now}
    return cols

async def reload_count_stream(request: Request):
    breach_database = config.get_config_value("database.breaches_db")
    verified = await auth.verify_auth_role(request.headers.get("api-key"))
    if not verified[0]:
        yield f"data: {json.dumps({'status': 'error', 'reason': 'API key invalid', 'progress': 0})}\n\n"
        return
    try:
        tables = await database.fetch_all("SELECT table_name FROM breaches WHERE table_name IS NOT NULL",database=breach_database)
        total_tables = len(tables)
        print(tables)
        if total_tables == 0:
            yield f"data: {json.dumps({'status': 'finished', 'complete': True, 'progress': 100})}\n\n"
            return
        for index, table in enumerate(tables, start=1):
            if await request.is_disconnected():
                break
            table_name = table["table_name"]
            yield f"data: {json.dumps({'status': 'processing', 'table': table_name, 'progress': round(((index - 1) / total_tables) * 100, 2)})}\n\n"
            count = await database.fetch_one(f"SELECT COUNT(*) AS total FROM `{table_name}`",database=breach_database)
            record_count = count["total"]
            await database.execute("UPDATE breaches SET record_count = %s WHERE table_name = %s",params=(record_count, table_name),database=breach_database)
            progress_percent = round((index / total_tables) * 100, 2)
            yield f"data: {json.dumps({'status': 'completed', 'table': table_name, 'records': record_count, 'progress': progress_percent})}\n\n"
            await asyncio.sleep(0.1)
        yield f"data: {json.dumps({'status': 'finished', 'complete': True, 'progress': 100})}\n\n"
    except asyncio.CancelledError:
        print("Stream cancelled")
        raise
    except Exception as error:
        print(error)
        yield f"data: {json.dumps({'status': 'error', 'reason': 'failed to reload counts'})}\n\n"
    
    
async def create_breach(request:Request):
    try:
        breach_database = config.get_config_value("database.breaches_db")
        auth_token = request.headers.get("api-key")
        verified = await auth.verify_auth_role(auth_token)    
        if verified[0]!=True: return verified[1] 
        records, threat_actor, name,type,ingested = (request_data := await request.json())['record_count'], request_data['threat_actor'], request_data['name'],request_data['type'],request_data['ingested']
        table_data=utils.generate_breach_table(name)
        await database.execute(table_data[0],database=breach_database) # create actual table
        sql = """INSERT INTO breaches (name,threat_actor,record_count,ingested,`type`,table_name,added_by) VALUES (%s, %s, %s, %s, %s, %s, %s)"""
        values = (name.title(),threat_actor,records,ingested,type.title(),table_data[1],verified[1])
        await database.execute(sql,params=values,database=breach_database)
        return utils.format_response(data={"answer":"created table"})
    except Exception as error:
        print(error)
        traceback.print_exc()
        return utils.format_response(status_code=500,reason="server_error")

async def delete_breach(request: Request):
    try:
        auth_token = request.headers.get("api-key")
        verified = await auth.verify_auth_role(auth_token)
        if verified[0] != True: return verified[1]
        breach_database = config.get_config_value("database.breaches_db")
        breach_id = (await request.json())["id"]
        row = await database.fetch_one("SELECT table_name FROM breaches WHERE id = %s", (breach_id,), database=breach_database)
        if not row: return utils.format_response(status_code=404, reason="not_found")
        await database.execute(f"DROP TABLE IF EXISTS `{row['table_name']}`", database=breach_database)
        await database.execute("DELETE FROM breaches WHERE id = %s", params=(breach_id,), database=breach_database)
        return utils.format_response(data={"deleted": breach_id})
    except Exception:
        traceback.print_exc()
        return utils.format_response(status_code=500, reason="server_error")

async def search_all_columns(request: Request, table_name: str, search_value: list, limit: int = 100, search_field: list = None, search_exact: list = None, offset: int = 0):
    try:
        auth_token = request.headers.get("api-key")
        verified = await auth.verify_auth_role(auth_token)
        if verified[0] != True:
            return verified[1]

        breach_database = config.get_config_value("database.breaches_db")
        columns = await _get_table_columns(table_name, breach_database)
        if not columns:
            return utils.format_response(data=[], status_code=404, reason="table_not_found")

        col_types = {c["column_name"]: c["data_type"].lower() for c in columns}
        col_names = set(col_types.keys())

        if search_field:
            conditions, params = [], []
            for i, (sf, sv) in enumerate(zip(search_field, search_value)):
                exact = search_exact and i < len(search_exact) and search_exact[i] == "true"
                if "." in sf:
                    json_col, json_key = sf.split(".", 1)
                    if json_col not in col_names or not re.match(r"^[\w.]+$", json_key):
                        return utils.format_response(data=[], status_code=400, reason="invalid_field")
                    expr = f"CAST(JSON_EXTRACT(`{json_col}`, '$.{json_key}') AS CHAR)"
                    conditions.append(f"{expr} = %s" if exact else f"{expr} LIKE %s")
                elif sf not in col_names:
                    return utils.format_response(data=[], status_code=400, reason="invalid_field")
                else:
                    # Skip CAST on native text columns — it's redundant and blocks index use
                    col_expr = f"`{sf}`" if col_types[sf] in _TEXT_TYPES else f"CAST(`{sf}` AS CHAR)"
                    conditions.append(f"{col_expr} = %s" if exact else f"{col_expr} LIKE %s")
                params.append(sv if exact else f"%{sv}%")
            where_clause = " AND ".join(conditions)
        else:
            plain = search_value[0] if search_value else ""
            # Numeric/date columns can never match a text pattern, so skip them
            searchable = [col for col, dtype in col_types.items() if dtype in _TEXT_TYPES] or list(col_names)
            where_clause = " OR ".join(f"`{col}` LIKE %s" for col in searchable)
            params = [f"%{plain}%"] * len(searchable)

        params.extend([limit, offset])
        query = f"SELECT * FROM `{table_name}` WHERE {where_clause} LIMIT %s OFFSET %s"

        rows, breach_info = await asyncio.gather(
            database.fetch_all(query, tuple(params), database=breach_database),
            database.fetch_one(
                "SELECT id, name, threat_actor, date_added, record_count FROM breaches WHERE LOWER(table_name) = %s",
                (table_name,),
                database=breach_database
            )
        )

        def parse_extra(row):
            extra = row.get("extra")
            if extra and isinstance(extra, str):
                try:
                    row["extra"] = ast.literal_eval(extra)
                except Exception:
                    pass
            return row

        breach_meta = utils.clean_json(dict(breach_info)) if breach_info else {"name": table_name}
        entries = utils.clean_json([parse_extra(dict(row)) for row in rows])
        return utils.format_response(data={"breach_data": breach_meta, "entries": entries})

    except Exception:
        traceback.print_exc()
        return utils.format_response(status_code=500, reason="server_error")


async def _pull_stats_data_from_db():
    breach_database = config.get_config_value("database.breaches_db")
    try:
        return sum([(await database.fetch_one(f"select count(*) from {breach}", database=breach_database))['count(*)'] for breach in [table['table_name'] for table in await database.fetch_all("select table_name from breaches", database=breach_database)]])
    except Exception as error:
        print(error)
        pass

async def pull_stats_data(request:Request):
    breach_database = config.get_config_value("database.breaches_db")
    try:
        auth_token = request.headers.get("api-key")
        verified = await auth.verify_auth_role(auth_token)    
        if verified[0]!=True: return verified[1] 
        record = await _pull_stats_data_from_db()
        breaches = await database.fetch_one("select count(*) from breaches",database=breach_database)
        stats={"total_entries":record,"breaches":breaches['count(*)']}
        return utils.format_response(data=stats)
    except Exception as error:
        return utils.format_response(status_code=500, reason="server_error")

async def pull_breaches(request:Request):
    breach_database = config.get_config_value("database.breaches_db")
    try:
        auth_token = request.headers.get("api-key")
        verified = await auth.verify_auth_role(auth_token)    
        if verified[0]!=True: return verified[1] 
        query = "SELECT id, name, threat_actor, date_added, record_count, ingested, type FROM breaches;"
        rows = await database.fetch_all(query, database=breach_database)
        return utils.format_response(data=utils.clean_json(rows))
    except Exception as error:
        print(error)
        traceback.print_exc()
        return utils.format_response(data={}, status_code=500, reason="server_error")

async def update_breach(request:Request):
    try:
        breach_database = config.get_config_value("database.breaches_db")
        auth_token = request.headers.get("api-key")
        request_data = await request.json()
        required_role = 3
        verified = await auth.verify_auth_role(auth_token)    
        if verified[0]!=True: return verified[1] 
        if verified[2]<required_role: return verified[1] 
        update_fields = []
        params = []
        for item in request_data['fields']:
            update_fields.append(f"`{item}` = %s")
            params.append(request_data['fields'][item])
        update_statement = f"""UPDATE breaches SET {', '.join(update_fields)} WHERE id = %s"""
        print(update_statement,(*params,request_data['id']))
        await database.execute(update_statement,(*params,request_data['id']),database=breach_database)
        return utils.format_response(data={"answer":"updated table"})
    except Exception as error:
        print(error)
        traceback.print_exc()
        return utils.format_response(status_code=500,reason="server_error")