import traceback
from fastapi import Request
import functions.auth as auth
import functions.helpers.utils as utils
import functions.helpers.database as database
from functions.helpers import config as config


async def get_notes(request: Request, source_table: str, source_id: int):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        rows = await database.fetch_all(
            "SELECT id, note, created_by, created_at FROM entry_notes "
            "WHERE source_table = %s AND source_id = %s ORDER BY created_at DESC",
            (source_table, source_id), database=db
        )
        notes = utils.clean_json([dict(r) for r in rows])
        return utils.api_response(message="notes retrieved", data=notes, meta={"count": len(notes), "source_table": source_table, "source_id": source_id})
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def add_note(request: Request):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        body = await request.json()
        note = body.get("note", "").strip()
        if not note:
            return utils.api_response(message="note cannot be empty", status_code=400, error={"code": "EMPTY_NOTE"})
        await database.execute(
            "INSERT INTO entry_notes (source_table, source_id, note, created_by) VALUES (%s, %s, %s, %s)",
            params=(body["source_table"], int(body["source_id"]), note, verified[1]),
            database=db
        )
        return utils.api_response(message="note saved", data={"saved": True, "source_table": body["source_table"], "source_id": int(body["source_id"]), "created_by": verified[1]})
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def delete_note(request: Request, note_id: int):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        await database.execute(
            "DELETE FROM entry_notes WHERE id = %s", params=(note_id,), database=db
        )
        return utils.api_response(message="note deleted", data={"id": note_id})
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def get_links(request: Request, source_table: str, source_id: int):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        rows = await database.fetch_all(
            "SELECT id, source_table, source_id, target_table, target_id, link_type, created_by, created_at "
            "FROM entry_links "
            "WHERE (source_table = %s AND source_id = %s) OR (target_table = %s AND target_id = %s) "
            "ORDER BY created_at DESC",
            (source_table, source_id, source_table, source_id), database=db
        )
        links = utils.clean_json([dict(r) for r in rows])
        return utils.api_response(message="links retrieved", data=links, meta={"count": len(links), "source_table": source_table, "source_id": source_id})
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def add_link(request: Request):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        body = await request.json()
        await database.execute(
            "INSERT INTO entry_links (source_table, source_id, target_table, target_id, link_type, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            params=(
                body["source_table"], int(body["source_id"]),
                body["target_table"], int(body["target_id"]),
                body.get("link_type", "related"), verified[1]
            ),
            database=db
        )
        return utils.api_response(
            message="link created",
            data={
                "linked": True,
                "source_table": body["source_table"],
                "source_id": int(body["source_id"]),
                "target_table": body["target_table"],
                "target_id": int(body["target_id"]),
                "link_type": body.get("link_type", "related"),
            }
        )
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def search_notes(request: Request, note_text: str):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        pattern = "%" if note_text.strip() == "*" else f"%{note_text}%"
        rows = await database.fetch_all(
            "SELECT DISTINCT source_table, source_id FROM entry_notes WHERE note LIKE %s ORDER BY source_table, source_id",
            (pattern,), database=db
        )
        results = utils.clean_json([dict(r) for r in rows])
        return utils.api_response(message="note search results", data=results, meta={"count": len(results), "query": note_text})
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def delete_link(request: Request, link_id: int):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if verified[0] != True: return verified[1]
        db = config.get_config_value("database.breaches_db")
        await database.execute(
            "DELETE FROM entry_links WHERE id = %s", params=(link_id,), database=db
        )
        return utils.api_response(message="link deleted", data={"id": link_id})
    except Exception:
        traceback.print_exc()
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})
