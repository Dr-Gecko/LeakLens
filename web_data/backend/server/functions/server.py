from fastapi import Request
from functions.helpers import utils
from functions.helpers import config as config


async def printconfig():
    return config.load_config()

async def edit_config(request:Request):
    try:
        config_data = config.load_config()
        request_data = await request.json()
        config_data[request_data['parent']][request_data['child']] = request_data['data']
        config.save_config(config_data)
        return utils.format_response(reason="Updated config")
    except Exception as error:
        return False
