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


async def create_user(request:Request):
    try:
        
        json_data = await request.json()
        username = json_data['username']
        password = json_data['password']
        request_ip = request.headers.get("X-Forwarded-For") or request.client.host
        password_hasher = PasswordHasher()
        password_hash = password_hasher.hash(password)
        user_count = await database.fetch_one("select count(*) from users")
        if int(user_count['count(*)']) < 1:
            rbac_id=4
            user_title="owner"
        else:
            rbac_id=0
            user_title="user"
        user_insert_affected = await database.execute("INSERT INTO users (username, hash, role, rbac_id, user_avatar_path, last_login_ip) VALUES (%s, %s, %s, %s, %s, %s);", (username, password_hash, user_title, rbac_id, "/dist/img/default.png",request_ip))
        if user_insert_affected==1: return utils.format_response(reason=f"created user {username}")
        else: return utils.format_response(reason="failed to create user",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except msqlerrors.IntegrityError as error: 
        if error.errno == 1062: return utils.format_response(reason="username already exists",status_code=status.HTTP_409_CONFLICT)
    except Exception as error: 
        print(error)
        print(traceback.format_exc())
        return utils.format_response(reason="failed to create user",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def login_user(request:Request):
    try:
        json_data = await request.json()
        username = json_data['username']
        password = json_data['password']
        request_ip = request.headers.get("X-Forwarded-For") or request.client.host
        password_hasher=PasswordHasher()
        user_data = await database.fetch_one("SELECT hash FROM users WHERE username = %s",(username,))
        password_hash=user_data.get("hash")
        if password_hasher.verify(password_hash,password):
            auth_token = b64encode(bytes(str(uuid4()),'utf-8')).decode('utf-8')
            expire_date_time = datetime.datetime.now() + datetime.timedelta(days=1)
            expire_time = expire_date_time.strftime('%Y-%m-%d %H:%M:%S')
            update_user_rows = await database.execute("UPDATE users SET auth_token = %s, last_login_ip = %s, auth_token_expire = %s WHERE username  = %s;",(auth_token,request_ip,expire_time,username))
            if update_user_rows > 0:
                user_response_data = await database.fetch_one("SELECT user_id,username,role as user_role, user_avatar_path as avatar FROM users WHERE username = %s;",(username,))
                return utils.format_response(reason="logged in successfully",data={"token":auth_token,"expire_time":expire_time,"user_data":user_response_data})
    except argon2.exceptions.VerifyMismatchError: return utils.format_response(reason="incorrect username or password",status_code=status.HTTP_401_UNAUTHORIZED)
    except AttributeError: return utils.format_response(reason="incorrect username or password",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return utils.format_response(reason="failed to login user",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def verify_auth_role(auth_token):
    try:
        auth_token_data = await database.fetch_one("SELECT auth_token_expire, username, rbac_id, user_id FROM users WHERE auth_token = %s",params=(auth_token,))
        if auth_token_data['auth_token_expire'].timestamp()>=time.time(): return True, auth_token_data['username'], auth_token_data['rbac_id'], auth_token_data['user_id']
        else: return False, utils.format_response(reason="API Key Expired",status_code=status.HTTP_401_UNAUTHORIZED)
    except TypeError: return False,utils.format_response(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return False,utils.format_response(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def _update_user_column(user_id, column, data):
    query=f"UPDATE users SET `{column}` = %s WHERE user_id = %s"
    affected_rows = await database.execute(query,(data, user_id))
    if affected_rows > 0: return True 
    else: return False
   
async def self_update(request:Request):
    try:
        json_data = await request.json()
        auth_token = request.headers.get("api-key")
        verified_user = await verify_auth_role(auth_token)      
        user_to_edit = verified_user[1]
        column_to_edit = json_data['update']
        new_data = json_data['data']
        if verified_user[0]!=True: return verified_user[1]         
        required_role, allowed_columns = (0, utils.allowed_self_edit_columns) if user_to_edit == verified_user[1] else (2, utils.allowed_manager_edit_columns)        
        if verified_user[2] < required_role: return utils.format_response(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        if column_to_edit not in allowed_columns: return utils.format_response(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        if column_to_edit=="password":
            password_hasher = PasswordHasher()
            password_hash = password_hasher.hash(new_data)
            new_data=password_hash
            column_to_edit="hash"   
        updated_affected_rows = await database.execute(f"UPDATE users SET `{column_to_edit}` = %s WHERE user_id = %s;", (new_data, verified_user[3]))
        if updated_affected_rows > 0: return utils.format_response(reason=f"successfully updated colum: {column_to_edit} for user: {user_to_edit}")
        else: return utils.format_response(reason="internal error",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except TypeError: return utils.format_response(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception as error: 
        print(error)
        return utils.format_response(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)   
    
async def update_user(request:Request):
    try:
        json_data = await request.json()
        auth_token = request.headers.get("api-key")
        verified_user = await verify_auth_role(auth_token)      
        user_to_edit = json_data['user']
        column_to_edit = json_data['column']
        new_data = json_data['data']
        if verified_user[0]!=True: return verified_user[1]
        required_role, allowed_columns = (0, utils.allowed_self_edit_columns) if user_to_edit == verified_user[1] else (2, utils.allowed_manager_edit_columns)        
        if verified_user[2] < required_role: return utils.format_response(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        if column_to_edit not in allowed_columns: return utils.format_response(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        updated_affected_rows = await database.execute(f"UPDATE users SET `{column_to_edit}` = %s WHERE username = %s;", (new_data, user_to_edit))
        if updated_affected_rows > 0: return utils.format_response(reason=f"successfully updated colum: {column_to_edit} for user: {user_to_edit}")
        else: return utils.format_response(reason="internal error",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except TypeError: return utils.format_response(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return utils.format_response(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def get_user_info(request:Request):
    try:
        required_role = 0
        auth_token = request.headers.get("api-key")
        verified_user = await verify_auth_role(auth_token)
        if verified_user[0]!=True: return verified_user[1]
        if verified_user[2] < required_role: return utils.format_response(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        user_info = await database.fetch_one("SELECT username, user_id, role, user_avatar_path FROM users WHERE user_id = %s",(verified_user[3],))
        return utils.format_response({"user_info":user_info})
    except TypeError: return utils.format_response(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: 
        return utils.format_response(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def get_users_public(request:Request):
    try:
        all_users = []
        required_role = 0
        auth_token = request.headers.get("api-key")
        verified_user = await verify_auth_role(auth_token)
        if verified_user[0]!=True: return verified_user[1]
        if verified_user[2] < required_role: return utils.format_response(reason="invalid permissions",status_code=status.HTTP_401_UNAUTHORIZED)
        user_count = await database.fetch_one("select count(username) as count from users;")
        all_users = await database.fetch_all("select user_id, username, role, user_avatar_path from users")
        return utils.format_response({"count":user_count['count'],"users":all_users})
    except TypeError: return utils.format_response(reason="API key invalid",status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception: return utils.format_response(reason="failed",status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def delete_user(request:Request):
    try:
        required_role = 3
        json_data = await request.json()
        auth_token = request.headers.get("api-key")
        verified = await verify_auth_role(auth_token)
        user_to_delete = json_data['user']
        if verified[0]!=True:
            return False,utils.format_response({"response":"API key invalid"},status_code=status.HTTP_401_UNAUTHORIZED)
        if verified[2]<required_role:
            return False,utils.format_response({"response":"invalid permissions"},status_code=status.HTTP_401_UNAUTHORIZED)
        affected_rows=await database.execute("DELETE FROM users WHERE username = %s;",(user_to_delete,))
        if affected_rows > 0:
            return utils.format_response({"response":f"deleted {user_to_delete}"})
        else:
            return utils.format_response({"response":"internal error"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except TypeError:
        return False,utils.format_response({"response":"API key invalid"},status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception as error:
        return False,utils.format_response({"response":"failed"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def update_avatar(request:Request, uploaded_file : UploadFile):
    try:
        auth_token = request.headers.get("api-key")
        verified = await verify_auth_role(auth_token)
        if verified[0]!=True:
            return verified[1]
        with open(f"/app/avatars/{verified[1]}{os.path.splitext(uploaded_file.filename)[1]}", "wb") as buffer:
            buffer.write(await uploaded_file.read())
        buffer.close()
        public_path = f"/static/avatars/useruploaded/{verified[1]}{os.path.splitext(uploaded_file.filename)[1]}"
        await _update_user_column(verified[3], "user_avatar_path", public_path)
        return utils.format_response({"avatar_path": public_path})
    except TypeError:
        return False,utils.format_response({"response":"API key invalid"},status_code=status.HTTP_401_UNAUTHORIZED)
    except Exception as error:
        return False,utils.format_response({"response":"failed"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        