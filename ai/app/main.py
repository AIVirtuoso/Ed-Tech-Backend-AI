from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .dependencies.auth import ShepherdHeaderMiddleware
from .routers import conversations, maths
from .db.database import create_db_and_tables
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv()) 

app = FastAPI()

origins = [
   "https://dev--shepherd-tutors.netlify.app",
   "http://localhost:3000",
   "http://localhost:3001"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ShepherdHeaderMiddleware)

app.include_router(conversations.router)
app.include_router(maths.router)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    
@app.get("/")
async def root():
    return {"message": "Hello World"}