from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from enum import Enum
import json
from xml.etree import ElementTree as ET
from typing import List, Optional, Dict, Union
from urllib.parse import quote
from ..dependencies.fermata import get_aitutor_chat_balance
from ..dependencies.check_subscription import ShepherdSubscriptionMiddleware
from ..helpers.openai import open_ai, steps_agent, sys_prompt
from ..helpers.wolfram import call_wolfram

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
    current_msg: str

router = APIRouter(
    prefix="/maths",
    tags=["maths"],
    responses={404: {"description": "Not found"}}
)


def stream_openai_chunks(chunks: str):
    """Generator function to stream openai chunks"""
    for chunk in chunks:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              yield current_content

# idea would be GET to get the conversation id and then route and post. 
@router.post("/")
async def wolfram_maths_response(body: StudentConversation): 
    print(body)
    messages =  [] if len(body.messages) == 0  else body.messages
    steps = ''
    # first chat initiation 
    if len(body.messages) == 0: 
      prompt = sys_prompt(body.topic, body.level,body.messages, '', steps)
      print(prompt)
        # Call open ai function
      stream = open_ai(prompt)
      return StreamingResponse(stream_openai_chunks(stream), media_type="text/event-stream")

    # we have existing messages i.e. not the first time initiating convo so now establish maths stuff 
    async def stream_generator():
      
      prompt = sys_prompt(body.topic, body.level, body.messages, body.current_msg, steps)
      stream = open_ai(prompt, body.messages)
      available_functions = {"get_math_solution": call_wolfram}
      tool_call_accumulator = ""  # Accumulator for JSON fragments of tool call arguments
      tool_call_id = None
      for chunk in stream: 
        if chunk.choices[0].delta.content:
          yield chunk.choices[0].delta.content
        if chunk.choices[0].delta.tool_calls:
          print("placeholder")
          for tc in chunk.choices[0].delta.tool_calls:
                if tc.id:  # New tool call detected here
                    tool_call_id = tc.id
                tool_call_accumulator += tc.function.arguments if tc.function.arguments else ""

                # When the accumulated JSON string seems complete then:
                try:
                    func_args = json.loads(tool_call_accumulator)
                    function_name = tc.function.name if tc.function.name else "get_math_solution"
                    # Call the corresponding function that we defined and matches what is in the available functions
                    func_response = json.dumps(available_functions[function_name](**func_args))
                    steps = func_response
                    # Append the function response directly to messages
                    messages.append({
                        "tool_call_id": tool_call_id,
                        "role": "function",
                        "name": function_name,
                        "content": func_response,
                    })
                    tool_call_accumulator = ""  # Reset for the next tool call
                except json.JSONDecodeError:
                    # Incomplete JSON; continue accumulating
                    pass
        # else: 
        #   # keep going?
        #   pass
      # may be as simple as just going through other stream?
      stream = open_ai(prompt, messages)
      for chunk in stream:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              print(chunk.choices[0].delta.content, end="", flush=True)
              yield current_content
    
    return StreamingResponse(stream_generator, media_type="text/event-stream")
      
        
      
    
