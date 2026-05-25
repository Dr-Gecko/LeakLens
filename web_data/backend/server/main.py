from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import functions.helpers.utils as utils

from routes.auth_routes import router as auth_router
from routes.breaches_routes import router as breach_router
from routes.server_routes import router as server_router
app = FastAPI(docs_url=None, redoc_url=None)
app.openapi = lambda: utils.custom_openapi(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(breach_router)
app.include_router(server_router)
