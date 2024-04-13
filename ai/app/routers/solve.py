from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from uuid import UUID
from enum import Enum
import json
import asyncio
import time
import os
from xml.etree import ElementTree as ET
from typing import List, Optional, Dict, Union
from ..dependencies.fermata import get_aitutor_chat_balance,set_aitutor_chat_balance
from ..helpers.openai import open_ai, sys_prompt, math_prompt, steps_agent, title_agent, open_ai_math, solution_check_agent, solution_check_prompt
from ..helpers.wolfram import call_wolfram
from ..helpers.generic import wrap_for_ql, find_tc_in_messages, build_chat_history, convert_to_conversation, check_and_cast_value
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
    messages: List[Dict[str, Optional[str]]]
    

router = APIRouter(
    prefix="/solve",
    tags=["solve"],
    responses={404: {"description": "Not found"}}
)
# once the stream is done, wait 1 second and refetch chat messages
def create_conversation_title(initial_message: str, body):
  title = title_agent(body["topic"], initial_message)
  with Session(engine) as session:
        statement = select(Conversations).where(Conversations.id == body["conversationId"])  
        results = session.exec(statement)  
        convo = results.one()  

        convo.title = title  
        session.add(convo)  
        session.commit()  
        session.refresh(convo)  
        print("Updated title:", convo) 
  
def save_initial_message(initial_message, body):
  assistant_message = wrap_for_ql('assistant', initial_message)
  with Session(engine) as session:
        bot_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=assistant_message)  
        session.add(bot_message)
        session.commit()

def stream_openai_chunks(chunks: str, body):
    """Generator function to stream openai chunks"""
    initial_message=''
    for chunk in chunks:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              initial_message += current_content
              yield current_content
              time.sleep(0.1)
    yield "done with stream"
    save_initial_message(initial_message, body)
    create_conversation_title(initial_message, body)

def stream_error_generator(text: str, chunk_size=30):
    """Generator function to chunk error text into smaller parts."""
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]
        time.sleep(0.2)
    yield "done with stream"
  
     
    
def write_to_db(body,user_msg, steps, tc, assistant_resp, assistant_resp_for_tc):
  print("background job 1 fires")
  with Session(engine) as session:
        user_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=user_msg)  
        session.add(user_message)
        session.commit()
        if tc.get("role") == "function":
          # save tc 
          print("tool call",tc)
          user_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=tc)  
          session.add(user_message)
          session.commit()
        if len(assistant_resp) != 0 and assistant_resp is not None: 
          assistant_msg = wrap_for_ql('assistant', assistant_resp)
          bot_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=assistant_msg)
          session.add(bot_message)
          session.commit()
        
        if len(assistant_resp_for_tc) != 0 and assistant_resp_for_tc is not None: 
          print("basically outside steps")
          print(assistant_resp_for_tc)
          history = build_chat_history(assistant_resp_for_tc, body["query"])
          is_solved = steps_agent(history, steps)
          assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tc, is_solved)
          bot_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=assistant_msg)
          session.add(bot_message)
          session.commit()
          print(assistant_msg)
  
def write_to_db_with_steps(body,user_msg, updated_messages, steps, assistant_resp_for_tool_call):
    print("background job 2 fires")
    with Session(engine) as session:
            user_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=user_msg)  
            session.add(user_message)
            session.commit()
            if len(assistant_resp_for_tool_call) != 0 and assistant_resp_for_tool_call is not None: 
              print("ASSISTANT IN THE OTHER FIRST ONE")
              print(assistant_resp_for_tool_call)
              history = build_chat_history(assistant_resp_for_tool_call, body["query"])
              updated_messages.append(user_msg)
              updated_messages.append({"role": "assistant", "content": assistant_resp_for_tool_call})
              is_solved = steps_agent(updated_messages, steps)
              assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tool_call, is_solved)
              print(assistant_msg)
              bot_message = ConversationLogs(studentId=body["studentId"], conversationId=UUID(body["conversationId"]), log=assistant_msg)
              session.add(bot_message)
              session.commit()


