import docker
from fastapi import Request
from functions.helpers import utils
from functions.auth import verify_auth_role
from functions.helpers import config as config


client = docker.DockerClient(base_url="unix://var/run/docker.sock")

async def return_config():
    return config.load_config()

async def leak_lens_info():
    return utils.api_response(message="LeakLense info", data={"version": config.get_config_value("api.version")})


async def edit_config(request:Request):
    try:
        auth_token = request.headers.get("api-key")
        verified = await verify_auth_role(auth_token)
        if verified[0]!=True: return verified[1]
        config_data = config.load_config()
        request_data = await request.json()
        config_data[request_data['parent']][request_data['child']] = request_data['data']
        config.save_config(config_data)
        return utils.api_response(message="config updated", data={"parent": request_data['parent'], "child": request_data['child'], "value": request_data['data']})
    except Exception as error:
        return False

def get_single_container_stats(name: str):
    try:
        container = client.containers.get(name)
        stats = container.stats(stream=False)
        if container.status == "exited":
            docker_stats = {
            "name": name,
            "status": container.status,
            "memory_usage": 0,
            "memory_limit": 0,
            "memory_percent": 0,
            "cpu_percent": 0,
            "bytes_tx":0,
            "bytes_rx":0
        }
        else:
            memory_used = stats["memory_stats"]["usage"]
            memory_limit = stats["memory_stats"]["limit"]
            bytes_tx=stats["networks"]["eth0"]['tx_bytes']
            bytes_rx=stats["networks"]["eth0"]['rx_bytes']
            memory_percent = round(((memory_used / memory_limit) * 100),2)
            usage_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
            len_cpu = len(stats['cpu_stats']['cpu_usage'])
            cpu_percentage = (usage_delta / system_delta) * len_cpu * 100
            cpu_percent = round(cpu_percentage, 2)
            docker_stats = {
                "name": name,
                "status": container.status,
                "memory_usage": memory_used,
                "memory_limit": memory_limit,
                "memory_percent": memory_percent,
                "cpu_percent": cpu_percent,
                "bytes_tx":bytes_tx,
                "bytes_rx":bytes_rx,
            }
        return docker_stats
    except Exception as error:
        pass
