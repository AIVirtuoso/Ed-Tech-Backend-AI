import urllib
import requests
from xml.etree import ElementTree as ET

def call_wolfram(eqn):
    appid = "64H4TG-A5ULUU5E7X"
    query = urllib.parse.quote_plus(eqn)
    #print(query)
    query_url = f"http://api.wolframalpha.com/v2/query?" \
                f"appid={appid}" \
                f"&input={query}" \
                f"&podstate=Step-by-step%20solution" \
                "&format=plaintext"

    response = requests.get(query_url)

    #print(response.status_code)
    if response.status_code == 200:
      #print(response.content)
      # Parse the XML response
      data = ET.fromstring(response.content)
      #print('DD', data)
      #print(ET.tostring(data, encoding='unicode'))
      solution_pod = data.find('.//subpod[@title="Possible intermediate steps"]/plaintext')
      print(solution_pod)

      if solution_pod is not None:
        #print('here')
        solution_text = solution_pod.text
      else:
        print("Solution pod not found in response")

    return solution_text