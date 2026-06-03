import functions.workers as workers
from fastapi import APIRouter, Request

router = APIRouter(prefix="/workers")


@router.get("/scripts")
async def list_scripts(request: Request):
    return await workers.list_scripts(request)


@router.get("/scripts/{worker}/args")
async def get_script_args(request: Request, worker: str):
    return await workers.get_script_args(request, worker)


@router.post("/start")
async def start_worker(request: Request):
    return await workers.start_worker(request)


@router.get("/")
async def list_workers(request: Request):
    return await workers.list_workers(request)


@router.get("/{worker_id}/status")
async def get_worker_status(request: Request, worker_id: str):
    return await workers.get_worker_status(request, worker_id)


@router.get("/{worker_id}/logs")
async def get_worker_logs(request: Request, worker_id: str):
    return await workers.get_worker_logs(request, worker_id)


@router.post("/{worker_id}/stop")
async def stop_worker(request: Request, worker_id: str):
    return await workers.stop_worker(request, worker_id)
