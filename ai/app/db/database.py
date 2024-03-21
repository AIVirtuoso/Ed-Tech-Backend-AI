from sqlmodel import SQLModel, create_engine
from sqlalchemy.pool import NullPool

# from . import models
import os 
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv()) 

db_username = os.environ.get('POSTGRES_USERNAME')
db_password = os.getenv('POSTGRES_PASSWORD')
db_host = os.getenv('POSTGRES_HOST')
db_name = os.getenv('POSTGRES_DATABASE')

print("DB USERNAME", db_username)

db_url = f"postgresql://{db_username}:{db_password}@{db_host}:5432/{db_name}"
print(db_url)
engine = create_engine(db_url, echo=True)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)