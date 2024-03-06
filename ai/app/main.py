from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .dependencies.auth import check_shepherd_header
from .routers import items

app = FastAPI(depends=[Depends(check_shepherd_header)])

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}