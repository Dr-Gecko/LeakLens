import functions.helpers.database as database
from fastapi import UploadFile, File
import functions.auth as auth
import functions.helpers.utils as utils
import uuid
import os

async def updateAvatar(request, authToken, uploadedFile : UploadFile):
    verified = await auth.verifyAuthRole(authToken)      
    if verified[0]!=True: 
        return verified[1] 
    with open(f"/app/avatars/{verified[1]}{os.path.splitext(uploadedFile.filename)[1]}", "wb") as buffer:
        buffer.write(await uploadedFile.read())
    buffer.close()
    public_path = f"/static/avatars/useruploaded/{verified[1]}{os.path.splitext(uploadedFile.filename)[1]}"
    await auth._updateUserColumn(verified[3], "user_avatar_path", public_path)
    return utils.formatResponse({"avatar_path": public_path})