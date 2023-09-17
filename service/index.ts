import { ai, PORT, server, embedding, pineconeIndex } from './src/routes/index';
import { Server } from 'socket.io';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { PromptTemplate } from 'langchain/prompts';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import ChatLog, { createNewChat } from './db/models/conversationLog';
import {
  HumanChatMessage,
  AIChatMessage,
  SystemChatMessage
} from 'langchain/schema';
import { summarizeNotePrompt } from './src/helpers/promptTemplates/index';
import {
  ConversationChain,
  ConversationalRetrievalQAChain,
  RetrievalQAChain
} from 'langchain/chains';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { updateDocument } from './db/models/document';
import {
  getChatConversationId,
  createNewConversation,
  chatHasTitle,
  storeChatTitle
} from './db/models/conversation';
import { getChatLogs } from './db/models/conversationLog';
import config, { has } from 'config';
import paginatedFind from './src/helpers/pagination';
import llmCreateConversationTitle from './src/helpers/llmActions/createConversationTitle';

const CONVERSATION_STARTER_TEXT = 'Shall we begin, Socrates?';
// Setting up some general shit for global AI assistant usage
const wrapForQL = (role: 'user' | 'assistant', content: string) => ({
  role,
  content
});
const { apikey, model: modelName } = config.get('openai') as any;
const TOP_K = 15;

const getDocumentVectorStore = async ({
  studentId,
  documentId
}: {
  studentId: string;
  documentId: string;
}) => {
  return await PineconeStore.fromExistingIndex(embedding, {
    pineconeIndex,
    namespace: studentId,
    filter: { documentId: { $eq: `${documentId}` } }
  });
};

const socketAiModel = (socket: any, event: string) => {
  return new ChatOpenAI({
    openAIApiKey: apikey,
    modelName,
    streaming: true,
    callbacks: [
      {
        handleLLMNewToken(token) {
          socket.emit(`${event} start`, token);
        }
      }
    ]
  });
};

ai.listen(PORT, () =>
  console.log(
    `\n🤖🤖🤖 All your base are belong to me. Eavesdropping on 0.0.0.0:${PORT}\n`
  )
);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.use(async (socket, next) => {
  try {
    const { studentId } = socket.handshake.auth;

    if (!studentId) {
      next(new Error('studentId  required'));
    } else {
      next();
    }
  } catch (e) {
    next(new Error('Someting went wrong'));
  }
});

const docChatNamespace = io.of('/doc-chat');

const homeworkHelpNamespace = io.of('/homework-help');

docChatNamespace.on('connection', async (socket) => {
  const { studentId, documentId } = socket.handshake.auth;
  console.log(socket.handshake.auth);

  const conversationId = await getChatConversationId({
    referenceId: documentId,
    reference: 'document'
  });

  const vectorStore = await getDocumentVectorStore({ studentId, documentId });

  const docChatChain = (event: string, topK: number) => {
    const model = socketAiModel(socket, event);

    const llm = new ChatOpenAI({
      openAIApiKey: apikey
    });

    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      vectorStore.asRetriever(topK),
      {
        memory: new BufferMemory({
          memoryKey: 'chat_history',
          inputKey: 'question',
          outputKey: 'text'
        }),
        questionGeneratorChainOptions: {
          llm
        }
      }
    );

    return chain;
  };

  // Done with setting up the chat AI requirements, so we can tell the client we're ready to discuss.
  socket.emit('ready', true);

  // Client sends us a chat message
  socket.on('chat message', async (message) => {
    const userQuery = wrapForQL('user', message);
    const event = 'chat response';

    let topK = 30;

    let chain = docChatChain(event, topK);

    const question = `Using only context from the PDF document supplied, answer any questions the user asks — never make one up outside of the information provided. Make your answers brief, exciting and informative. Be charming and have a personality.
    
    Suggest follow-up discussions based on the information, and format them in bullet points of three discussions.
    
    Make your answers in markdown.

    Do not discuss with me. If I send you a message that does not seem like  a question about the document, respond with a variation of: 'I'm sorry, that is not a question about this document. Would you like to ask me something about this document?'
    
    My question is: ${message}
    
    Your answer:`;

    const callChain = async () =>
      await chain
        .call({ question })
        .then(async (response) => {
          socket.emit(`${event} end`, response?.text);
          const assistantResponse = wrapForQL('assistant', response?.text);

          Promise.all([
            await createNewChat({
              studentId,
              log: userQuery,
              conversationId
            }),
            await createNewChat({
              studentId,
              log: assistantResponse,
              conversationId
            })
          ]);
        })
        .catch(async (e: any): Promise<any> => {
          if (e?.response?.data?.error?.code === 'context_length_exceeded') {
            topK -= 5;
            console.log('Error, context length: ', topK);
            chain = docChatChain(event, topK);
            return await callChain();
          }

          console.log(e.message, e?.response?.data?.error?.code);
          socket.emit(
            `${event} start`,
            'I ran into some trouble coming up with an answer. Can you ask me the question again?'
          );
        });

    await callChain(); //NB: this part is also emitting a message to the client!
  });

  socket.on('generate summary', async () => {
    const model = socketAiModel(socket, 'summary');
    const chain = RetrievalQAChain.fromLLM(
      model,
      vectorStore.asRetriever(TOP_K)
    );

    const answer = await chain.call({ query: summarizeNotePrompt });
    await updateDocument({
      data: {
        summary: answer?.text
      },
      referenceId: studentId,
      documentId
    });
  });
});

