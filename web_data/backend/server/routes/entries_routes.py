import functions.entries as entries
from fastapi import APIRouter, Request

router = APIRouter(prefix="/entries", tags=["Leaklens"])


@router.get("/notes/search")
async def search_notes(request: Request, note_text: str):
    return await entries.search_notes(request, note_text)

@router.get("/notes")
async def get_notes(request: Request, source_table: str, source_id: int):
    return await entries.get_notes(request, source_table, source_id)

@router.post("/notes")
async def add_note(request: Request):
    return await entries.add_note(request)

@router.delete("/notes/{note_id}")
async def delete_note(request: Request, note_id: int):
    return await entries.delete_note(request, note_id)


@router.get("/links")
async def get_links(request: Request, source_table: str, source_id: int):
    return await entries.get_links(request, source_table, source_id)

@router.post("/links")
async def add_link(request: Request):
    return await entries.add_link(request)

@router.delete("/links/{link_id}")
async def delete_link(request: Request, link_id: int):
    return await entries.delete_link(request, link_id)
