from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from uuid import UUID
from enum import Enum
import json
import os
import time
from xml.etree import ElementTree as ET
from typing import List, Optional, Dict, Union
from ..dependencies.fermata import get_aitutor_chat_balance
from ..helpers.openai import open_ai, sys_prompt, math_prompt, steps_agent, title_agent
from ..helpers.wolfram import call_wolfram
from ..helpers.generic import wrap_for_ql, find_tc_in_messages, build_chat_history
from ..db.database import  engine
from ..db.models import ConversationLogs, Conversations
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
    firebaseId: str
    language: Languages
    messages: List[Dict[str, Union[Optional[str], str]]]
    

router = APIRouter(
    prefix="/maths",
    tags=["maths"],
    responses={404: {"description": "Not found"}}
)
# once the stream is done, wait 1 second and refetch chat messages
def create_conversation_title(initial_message: str, body: StudentConversation):
  title = title_agent(body.topic, initial_message)
  with Session(engine) as session:
        statement = select(Conversations).where(Conversations.id == body.conversationId)  
        results = session.exec(statement)  
        convo = results.one()  
        

        convo.title = title  
        session.add(convo)  
        session.commit()  
        session.refresh(convo)  
        print("Updated title:", convo) 
  
def save_initial_message(initial_message, body: StudentConversation):
  assistant_message = wrap_for_ql('assistant', initial_message)
  with Session(engine) as session:
        bot_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=assistant_message)  
        session.add(bot_message)
        session.commit()

def stream_openai_chunks(chunks: str, body: StudentConversation):
    """Generator function to stream openai chunks"""
    initial_message=''
    for chunk in chunks:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              initial_message += current_content
              yield current_content
    
    save_initial_message(initial_message, body)
    create_conversation_title(initial_message, body)
    yield "done with stream"

def chunk_text(text: str, chunk_size=50):
    """Generator function to chunk text into smaller parts."""
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]

# idea would be GET to get the conversation id and then route and post. 
@router.post("/")

async def wolfram_maths_response(body: StudentConversation): 
    print(body)

    messages =  [] if len(body.messages) == 0  else body.messages
    steps = ''
    
    # first chat initiation 
    if len(body.messages) == 0: 
      prompt = sys_prompt(body.topic, body.level,body.messages, '', body.name)
      print(prompt)
        # Call open ai function
      stream = open_ai(prompt)
      return StreamingResponse(stream_openai_chunks(stream, body), media_type="text/event-stream")

    # we have existing messages i.e. not the first time initiating convo so now establish maths stuff 
    # messages is from the user and is always the updated messages from BE, we could leverage TS Query, once the POST
    # stream is done, SWR the messages 
    # or much simply just ensure the FE sends messages minus users last 
    # i.e. pls don't append the new message to the list before sending, can do it after
    def stream_generator(steps: str, messages: List[Dict[str, str | None]]):
      last_system_message = messages[-1]
      if last_system_message.get("is_solved") is not None and last_system_message["is_solved"] == 'False':
        print("last system message", last_system_message)
        assistant_resp_for_tc = ''
        # grab the steps from messages 
        tc = find_tc_in_messages(messages)
        steps = tc["content"]
        updated_messages = [{k: v for k, v in d.items() if k != 'is_solved'} for d in messages]
        print(updated_messages)
        print("the steps", steps)
        if len(steps) != 0:
          updated_prompt = math_prompt(body.topic, body.level, updated_messages, body.query, steps, body.name)
          stream = open_ai(updated_prompt, updated_messages)
          for chunk in stream:
              current_content = chunk.choices[0].delta.content
              if current_content is not None:
                # print("outeer chunk")
                # print(chunk.choices[0].delta.content, end="", flush=True)
                assistant_resp_for_tc += chunk.choices[0].delta.content
                yield current_content
                time.sleep(0.1)
        # below save all to db 
        user_msg = wrap_for_ql('user', body.query)
        print(user_msg)
        with Session(engine) as session:
            user_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=user_msg)  
            session.add(user_message)
            session.commit()
            if len(assistant_resp_for_tc) != 0 and assistant_resp_for_tc is not None: 
              history = build_chat_history(assistant_resp_for_tc, body.query)
              updated_messages.append(user_msg)
              updated_messages.append({"role": "assistant", "content": assistant_resp_for_tc})
              is_solved = steps_agent(updated_messages, steps)
              assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tc, is_solved)
              print(assistant_msg)
              bot_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=assistant_msg)
              session.add(bot_message)
              session.commit()
        yield "done with stream"
        return
      
      assistant_resp = ''
      assistant_resp_for_tc = ''
      
      prompt = sys_prompt(body.topic, body.level, body.messages, body.query, body.name)
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
          # time.sleep(0.1)
        if chunk.choices[0].delta.tool_calls:
          for tc in chunk.choices[0].delta.tool_calls:
                if tc.id:  # New tool call detected here
                    tool_call_id = tc.id
                tool_call_accumulator += tc.function.arguments if tc.function.arguments else ""

                # When the accumulated JSON string seems complete then:
                try:
                    func_args = json.loads(tool_call_accumulator)
                    print("ARGS", func_args)
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
                    
                    messages.append(new_msg)
                    tool_call_accumulator = ""  # Reset for the next tool call
                except json.JSONDecodeError:
                    # Incomplete JSON; continue accumulating
                    pass
       
      # may be as simple as just going through other stream?
      if len(steps) != 0:
        updated_prompt = math_prompt(body.topic, body.level, messages, body.query, steps, body.name)
        stream = open_ai(updated_prompt, messages)
        for chunk in stream:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              #print("outeer chunk")
              #print(chunk.choices[0].delta.content, end="", flush=True)
              assistant_resp_for_tc += chunk.choices[0].delta.content
              yield current_content
              time.sleep(0.1)
      # below save all to db 
      tc = messages[-1]
      user_msg = wrap_for_ql('user', body.query)
      log = json.dumps(user_msg)
      print(user_msg)
      with Session(engine) as session:
        user_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=user_msg)  
        session.add(user_message)
        session.commit()
        if tc.get("role") == "function":
          # save tc 
          print("tool call",tc)
          user_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=tc)  
          session.add(user_message)
          session.commit()
        if len(assistant_resp) != 0 and assistant_resp is not None: 
          assistant_msg = wrap_for_ql('assistant', assistant_resp)
          bot_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=assistant_msg)
          session.add(bot_message)
          session.commit()
        
        if len(assistant_resp_for_tc) != 0 and assistant_resp_for_tc is not None: 
          print("basically outside steps")
          print(assistant_resp_for_tc)
          history = build_chat_history(assistant_resp_for_tc, body.query)
          is_solved = steps_agent(history, steps)
          assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tc, is_solved)
          bot_message = ConversationLogs(studentId=body.studentId, conversationId=UUID(body.conversationId), log=assistant_msg)
          session.add(bot_message)
          session.commit()
          print(assistant_msg)
      yield "done with stream"
    chat_limit_check = os.environ.get("CHAT_LIMIT_CHECK")
    if(chat_limit_check != "disabled" and get_aitutor_chat_balance(body.firebaseId)):
       return JSONResponse(  status_code=400,
                content={"message": "AI Tutor chat Limit reached"},)   
    return StreamingResponse(stream_generator(steps, messages), media_type="text/event-stream")
      
        
      
    