from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from enum import Enum
import json
from xml.etree import ElementTree as ET
from typing import List, Optional, Dict, Union
from ..dependencies.fermata import get_aitutor_chat_balance
from ..helpers.openai import open_ai, sys_prompt
from ..helpers.wolfram import call_wolfram
from ..helpers.wrap import wrap_for_ql

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
    # may be worth creating like an add_msgs list that;s the tc response and user query to save to db
    # as well as ChatGPT responses or have the user pass that ? 
    # ideally to save stream response just have a variable and += before yielding 
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
    async def stream_generator(steps: str, messages: List[Dict[str, str | None]]):
      assistant_resp = ''
      assistant_resp_for_tc = ''
      tc_func = dict()
      prompt = sys_prompt(body.topic, body.level, body.messages, body.query, steps)
      print("PROMPT –", prompt)
      stream = open_ai(prompt, body.messages)
      available_functions = {"get_math_solution": call_wolfram}
      tool_call_accumulator = ""  # Accumulator for JSON fragments of tool call arguments
      tool_call_id = None
      for chunk in stream: 
        if chunk.choices[0].delta.content is not None:
          print(chunk.choices[0].delta.content, end="", flush=True)
          assistant_resp += chunk.choices[0].delta.content
          yield chunk.choices[0].delta.content
        if chunk.choices[0].delta.tool_calls:
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
                    new_msg = {
                        "tool_call_id": tool_call_id,
                        "role": "function",
                        "name": function_name,
                        "content": func_response,
                    }
                    tc_func = new_msg
                    messages.append(new_msg)
                    tool_call_accumulator = ""  # Reset for the next tool call
                except json.JSONDecodeError:
                    # Incomplete JSON; continue accumulating
                    pass
       
      # may be as simple as just going through other stream?
      if len(steps) is not 0:
        updated_prompt = sys_prompt(body.topic, body.level, messages, body.query, steps)
        stream = open_ai(updated_prompt, messages)
        for chunk in stream:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              print("outeer chunk")
              print(chunk.choices[0].delta.content, end="", flush=True)
              assistant_resp_for_tc += chunk.choices[0].delta.content
              yield current_content
      # below save all to db 
      tc = messages[-1]
      user_msg = wrap_for_ql('user', body.query)
      if len(assistant_resp) is not 0 and not None: 
        assistant_msg = wrap_for_ql('assistant', assistant_resp)
      
      if len(assistant_resp_for_tc) is not 0 and not None: 
        assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tc)
      
      if tc.get("role") == "function":
        # save tc 
        print(tc)
        
    return StreamingResponse(stream_generator(steps, messages), media_type="text/event-stream")
      
        
      
    
