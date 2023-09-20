import { ChatOpenAI } from 'langchain/chat_models/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from 'langchain/prompts';
import config from 'config';
import { ConversationChain } from 'langchain/chains';

const promptTemplate = `
Can you structure a very concise but precise takeaway on our discussion using these headers 1. What student needs help with 2. What student understands
here is the history of the conversation: {history}
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
