from sqlmodel import SQLModel, create_engine
import os 

db_username = os.getenv('POSTGRES_USERNAME')
db_password = os.getenv('POSTGRES_PASSWORD')
db_host = os.getenv('POSTGRES_HOST')
db_name = os.getenv('POSTGRES_DB')


db_url = f"postgresql://{db_username}:{db_password}@{db_host}/{db_name}"

engine = create_engine(db_url)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)