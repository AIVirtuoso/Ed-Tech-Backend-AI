from openai import OpenAI
import os

openai_client = OpenAI(api_key = os.environ.get("OPENAI_APIKEY"))

# this agent essentially manages what steps to embed in the system prompts. It removed the steps as the chat history shows it has been solved

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

The User will now provide the chat history which is a list of messages and the steps to the math problem.
"""

def steps_agent(history, steps):

   
    response = openai_client.chat.completions.create(
        model= "gpt-3.5-turbo-0613", #"gpt-4-turbo-preview",
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