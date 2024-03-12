from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from enum import Enum
import os 
import requests
from xml.etree import ElementTree as ET
from typing import List, Optional, Dict, Union
from urllib.parse import quote
from ..dependencies.fermata import get_aitutor_chat_balance
from ..dependencies.check_subscription import ShepherdSubscriptionMiddleware

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

class StudentConversation(BaseModel):
    studentId: str
    topic: str
    subject: str
    query: str
    name: str
    level: str
    conversationId: str
    documentId: str
    firebaseId: str
    language: Languages
    messages: List[Dict[str, Union[Optional[str], str]]]

router = APIRouter(
    prefix="/maths",
    tags=["maths"],
    responses={404: {"description": "Not found"}}
)


def stream_chunks(text: str, chunk_size: int = 50):
    """Generator function to chunk text into smaller parts."""
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]
        
def get_wolfram_solution(equation: str) -> str:
  """function to get the XML result from wolfram and return the needed text."""
  encoded_eqn = quote(equation)
  APP_ID = os.environ.get("WOLFRAM_KEY")
  print("ss",APP_ID)
  print(encoded_eqn)
  url = f"http://api.wolframalpha.com/v2/query?appid={APP_ID}&input={equation}&podstate=Result__Step-by-step+solution&format=plaintext"
  response = requests.get(url)
  print(response.status_code)
  if response.status_code == 200:
    print(response.content)
    # Parse the XML response
    data = ET.fromstring(response.content)
    print('DD', data)
    solution_pod = data.find('.//subpod[@title="Possible intermediate steps"]/plaintext')
 
    if solution_pod is not None:
      solution_text = solution_pod.text
      return solution_text if solution_text else "No solution found."
    else:
      raise HTTPException(status_code=400, detail="Solution pod not found in response")
  else:
    raise HTTPException(status_code=400, detail=f"Error fetching: {response.status_code}")
@router.post("/")
async def wolfram_maths_response(body: StudentConversation): 
    print(body)
    text = get_wolfram_solution(body.query)
    print("WOLFIE")
    print(text)
    print("The variable 'text' is a string." if isinstance(text, str) else "The variable 'text' is not a string.")
    return StreamingResponse(stream_chunks(text))
