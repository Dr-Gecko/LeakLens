from fastapi import Request
from functions.helpers import utils
from functions.helpers import config as config


async def printconfig():
    return config.loadConfig()

async def editConfig(request:Request):
    try:
        configData = config.loadConfig()
        requestData = await request.json()
        configData[requestData['parent']][requestData['child']] = requestData['data']
        config.saveConfig(configData)
        return utils.formatResponse(reason="Updated config")
    except Exception as error:
        return False