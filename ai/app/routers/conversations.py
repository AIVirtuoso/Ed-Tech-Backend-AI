from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session
from enum import Enum
from ..db.database import engine
from ..db.models import Conversations
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
  

@router.post("/")
async def create_conversation(body: ConversationModel):
    with Session(engine) as session:
        conversation = Conversations(referenceId=body.referenceId, reference="student", topic=body.topic, subject=body.subject, language=body.language)
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
        return {"data": conversation.id}




