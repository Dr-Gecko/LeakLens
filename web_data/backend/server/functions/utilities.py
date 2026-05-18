import functions.helpers.database as database
from fastapi import UploadFile, File
import functions.auth as auth
import uuid
import os

async def updateAvatar(request, authToken, uploadedFile : UploadFile):
    verified = await auth.verifyAuthRole(authToken)      
    if verified[0]!=True: 
        return verified[1] 
    with open(f"/app/avatars/{uploadedFile.filename}", "wb") as buffer:
        buffer.write(await uploadedFile.read())
    buffer.close()
    await auth._updateUserColumn(verified[3],"user_avatar_path",f"/static/avatars/useruploaded/{uploadedFile.filename}")
    return {
        "status": "success",
    }