import { ChatOpenAI } from 'langchain/chat_models/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from 'langchain/prompts';
import config from 'config';
import { ConversationChain } from 'langchain/chains';

const promptTemplate = `
Given the context and conversation above, can you generate a very concise but precise set of statements using these headers .
1. What I need help with
2. What I understand
Context: In this conversation, a student is stating what their problems learning a topic.
Some rules:
- Don't state your identity.
- Don't break character.
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
  const { apikey, model: modelName } = config.get('openai') as any;

  const model = new ChatOpenAI({
    openAIApiKey: apikey,
    modelName
  });

  const prompt = new PromptTemplate({
    template:
      'Give me back the full history of this conversation' || promptTemplate,
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