# idea would be GET to get the conversation id and then route and post. 
@router.get("/")
async def wolfram_maths_response(studentId: str, topic: str, subject: str, query: str, name: str, level: str, conversationId: str, firebaseId: str, language: Languages,  messages: str): 
    messages: List[Dict[str, Optional[str]]] = json.loads(messages)
    print("MESSAGES")
    print(messages)
    print(len(messages))
    bodyy = {
        "studentId": studentId,
        "topic": topic,
        "subject": subject,
        "query": query,
        "name": name,
        "level": level,
        "conversationId": conversationId,
        "firebaseId": firebaseId,
        "language": language,
        "messages": messages,
    }
  

    messages =  [] if len(messages) == 0  else messages
    print(messages)
    steps = ''
    
    # first chat initiation 
    if len(messages) == 0: 
      print("len is 0")
      prompt = sys_prompt(topic, level, '', name)
      print(prompt)
        # Call open ai function
      stream = open_ai(prompt)
      return StreamingResponse(stream_openai_chunks(stream, bodyy), headers={ "Content-Type": "text/event-stream" })

    def stream_generator(old_steps: str, messages: List[Dict[str, str | None]]):
      """
      Sync generator function for solving maths questions with steps or just doing word problems.
      """
      steps = old_steps
      last_system_message = messages[-1]
      print("LAST SYSTEM MESSAGE")
      print(last_system_message)

      if last_system_message.get("is_solved") is not None and last_system_message["is_solved"] == 'False':
        print("last system message", last_system_message)
        assistant_resp_for_tool_call = ''
        # grab the steps from messages 
        tc = find_tc_in_messages(messages)
        steps = tc["content"]
        updated_messages = [{k: v for k, v in d.items() if k != 'is_solved'} for d in messages]
        print(updated_messages)
        print("the steps", steps)
        if len(steps) != 0:
          updated_prompt = math_prompt(bodyy["topic"], bodyy["level"], convert_to_conversation(updated_messages), bodyy["query"], steps, bodyy["name"])
          print("For subsequently:", updated_prompt)
          stream = open_ai_math(updated_prompt, updated_messages)
         
          for chunk in stream:
              current_content = chunk.choices[0].delta.content
              if current_content is not None:
                # print("outeer chunk")
                print(chunk.choices[0].delta.content, end="", flush=True)
                assistant_resp_for_tool_call += chunk.choices[0].delta.content
                yield current_content
                time.sleep(0.1)
          yield "done with stream"

        # below save all to db 
        user_msg = wrap_for_ql('user', bodyy["query"])
        #background_tasks.add_tasks(write_to_db_with_steps, body, user_msg, updated_messages, steps, assistant_resp_for_tool_call)
        with Session(engine) as session:
            user_message = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=user_msg)  
            session.add(user_message)
            session.commit()
            if len(assistant_resp_for_tool_call) != 0 and assistant_resp_for_tool_call is not None: 
              print("ASSISTANT IN THE OTHER FIRST ONE")
              print(assistant_resp_for_tool_call)
              history = build_chat_history(assistant_resp_for_tool_call, bodyy["query"])
              updated_messages.append(user_msg)
              updated_messages.append({"role": "assistant", "content": assistant_resp_for_tool_call})
              new_history = convert_to_conversation(updated_messages)
              is_solved = steps_agent(new_history[:2], steps)
              assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tool_call, is_solved)
              print(assistant_msg)
              bot_message = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=assistant_msg)
              session.add(bot_message)
              session.commit()
        print(user_msg)
        return
      
      messages = [{k: v for k, v in d.items() if k != 'is_solved'} for d in messages]
      assistant_resp = ''
      assistant_resp_for_tc = ''
      
      prompt = sys_prompt(bodyy["topic"], bodyy["level"], bodyy["query"], bodyy["name"])
      print("initial prompt", prompt)
      stream = open_ai(prompt, messages)
      available_functions = {"get_math_solution": call_wolfram}
      tool_call_accumulator = ""  # Accumulator for JSON fragments of tool call arguments
      tool_call_id = None
      for chunk in stream: 
        if chunk.choices[0].delta.content is not None:
          print(chunk.choices[0].delta.content, end="", flush=True)
          assistant_resp += chunk.choices[0].delta.content
          yield chunk.choices[0].delta.content
          time.sleep(0.1)
        if chunk.choices[0].delta.tool_calls:
          for tc in chunk.choices[0].delta.tool_calls:
                if tc.id:  # New tool call detected here
                    tool_call_id = tc.id
                tool_call_accumulator += tc.function.arguments if tc.function.arguments else ""

                # When the accumulated JSON string seems complete then:
                try:
                    func_args = json.loads(tool_call_accumulator)
                    print("ARGS i.e. equation", func_args)
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
      print("the steps:")
      print(steps)
      if len(steps) != 0:
        user_query = bodyy["query"]
        prompt = solution_check_prompt(user_query, steps)
        is_steps = solution_check_agent(prompt)
        is_steps_complete = check_and_cast_value(is_steps)
        print("is_steps_complete prompt", prompt)
        print("are steps full or correct", is_steps_complete)
        if is_steps_complete == False:
          print("False, made it")
          response = "We can tell that this query is complex and we suggest using a human tutor for better understanding of the subject matter."
          print(response)
          stream_error_generator(response)
          with Session(engine) as session:
            bot = wrap_for_ql('assistant', response)
            user = wrap_for_ql('user', user_query)
            msg = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=bot)
            umsg = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=user)  
            session.add(umsg)
            session.add(msg)
            session.commit()
          return
        updated_prompt = math_prompt(bodyy["topic"], bodyy["level"], convert_to_conversation(messages), bodyy["query"], steps, bodyy["name"])
        print("from first time:", updated_prompt)
        stream = open_ai_math(updated_prompt, messages)
      
        for chunk in stream:
            current_content = chunk.choices[0].delta.content
            if current_content is not None:
              #print("outeer chunk")
              print(chunk.choices[0].delta.content, end="", flush=True)
              assistant_resp_for_tc += chunk.choices[0].delta.content
              yield current_content
              time.sleep(0.1)
      yield "done with stream"
        
              
      
      # below save all to db 
      tc = messages[-1]
      user_msg = wrap_for_ql('user', bodyy["query"])
      log = json.dumps(user_msg)
      print(user_msg)
      #background_tasks.add_task(write_to_db, body, user_msg,steps,tc,assistant_resp, assistant_resp_for_tc)
      with Session(engine) as session:
        user_message = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=user_msg)  
        session.add(user_message)
        session.commit()
        if tc.get("role") == "function":
          # save tc 
          print("tool call:",tc)
          user_message = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=tc)  
          session.add(user_message)
          session.commit()
        if len(assistant_resp) != 0 and assistant_resp is not None: 
          assistant_msg = wrap_for_ql('assistant', assistant_resp)
          print("assistant response meaning no TC:")
          bot_message = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=assistant_msg)
          session.add(bot_message)
          session.commit()
        
        if len(assistant_resp_for_tc) != 0 and assistant_resp_for_tc is not None: 
          print("assistant response based off of the tool call:")
          print(assistant_resp_for_tc)
          history = build_chat_history(assistant_resp_for_tc, bodyy["query"])
          is_solved = steps_agent(history, steps)
          assistant_msg = wrap_for_ql('assistant', assistant_resp_for_tc, is_solved)
          bot_message = ConversationLogs(studentId=bodyy["studentId"], conversationId=UUID(bodyy["conversationId"]), log=assistant_msg)
          session.add(bot_message)
          session.commit()
          print(assistant_msg)
      
    chat_limit_check = os.environ.get("CHAT_LIMIT_CHECK")
    if(chat_limit_check != "disabled"):
        balance = await get_aitutor_chat_balance(bodyy["firebaseId"])
        if balance:
          return StreamingResponse(stream_error_generator("run out of credits"), headers={ "Content-Type": "text/event-stream" })
        await set_aitutor_chat_balance(bodyy["firebaseId"])
    return StreamingResponse(stream_generator(steps, messages), headers={ "Content-Type": "text/event-stream" })
      
        
      
    
