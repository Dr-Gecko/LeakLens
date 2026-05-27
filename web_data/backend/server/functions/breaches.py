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

async def search_all_columns(request:Request,table_name: str, search_value: list, limit: int = 100, search_field: list = None, offset: int = 0):
    try:
        auth_token = request.headers.get("api-key")
        verified = await auth.verify_auth_role(auth_token)
        if verified[0]!=True: return verified[1]

        breach_database = config.get_config_value("database.breaches_db")
        columns = await database.fetch_all("""SELECT column_name FROM information_schema.columns WHERE table_schema = %s AND table_name = %s """,(breach_database, table_name),database="information_schema")
        if not columns: return utils.format_response(data=[],status_code=404,reason="table_not_found")
        column_names = [row["column_name"] for row in columns]
        if search_field:
            conditions = []
            params = []
            for sf, sv in zip(search_field, search_value):
                if '.' in sf:
                    json_col, json_path_key = sf.split('.', 1)
                    if json_col not in column_names or not re.match(r'^[\w.]+$', json_path_key):
                        return utils.format_response(data=[], status_code=400, reason="invalid_field")
                    conditions.append(f"CAST(JSON_EXTRACT(`{json_col}`, '$.{json_path_key}') AS CHAR) LIKE %s")
                elif sf not in column_names:
                    return utils.format_response(data=[],status_code=400,reason="invalid_field")
                else:
                    conditions.append(f"CAST(`{sf}` AS CHAR) LIKE %s")
                params.append(f"%{sv}%")
            where_clause = " AND ".join(conditions)
        else:
            plain = search_value[0] if search_value else ""
            where_clause = " OR ".join([f"CAST(`{col}` AS CHAR) LIKE %s" for col in column_names])
            params = [f"%{plain}%"] * len(column_names)
        params.extend([limit, offset])
        query = f"""SELECT * FROM `{table_name}` WHERE {where_clause} LIMIT %s OFFSET %s"""
        rows, breach_info = await asyncio.gather(database.fetch_all(query, tuple(params), database=breach_database), database.fetch_one("SELECT id, name, threat_actor, date_added, record_count FROM breaches WHERE LOWER(table_name) = %s",(table_name,),database=breach_database))
        def parse_extra(row):
            extra = row.get("extra")
            if extra and isinstance(extra, str):
                try:
                    row["extra"] = ast.literal_eval(extra)
                except Exception:
                    pass
            return row
        breach_meta = utils.clean_json(dict(breach_info)) if breach_info else {"name": table_name}
        return utils.format_response(data={"breach_data": breach_meta, "entries": utils.clean_json([parse_extra(dict(row)) for row in rows])})
    except Exception as error: 
        traceback.print_exc()
        return utils.format_response(status_code=500,reason="server_error")


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