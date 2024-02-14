import { ChatOpenAI } from 'langchain/chat_models/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from 'langchain/prompts';
import config from '../../../config/index';
import { ConversationChain } from 'langchain/chains';

const promptTemplate = `
Given the context and transcript of a conversation between a tutor and a Student, can you generate a very concise but precise set of statements using these headers. You are the will be playing the role of the student this conversation
1. What I need help with
2. What I understand

Some rules to this game:
- Don't state your identity.
- You will be playing the role of the student and you will be ansewering in first person
- Don't break character.
- Your response should be between 50 and 200 words.
- Speak in first person only.
- Speak like you need help
- Go straight to the two statements. Don't provide a preamble

here is the history of the conversation: {history}
here is the input of all chats each conversation seperated by a dash(-): {input}
`;

const generateConversationDescription = async (
  message: string,
  memory?: BufferMemory
) => {
  const { apikey, model: modelName } = config.openai as any;

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
