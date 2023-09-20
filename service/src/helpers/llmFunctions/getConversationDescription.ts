import { ChatOpenAI } from 'langchain/chat_models/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from 'langchain/prompts';
import config from 'config';
import { ConversationChain } from 'langchain/chains';

const promptTemplate = `
Given the context and conversation below, Can you generate a very concise but single statement stating your problems with what you haven't yet. the statement should contain these two information.
1. What you needs help with
2. What you understands

Context: In this conversation, a student stating what your problems learning an issue.

some rules.
- Don't state your identity.
- Don't break character.
- Speak in first person only. 
- Speak like you need help

here is the history of the conversation: {history}
here is the input of all chats each conversation seperated by a dash(-): {input}
`;

const generateConversationDescription = async (
  message: string,
  memory?: BufferMemory
) => {
  const { apikey, model: modelName } = config.get('openai') as any;

  const model = new ChatOpenAI({
    openAIApiKey: apikey,
    modelName
  });

  const prompt = new PromptTemplate({
    template: promptTemplate,
    inputVariables: ['history', 'input']
  });

  const chain = new ConversationChain({
    llm: model,
    memory,
    prompt
  });
  const answer = await chain.call({ input: message });
  return answer.response;
};

export default generateConversationDescription;
