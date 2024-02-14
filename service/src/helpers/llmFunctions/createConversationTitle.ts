import { ChatOpenAI } from 'langchain/chat_models/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from 'langchain/prompts';
import config from '../../../config/index';
import { ConversationChain } from 'langchain/chains';

const titlePrompt = (topic?: string) => `
Given the context and conversation below, generate an appropriate title that summarizes the main theme and interaction. it shouldn't be more than 50 characters long.

Context: In this conversation, an AI tutor named Socrates is guiding a student to understand a topic. The AI uses a Socratic method, asking questions to tease out the student's knowledge and guide them towards comprehension.

Conversation:
Topic: ${topic}

Chat History:
{history}

Latest Message:
Human: {input}
Socrates:

Title: `;

const llmCreateConversationTitle = async (
  message: string,
  topic?: string,
  memory?: BufferMemory
) => {
  const { apikey, model: modelName } = config.openai as any;

  const model = new ChatOpenAI({
    openAIApiKey: apikey,
    modelName
  });

  const prompt = new PromptTemplate({
    template: titlePrompt(topic),
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

export default llmCreateConversationTitle;
