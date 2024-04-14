from openai import OpenAI
import os 
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv()) 

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_math_solution",
            "description": "Get the mathematical solution, If the user asks how to solve or asks to calculate a mathematical question or equation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "equation": {
                        "type": "string",
                        "description": "The mathematical equation the student wants to solve in wolfram alpha format.",
                    }
                },
                "required": ["equation"],
            },
        }
    }]

def sys_prompt(topic, level, input, name):
  return f"""
You are an upbeat, encouraging Mathematics tutor Socrates who helps students understand concepts.
Ask the student what math {topic} problem they need help to solve in a friendly tone e.g. "Hey {name}, what {topic} do you need help solving?" IF there seems to be no input OR history. 
Do not converse with the student besides asking for a math {topic} problem they need help solving in a friendly tone e.g. "Hey {name}, what {topic} do you need help solving?" . Do not explain concepts or provide answers to any questions.
If the student responds with something other than a request to solve a math problem, please guide them towards asking a specific math problem. Ask them what problem they need help with. The user would likely say things like 'How do I solve ....' or 'Help me integrate ...' so if they respond with anything other than that, not along those lines, please just ask them what {topic} problem they need help with.

If the student seems they need help understanding a concept e.g. "explain ..." ask them to try the explain a concept feature as you only are for solving maths problems.

If the student seems unsure about what to ask or explicitly asks you to recommend, only ask them to give you a math problem as your job is solely to be given maths problems to solve. Again, do not converse. please just ask them what {topic} problem they need help with in a friendly manner.

Here is the information about the Tools you have access to:
- There is a get_math_solution tool that returns a step by step solution to the given equation.
- Read the users input and determine if it requires you to solve a math problem. The user would likely say things like 'How do I solve ....' or 'Help me integrate ...'
- You also have the ability to read a students input and determine if its a word problem. Use the get_math_solution tool if its a word problem
- YOU ABSOLUTELY HAVE TO USE the get_math_solution tool IF A STUDENT ASKS YOU HOW TO ANSWER A MATHEMATICS PROBLEM.
- Don't make assumptions about what values to plug into functions. Ask for clarification if a students request is ambiguous.
- The equation you input to get_math_solution is a reduced version of the students question that can be interpreted by wolfram alpha.

If the user enters a word problem to you, your goal is to break down math word problems into clear, solvable formulas. These formulas should be precise enough to be input directly into computational tools like Wolfram Alpha for solving.
Here are the steps you need to follow:
- Identify the key components of the problem, such as the quantities involved, the relationships between these quantities, and the ultimate question being asked.
- Identify Variables and Constants. Determine which elements of the problem are variables, and assign them symbolic representations (e.g., x, y, z).
- Determine the Operations Required
- Formulate the Equation or Expression
- If possible, simplify the equation or expression to make it easier to input into a computational tool.

I'm {name} and I'm studying Mathematics and I need help with {topic}. I'm a {level} student.
Student: {input}
Tutor:
"""

# System prompt for Math mode
# this is a derivative of the current AI tutor prompt
def math_prompt(topic, level, history, input, steps, name):
  return f"""
I'm {name} and I'm studying Mathematics and I need help with {topic}. I'm a {level} student.
You are an upbeat, encouraging Mathematics if tutor who helps students understand concepts by explaining ideas and asking students questions.

Could you please also use the following specific LaTeX math mode delimiters in your response whenever returing equations and formulas?
LaTex math mode specific delimiters as following
display math mode: insert linebreak after opening '$$', '\[' and before closing '$$', \]

Here are some guidelines in interacting with the user:
- Because you are a good tutor, You have a step by step answer to the students question.
- You do not just return the entire solution! Instead you provide the solution is digestible chunks for the students level to guide them to continue solving it themselves.
- You evaluate the users answer and only agree with them if their answer is the correct answer to the steps.
- If you determine the answer is incorrect, you will reveal more of the steps and continue guiding them along the solution until is its solved.
- Use the steps in the 'step_guide' to walk the student through to the answer. Only use the steps provided because it guranteed to be the correct answer to the problem.
- Do not return the students answer back to them. Use their answer or response to you to determine if they have answered correctly or need more help
### step_guide:\n
{steps}

### Our dialogue history so far: \n {history} 

### Student response or answer is: {input}
### your Tutor response: \n 

"""

openai_client = OpenAI(api_key = os.environ.get("OPENAI_APIKEY"))

def open_ai_math(prompt, msgs = []):
    msgs = [{
            "role": "system",
            "content": prompt
          }]
    
    
    stream = openai_client.chat.completions.create(
        model= "gpt-4-turbo-preview", # replace with req.gptVersion
        messages=msgs,
        temperature=0.2,
        max_tokens=1500,
        top_p=1,
        frequency_penalty=0.15,
        presence_penalty=0,
        stream=True
      )
    
    return stream

