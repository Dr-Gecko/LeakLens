import os
import time
import argon2
import datetime
import traceback
from uuid import uuid4
from base64 import b64encode
from fastapi import UploadFile
from argon2 import PasswordHasher
from fastapi import status,Request
import functions.helpers.utils as utils
import functions.helpers.database as database
import mysql.connector.errors as msqlerrors


async def createUser(request:Request):
    try:
        jsonData = await request.json()
        username = jsonData['username']
        password = jsonData['password']
        requestIP = request.headers.get("X-Forwarded-For") or request.client.host
        passwordHasher = PasswordHasher()
        passwordHash = passwordHasher.hash(password)
        user_count = await database.fetch_all("select count(*) from users")
        if int(user_count['count(*)']) < 1:
            rbac_id=4
            user_title="owner"
        else:
            rbac_id=0
            user_title="user"
        user_insert_affected = await database.execute("INSERT INTO users (username, hash, role, rbac_id, user_avatar_path, last_login_ip) VALUES (%s, %s, %s, %s, %s, %s);", (username, passwordHash, user_title, rbac_id, "/dist/img/default.png",requestIP))
        if user_insert_affected==1: return utils.formatResponse(reason=f"created user {username}")
        else: return utils.formatResponse(reason="failed to create user",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except msqlerrors.IntegrityError as error: 
        if error.errno == 1062: return utils.formatResponse(reason="username already exists",status_code=status.HTTP_409_CONFLICT)
    except Exception as error: 
        print(error)
        print(traceback.format_exc())
        return utils.formatResponse(reason="failed to create user",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def loginUser(request:Request):
    try:
        jsonData = await request.json()
        username = jsonData['username']
        password = jsonData['password']
        requestIP = request.headers.get("X-Forwarded-For") or request.client.host
        passwordHasher=PasswordHasher()
        userData = await database.fetch_one("SELECT hash FROM users WHERE username = %s",(username,))
        passwordHash=userData.get("hash")
        if passwordHasher.verify(passwordHash,password):
            authToken = b64encode(bytes(str(uuid4()),'utf-8')).decode('utf-8')
            expireDateTime = datetime.datetime.now() + datetime.timedelta(days=1)
            expireTime = expireDateTime.strftime('%Y-%m-%d %H:%M:%S')
            updateUserRows = await database.execute("UPDATE users SET auth_token = %s, last_login_ip = %s, auth_token_expire = %s WHERE username  = %s;",(authToken,requestIP,expireTime,username))
            if updateUserRows > 0:
                userResponseData = await database.fetch_one("SELECT user_id,username,role as user_role, user_avatar_path as avatar FROM users WHERE username = %s;",(username,))
                return utils.formatResponse(reason="logged in successfully",data={"token":authToken,"expire_time":expireTime,"user_data":userResponseData})
    except argon2.exceptions.VerifyMismatchError: return utils.formatResponse(reason="incorrect username or password",status_code=status.HTTP_401_UNAUTHORIZED)
    except AttributeError: return utils.formatResponse(reason="incorrect username or password",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return utils.formatResponse(reason="failed to login user",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def verifyAuthRole(authToken):
    try:
        authTokenData = await database.fetch_one("SELECT auth_token_expire, username, rbac_id, user_id FROM users WHERE auth_token = %s",params=(authToken,))
        if authTokenData['auth_token_expire'].timestamp()>=time.time(): return True, authTokenData['username'], authTokenData['rbac_id'], authTokenData['user_id']
        else: return False, utils.formatResponse(reason="API Key Expired",status_code=status.HTTP_401_UNAUTHORIZED)
    except TypeError: return False,utils.formatResponse(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return False,utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def _updateUserColumn(userID, column, data):
    query=f"UPDATE users SET `{column}` = %s WHERE user_id = %s"
    affectedRows = await database.execute(query,(data, userID))
    if affectedRows > 0: return True 
    else: return False
   
async def selfUpdate(request:Request):
    try:
        jsonData = await request.json()
        auth_token = request.headers.get("api-key")
        verified_user = await verifyAuthRole(auth_token)      
        userToEdit = verified_user[1]
        columnToEdit = jsonData['update']
        newData = jsonData['data']
        if verified_user[0]!=True: return verified_user[1]         
        requiredRole, allowedColumns = (0, utils.allowedSelfEditColumns) if userToEdit == verified_user[1] else (2, utils.allowedManagerEditColumns)        
        if verified_user[2] < requiredRole: return utils.formatResponse(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        if columnToEdit not in allowedColumns: return utils.formatResponse(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        if columnToEdit=="password":
            passwordHasher = PasswordHasher()
            passwordHash = passwordHasher.hash(newData)
            newData=passwordHash
            columnToEdit="hash"   
        updatedAffectedRows = await database.execute(f"UPDATE users SET `{columnToEdit}` = %s WHERE user_id = %s;", (newData, verified_user[3]))
        if updatedAffectedRows > 0: return utils.formatResponse(reason=f"successfully updated colum: {columnToEdit} for user: {userToEdit}")
        else: return utils.formatResponse(reason="internal error",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except TypeError: return utils.formatResponse(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception as error: 
        print(error)
        return utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)   
    
async def updateUser(request:Request):
    try:
        jsonData = await request.json()
        auth_token = request.headers.get("api-key")
        verified_user = await verifyAuthRole(auth_token)      
        userToEdit = jsonData['user']
        columnToEdit = jsonData['column']
        newData = jsonData['data']
        if verified_user[0]!=True: return verified_user[1]
        requiredRole, allowedColumns = (0, utils.allowedSelfEditColumns) if userToEdit == verified_user[1] else (2, utils.allowedManagerEditColumns)        
        if verified_user[2] < requiredRole: return utils.formatResponse(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        if columnToEdit not in allowedColumns: return utils.formatResponse(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        updatedAffectedRows = await database.execute(f"UPDATE users SET `{columnToEdit}` = %s WHERE username = %s;", (newData, userToEdit))
        if updatedAffectedRows > 0: return utils.formatResponse(reason=f"successfully updated colum: {columnToEdit} for user: {userToEdit}")
        else: return utils.formatResponse(reason="internal error",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except TypeError: return utils.formatResponse(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def getUserInfo(request:Request):
    try:
        requiredRole = 0
        auth_token = request.headers.get("api-key")
        verified_user = await verifyAuthRole(auth_token)
        if verified_user[0]!=True: return verified_user[1]
        if verified_user[2] < requiredRole: return utils.formatResponse(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        userInfo = await database.fetch_one("SELECT username, user_id, role, user_avatar_path FROM users WHERE user_id = %s",(verified_user[3],))
        return utils.formatResponse({"user_info":userInfo})
    except TypeError: return utils.formatResponse(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: 
        return utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def getUsersPublic(request:Request):
    try:
        allUsers = []
        requiredRole = 0
        auth_token = request.headers.get("api-key")
        verified_user = await verifyAuthRole(auth_token)
        if verified_user[0]!=True: return verified_user[1]
        if verified_user[2] < requiredRole: return utils.formatResponse(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        userCount = await database.fetch_one("select count(username) as count from users;")
        allUsers = await database.fetch_all("select user_id, username, role, user_avatar_path from users")
        return utils.formatResponse({"count":userCount['count'],"users":allUsers})
    except TypeError: return utils.formatResponse(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return utils.formatResponse(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def deleteUser(request:Request):
    try:
        required_role = 3
        jsonData = await request.json()
        auth_token = request.headers.get("api-key")
        verified = await verifyAuthRole(auth_token)   
        userToDelete = jsonData['user']
        if verified[0]!=True:
            return False,utils.formatResponse({"response":"API key invalid"},status_code=status.HTTP_401_UNAUTHORIZED)
        if verified[2]<required_role:
            return False,utils.format_rformatResponseesponse({"response":"invalid permissions"},status_code=status.HTTP_401_UNAUTHORIZED)
        affected_rows=await database.execute("DELETE FROM users WHERE username = %s;",(userToDelete,))
        if affected_rows > 0:
            return utils.formatResponse({"response":f"deleted {userToDelete}"})
        else:
            return utils.formatResponse({"response":"internal error"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except TypeError:
        return False,utils.formatResponse({"response":"API key invalid"},status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception as error:
        return False,utils.formatResponse({"response":"failed"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def updateAvatar(request:Request, uploadedFile : UploadFile):
    try:
        auth_token = request.headers.get("api-key")
        verified = await verifyAuthRole(auth_token)      
        if verified[0]!=True: 
            return verified[1] 
        with open(f"/app/avatars/{verified[1]}{os.path.splitext(uploadedFile.filename)[1]}", "wb") as buffer:
            buffer.write(await uploadedFile.read())
        buffer.close()
        public_path = f"/static/avatars/useruploaded/{verified[1]}{os.path.splitext(uploadedFile.filename)[1]}"
        await _updateUserColumn(verified[3], "user_avatar_path", public_path)
        return utils.formatResponse({"avatar_path": public_path})
    except TypeError:
        return False,utils.formatResponse({"response":"API key invalid"},status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception as error:
        return False,utils.formatResponse({"response":"failed"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        