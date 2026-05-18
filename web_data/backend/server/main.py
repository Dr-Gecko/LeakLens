from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import functions.helpers.utils as utils

from routes.authRoutes import router as authRouter
from routes.leakRouter import router as leakRouter
from routes.utilsRoutes import router as utilRouter

app = FastAPI(docs_url=None, redoc_url=None)
app.openapi = lambda: utils.custom_openapi(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(authRouter)
app.include_router(leakRouter)
app.include_router(utilRouter)