def open_ai(prompt, msgs = []):
    msgs = [{
            "role": "system",
            "content": prompt
          }]
    
    
    stream = openai_client.chat.completions.create(
        model= "gpt-4-turbo-preview", # replace with req.gptVersion
        messages=msgs,
        temperature=0,
        max_tokens=1500,
        top_p=1,
        frequency_penalty=0.15,
        presence_penalty=0,
        tools=tools,
        stream=True
      )
    
    return stream


STEPS_AGENT = """
You have a very important job. Your task is to determine from a tutor-student conversation if the student has correctly solved a math problem wholly i.e. successfully followed a set of steps to reaching the final answer.
Monitor the chat history between the tutor (assistant) and the student to determine if the steps in a problem-solving process are completed.
The answer in steps may be denoted with Answer: but again, analyze the chat history and the steps string passed in

Here are some guidelines:
- If the chat history suggests that the tutor and student are still working towards the solution e.g. Tutor asks the student to tell them what they got? or suggests there's more steps or parts to the final answer return False.
- If the chat history suggests that there is more parts to go return False
- If the chat history suggests that the problem has been solved correctly return True.
- If the chat history says something explicit like: The final answer is then the question is solved.
- The problem could have been solved by the tutor summarizing the students answer so look out for that.
- The tutor may say something like "Great job! Do you have any more questions on this, or is there another problem you'd like to tackle?" or "Great job! working through it together" very similarly along those lines which indicates the question has been solved so return True as it means it has been solved.
- Analyze the chat history after each student interaction to identify which steps have been explicitly covered and understood.
- DO NOT RETURN ANY OTHER WORDS. ONLY True or False
- If steps is not provided return False.

The User will now provide the chat history and the steps to the math problem.
"""

def steps_agent(history, steps):
    """
    ChatGPT Agent that is responsible for figuring out if user has answered question. 
    Useful for knowing when to close the stream generator function. 
    """
    print("Steps", STEPS_AGENT)
    print("HISTORY", history)
    user_input = f"Chat History :{history}.\nMath Solution Steps: {steps}."
    response = openai_client.chat.completions.create(
        model= "gpt-4-turbo-preview", #"replace with req",
        messages=[
          {
            "role": "system",
            "content": STEPS_AGENT
          },
          {
            "role": "user",
            "content": f'History: {history}\n Math Solution Steps: {steps}'
          }
        ],
        temperature=0,
        max_tokens=1024,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
      )
    return response.choices[0].message.content
  
TITLE_AGENT = """
Given the context and conversation below, generate an appropriate title that summarizes the main theme and interaction. it shouldn't be more than 50 characters long.

Context: In this conversation, an AI tutor named Socrates is guiding a student to understand a topic. The AI uses a Socratic method, asking questions to tease out the student's knowledge and guide them towards comprehension.
If no sufficient context is provided, the AI will generate a title of the topic of the conversation.

Conversation:
Topic: {}

Latest Message:

Socrates: {}

Generate a title. Only the title, nothing else. 
"""

def title_agent(topic: str, message: str):
    """
    ChatGPT Agent that is responsible for creating the title of a conversation.
    """
   
    response = openai_client.chat.completions.create(
        model= "gpt-3.5-turbo-0613", #"replace with req",
        messages=[
          {
            "role": "system",
            "content": TITLE_AGENT.format(topic, message)
          },
        ],
        temperature=0,
        max_tokens=1024,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
      )
    return response.choices[0].message.content
  

def solution_check_prompt(question: str, steps: str):
  return f"""
You are a highly accuract agent that checks that whether the step-by-step solution is complete. You would be provided the mathematical question to be solved as well as the step-by-step solution returned.
Your job is to Understand the Problem and ensure you have the complete steps. Return 'True' if the steps are complete otherwise return 'False'

Here are some guidelines to help you identify complete step-by-step solutions:
- Your response is only 'True' or 'False'
- Complete steps do not make assumptions without prior knowledge or simplify for brevity without explicit statements.
- Complete steps have a logical transitions between each step. A sudden jump in the process might indicate a skipped explanation or step
- The solution should start with the given information and end with the problem's requirement being fulfilled. If the final answer does not directly address the question posed, there may be missing steps.

###
step-by-step solution:
{steps}
###

Here is the question it is answering: {question}

Is the step-by-step solution provided complete to answer the question True/False:\n
"""

def solution_check_agent(prompt: str):
    """
    ChatGPT Agent that is responsible for checking if the solution (steps) given are complete and wholly solve the problem.
    """
   
    response = openai_client.chat.completions.create(
        model= "gpt-3.5-turbo", #"replace with req",
        messages=[
          {
            "role": "system",
            "content": prompt
          },
        ],
        temperature=0,
        max_tokens=1024,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
      )
    return response.choices[0].message.content
 