from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from enum import Enum
from ..db.database import engine
from ..db.models import Conversations, ConversationLogs
from ..helpers.generic import wrap_for_ql
from uuid import UUID

router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
    responses={404: {"description": "Not found"}},
)

class Languages(Enum):
    ENGLISH = "English"
    SPANISH = "Spanish"
    FRENCH = "French"
    MANDARIN = "Mandarin"
    PORTUGUESE = "Portuguese"
    UKRANIAN = "Ukranian"
    ARABIC = "Arabic"
    HINDI = "Hindi"
    GERMAN = "German"
    ITALIAN = "Italian"
    TURKISH = "Turkish"
    VIETNAMESE = "Vietnamese"
    SWAHILI = "Swahili"
    POLISH = "Polish"

class ConversationModel(BaseModel):
    referenceId: str
    topic: str
    subject: str
    level: str
    language: Languages

class StudentConversation(BaseModel):
    studentId: str
    query: str
    conversationId: str
    

@router.post("/")
async def create_conversation(body: ConversationModel):
    print(body)
    with Session(engine) as session:
        conversation = Conversations(referenceId=body.referenceId, reference="student", topic=body.topic, subject=body.subject, language=body.language)
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
        return {"data": conversation.id}
    
@router.get("/title")
async def get_title(id: str):
    with Session(engine) as session:
        statement = select(Conversations).where(Conversations.id == id)  
        results = session.exec(statement)  
        convo = results.one()
        return {"data": convo.title}
    

@router.post("/conversation-log")
async def create_convo_log(body: StudentConversation):
    print(body)
    assistant_message = wrap_for_ql('assistant', body.query, False)
    with Session(engine) as session:
          bot_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=assistant_message)
          session.add(bot_message)
          session.commit()
          return {"data": bot_message}
    



