from pathlib import Path
from typing import Any
import subprocess
import asyncio
import datetime
import uuid
import os
import signal
import ast as _ast
from fastapi import Request
import functions.auth as auth
import functions.helpers.utils as utils

BASE_DIR = Path(__file__).resolve().parent.parent
WORKER_DIR = BASE_DIR / "workers"
LOG_DIR = Path("/tmp/leaklense_workers")
LOG_DIR.mkdir(parents=True, exist_ok=True)

running_workers: dict = {}


def _build_command(worker_path: Path, args: dict[str, Any]) -> list[str]:
    command = ["python3", str(worker_path)]
    for key, value in args.items():
        key = key.replace("_", "-")
        if isinstance(value, bool):
            if value:
                command.append(f"--{key}")
        elif isinstance(value, list):
            for item in value:
                command.extend([f"--{key}", str(item)])
        else:
            command.extend([f"--{key}", str(value)])
    return command


def _poll_state(process) -> tuple[str, int | None]:
    exit_code = process.poll()
    if exit_code is None:
        return "running", None
    return ("completed" if exit_code == 0 else "failed"), exit_code


def _worker_dict(worker_id: str, worker: dict, state: str, exit_code: int | None) -> dict:
    return {
        "worker_id": worker_id,
        "name": worker["name"],
        "worker": worker["worker"],
        "pid": worker["process"].pid,
        "state": state,
        "exit_code": exit_code,
        "spawned_by": worker["spawned_by"],
        "spawned_at": worker["spawned_at"],
        "command": worker["command"],
    }


def _parse_script_args(script_path: Path) -> list[dict]:
    try:
        tree = _ast.parse(script_path.read_text())
    except Exception:
        return []

    result = []
    for node in _ast.walk(tree):
        if not isinstance(node, _ast.Call):
            continue
        func = node.func
        if not (
            (isinstance(func, _ast.Attribute) and func.attr == "add_argument") or
            (isinstance(func, _ast.Name) and func.id == "add_argument")
        ):
            continue

        flags = [a.value for a in node.args if isinstance(a, _ast.Constant) and isinstance(a.value, str)]
        if not flags:
            continue

        long_flags = [f for f in flags if f.startswith("--")]
        canonical = (long_flags[0] if long_flags else flags[0]).lstrip("-").replace("-", "_")
        is_positional = not flags[0].startswith("-")

        kw_keys = {kw.arg for kw in node.keywords}
        spec = {
            "name": canonical,
            "flags": flags,
            "help": "",
            "type": "str",
            "required": is_positional or ("default" not in kw_keys and "required" not in kw_keys),
            "default": "",
        }

        for kw in node.keywords:
            if kw.arg == "help" and isinstance(kw.value, _ast.Constant):
                spec["help"] = kw.value.value
            elif kw.arg == "default" and isinstance(kw.value, _ast.Constant):
                spec["default"] = str(kw.value.value)
                spec["required"] = False
            elif kw.arg == "required" and isinstance(kw.value, _ast.Constant):
                spec["required"] = bool(kw.value.value)
            elif kw.arg == "type" and isinstance(kw.value, _ast.Name):
                spec["type"] = kw.value.id
            elif kw.arg == "action" and isinstance(kw.value, _ast.Constant):
                if kw.value.value in ("store_true", "store_false"):
                    spec["type"] = "bool"
                    spec["required"] = False

        result.append(spec)
    return result


async def list_scripts(request: Request):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        scripts = sorted(p.name for p in WORKER_DIR.glob("*.py"))
        return utils.api_response(message="scripts retrieved", data=scripts, meta={"count": len(scripts)})
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def get_script_args(request: Request, worker: str):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        worker_path = WORKER_DIR / worker
        if not worker_path.exists():
            return utils.api_response(message="worker not found", status_code=404, error={"code": "WORKER_NOT_FOUND", "worker": worker})
        args = await asyncio.to_thread(_parse_script_args, worker_path)
        return utils.api_response(message="script args retrieved", data=args, meta={"worker": worker, "count": len(args)})
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def start_worker(request: Request):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        body = await request.json()
        worker = body["worker"]
        name = body.get("name", worker)
        args = body.get("args", {})
        worker_path = WORKER_DIR / worker
        if not worker_path.exists():
            return utils.api_response(message="worker not found", status_code=404, error={"code": "WORKER_NOT_FOUND", "worker": worker})
        if worker_path.suffix != ".py":
            return utils.api_response(message="invalid worker type", status_code=400, error={"code": "INVALID_WORKER_TYPE", "worker": worker})
        worker_id = str(uuid.uuid4())
        log_path = LOG_DIR / f"{worker_id}.log"
        command = _build_command(worker_path, args)
        def _spawn():
            log_file = open(log_path, "w")
            return subprocess.Popen(
                command,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                cwd=str(BASE_DIR),
                env=os.environ.copy(),
            )
        process = await asyncio.to_thread(_spawn)
        running_workers[worker_id] = {
            "process": process,
            "name": name,
            "worker": worker,
            "log_path": str(log_path),
            "command": command,
            "spawned_by": verified[1],
            "spawned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        return utils.api_response(message="worker started", data=_worker_dict(worker_id, running_workers[worker_id], "running", None))
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def get_worker_status(request: Request, worker_id: str):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        worker = running_workers.get(worker_id)
        if not worker:
            return utils.api_response(message="worker not found", status_code=404, error={"code": "WORKER_NOT_FOUND", "worker_id": worker_id})
        state, exit_code = _poll_state(worker["process"])
        if state != "running":
            running_workers.pop(worker_id, None)
        return utils.api_response(message="worker status retrieved", data=_worker_dict(worker_id, worker, state, exit_code))
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def get_worker_logs(request: Request, worker_id: str):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        worker = running_workers.get(worker_id)
        if not worker:
            return utils.api_response(message="worker not found", status_code=404, error={"code": "WORKER_NOT_FOUND", "worker_id": worker_id})
        logs = await asyncio.to_thread(Path(worker["log_path"]).read_text)
        return utils.api_response(message="worker logs retrieved", data={"worker_id": worker_id, "logs": logs})
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def stop_worker(request: Request, worker_id: str):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        worker = running_workers.get(worker_id)
        if not worker:
            return utils.api_response(message="worker not found", status_code=404, error={"code": "WORKER_NOT_FOUND", "worker_id": worker_id})
        process = worker["process"]
        if process.poll() is None:
            process.send_signal(signal.SIGTERM)
            state = "stopping"
        else:
            state = "already_stopped"
        return utils.api_response(message="worker stop signal sent", data={"worker_id": worker_id, "state": state})
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})


async def list_workers(request: Request):
    try:
        verified = await auth.verify_auth_role(request.headers.get("api-key"))
        if not verified[0]: return verified[1]
        result = []
        for worker_id, worker in running_workers.items():
            state, exit_code = _poll_state(worker["process"])
            result.append(_worker_dict(worker_id, worker, state, exit_code))
        return utils.api_response(message="workers listed", data=result, meta={"count": len(result)})
    except Exception:
        return utils.api_response(message="server error", status_code=500, error={"code": "INTERNAL_ERROR"})