// Homework help namespace
homeworkHelpNamespace.on('connection', async (socket) => {
  const {
    studentId,
    topic,
    subject,
    level,
    conversationId: convoId
  } = socket.handshake.auth;
  const event = 'chat response';

  const systemPrompt = `Let's dive into a learning session. You're a tutor skilled in guiding students towards understanding through insightful questions. Your approach is modern, concise, and engaging. I'm a student looking to grasp a topic.
  Your guidelines are:

  - Maintain a friendly and helpful tone without being overly formal or patronizing.
  - Always end your responses with a relevant question, even if I indicate understanding. This keeps the conversation open-ended.
  - Be attentive to any confusion and adjust the discussion accordingly.
  - Stay in character throughout our interaction, never breaking the flow with closing statements.

  I'm studying ${subject} and I need help with ${topic}. I'm a ${level} college student.
  Our dialogue so far: {history}
  Student: {input}
  Tutor:`;

  let conversationId = convoId;
  let isNewChat;

  if (!convoId) {
    conversationId = await createNewConversation({
      referenceId: studentId,
      reference: 'student',
      topic,
      subject,
      level
    }).then((convo) => convo?.id);
    isNewChat = true;
  }

  console.log(conversationId);
  const chats = await paginatedFind(
    ChatLog,
    {
      studentId,
      conversationId
    },
    { limit: 10 }
  );

  console.log(chats);

  const lastTenChats = chats.map((chat: any) => chat.log).reverse();

  const pastMessages: any[] = [];

  lastTenChats.forEach((message: any) => {
    if (message.role === 'assistant')
      pastMessages.push(new AIChatMessage(message.content));
    if (message.role === 'user')
      pastMessages.push(new HumanChatMessage(message.content));
  });

  console.log(lastTenChats);

  const model = socketAiModel(socket, event);

  socket.emit('ready', true);

  const memory = new BufferMemory({
    chatHistory: new ChatMessageHistory(pastMessages)
  });

  const prompt = new PromptTemplate({
    template: systemPrompt,
    inputVariables: ['history', 'input']
  });

  const chain = new ConversationChain({
    llm: model,
    memory,
    prompt
  });

  socket.on('chat message', async (message) => {
    const isFirstConvo = pastMessages.length === 0;
    if (
      (!isFirstConvo && message !== CONVERSATION_STARTER_TEXT) ||
      (isFirstConvo && message === CONVERSATION_STARTER_TEXT)
    ) {
      const answer = await chain.call({ input: message });
      console.log(lastTenChats);
      socket.emit(`${event} end`, answer?.response);

      const hasTitle = await chatHasTitle(conversationId);

      if (!hasTitle) {
        const title = await llmCreateConversationTitle(message, topic, memory);
        storeChatTitle(conversationId, title);
      }

      const userQuery = wrapForQL('user', message);
      const assistantResponse = wrapForQL('assistant', answer?.response);

      pastMessages.push(new HumanChatMessage(message));
      pastMessages.push(new AIChatMessage(answer?.response));

      Promise.all([
        await createNewChat({
          studentId,
          log: userQuery,
          conversationId
        }),
        await createNewChat({
          studentId,
          log: assistantResponse,
          conversationId
        })
      ]);
    }
  });
});
