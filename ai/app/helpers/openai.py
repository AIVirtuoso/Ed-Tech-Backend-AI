from openai import OpenAI
import os 

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_math_solution",
            "description": "Get the mathematical solution, If the user asks how to solve or asks to calculate a mathematical question or equation. Only use if math_solution does not contain steps. It reduces the question into the smallest possible format to be sent to wolfram alpha",
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

def sys_prompt(topic, level, history, input):
  return f"""
You are an upbeat, encouraging Mathematics if tutor who helps students understand concepts by explaining ideas and asking students questions.
Ask the student what math problem they need help to solve. Do not converse with the student besides asking for a math problem they need help solving. If the student responds with something else please guide them to asking a specific math problem.

Here is the information about the Tools you have access to:
- There is a get_math_solution tool that returns a step by step solution to the given equation.
- Read the users input and determine if it requires you to solve a math problem. The user would likely say things like 'How do I solve ....' or 'Help me integrate ...'
- You also have the ability to read a students input and determine if its a word problem. Use the get_math_solution tool if its a word problem
- YOU ABSOLUTELY HAVE TO USE the get_math_solution tool IF A STUDENT ASKS YOU HOW TO ANSWER A MATHEMATICS PROBLEM.
- Don't make assumptions about what values to plug into functions. Ask for clarification if a students request is ambiguous.
- The equation you input to get_math_solution is a reduced version of the students question that can be interpreted by wolfram alpha.

If the user enters a word problem to you, your goal is to break down math word problems into clear, solvable formulas. These formulas should be precise enough to be input directly into computational tools like Wolfram Alpha for solving.
Thers are the steps you need to follow:
- Identify the key components of the problem, such as the quantities involved, the relationships between these quantities, and the ultimate question being asked.
- Identify Variables and Constants. Determine which elements of the problem are variables, and assign them symbolic representations (e.g., x, y, z).
- Determine the Operations Required
- Formulate the Equation or Expression
- If possible, simplify the equation or expression to make it easier to input into a computational tool.

I'm Dera and I'm studying Mathematics and I need help with {topic}. I'm a {level} student.
Our dialogue history so far which is a list of messages is: {history}

Student: {input}
Tutor:
"""

# System prompt for Math mode
# this is a derivative of the current AI tutor prompt
def math_prompt(topic, level, history, input, steps):
  return f"""
I'm Dera and I'm studying Mathematics and I need help with {topic}. I'm a {level} student.
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


Our dialogue history so far: {history}

Student: {input}
Tutor:

### step_guide:\n
{steps}
###
"""

openai_client = OpenAI(api_key = os.environ.get("OPENAI_APIKEY"))

def open_ai(prompt, msgs = []):
    msgs = [{
            "role": "system",
            "content": prompt
          }, *msgs]
    
    
    stream = openai_client.chat.completions.create(
        model= "gpt-4-turbo-preview", # replace with req.gptVersion
        messages=msgs,
        temperature=0.2,
        max_tokens=1500,
        top_p=1,
        frequency_penalty=0.15,
        presence_penalty=0,
        tools=tools,
        stream=True
      )
    
    return stream


STEPS_AGENT = """
You have a very important job. Your task is to determine from a tutor-student conversation if the student has correctly solved a math problem.
Monitor the chat history between the tutor and the student to determine if the steps in a problem-solving process have been successfully understood and completed to the correct answer.

Here are some guidelines:
- If the chat history suggests that the problem has been solved correctly return True.
- The problem could have been solved by the tutor summarizing the students answer so look out for that.
- If the chat history suggest that the tutor and student are still working towards the solution return False.
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
    user_input = f"Chat History :{history}.\nMath Solution Steps: {steps}."
    response = openai_client.chat.completions.create(
        model= "gpt-3.5-turbo-0613", #"replace with req",
        messages=[
          {
            "role": "system",
            "content": STEPS_AGENT
          },
          {
            "role": "user",
            "content": f'History: {history}\nSteps: {steps}'
          }
        ],
        temperature=0,
        max_tokens=1024,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
      )
    return response.choices[0].message.content