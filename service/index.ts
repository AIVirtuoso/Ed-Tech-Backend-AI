import { ai, PORT, server, embedding, pineconeIndex } from './src/routes/index';
import { Server } from 'socket.io';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { PromptTemplate } from 'langchain/prompts';
import { chatWithNotePrompt } from './src/helpers/promptTemplates/index';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import ChatManager from './src/helpers/chatManager';
import fetchNote from './src/helpers/getNote';
import extractTextFromJson from './src/helpers/parseNote';
import ChatLog, { createNewChat } from './db/models/conversationLog';
import { HumanChatMessage, AIChatMessage } from 'langchain/schema';
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
import config from 'config';
import paginatedFind from './src/helpers/pagination';
import llmCreateConversationTitle from './src/helpers/llmFunctions/createConversationTitle';

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

async function chatWithModel(
  systemPrompt: string,
  conversationId: string,
  studentId: string,
  socket: any,
  event: string
) {
  const chats = await paginatedFind(
    ChatLog,
    {
      studentId,
      conversationId
    },
    { limit: 10 }
  );

  const lastTenChats = chats.map((chat: any) => chat.log).reverse();

  const pastMessages: any[] = [];

  lastTenChats.forEach((message: any) => {
    if (message.role === 'assistant')
      pastMessages.push(new AIChatMessage(message.content));
    if (message.role === 'user')
      pastMessages.push(new HumanChatMessage(message.content));
  });

  const model = socketAiModel(socket, event, 'gpt-4-0613');

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

  return { chain, model, prompt };
}

const socketAiModel = (socket: any, event: string, model?: string) => {
  return new ChatOpenAI({
    openAIApiKey: apikey,
    modelName: model || modelName,
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

const noteWorkspaceNamespace = io.of('/note-workspace');

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

  const chats = await paginatedFind(
    ChatLog,
    {
      studentId,
      conversationId
    },
    { limit: 20 }
  );

  // Use the full chat history (all messages)
  const pastMessages: any[] = chats.map((chat: any) => {
    if (chat.log.role === 'assistant')
      return new AIChatMessage(chat.log.content);
    if (chat.log.role === 'user') return new HumanChatMessage(chat.log.content);
  });

  // Client sends us a chat message
  socket.on('chat message', async (message) => {
    const userQuery = wrapForQL('user', message);
    const event = 'chat response';

    let topK = 30;

    let chain = docChatChain(event, topK);

    const question = `Using context from the PDF document supplied and the chat history provided, answer any questions the user asks — never make one up outside of the information provided. Make your answers brief, exciting and informative. Be charming and have a personality.
    
    Suggest follow-up discussions based on the information, and format them in bullet points of three discussions.
    
    Make your answers in markdown.

    Do not discuss with me. If I send you a message that does not seem like  a question about the document or from the history of the chat so far, respond with a variation of: 'I'm sorry, that is not a question about this document. Would you like to ask me something about this document?'
    
    If the user asks for more information use chat history and the information in document to provide more information. 

    this is the history of the chat so far: ${pastMessages}
    
    My question is: ${message}

    
    Your answer:`;

    const callChain = async () =>
      await chain
        .call({ question })
        .then(async (response) => {
          socket.emit(`${event} end`, response?.text);
          const assistantResponse = wrapForQL('assistant', response?.text);

          pastMessages.push(new HumanChatMessage(message));
          pastMessages.push(new AIChatMessage(response?.text));

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
            chain = docChatChain(event, topK);
            return await callChain();
          }

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

    try {
      const answer = await chain.call({ query: summarizeNotePrompt });
      await updateDocument({
        data: {
          summary: answer?.text
        },
        referenceId: studentId,
        documentId
      });
    } catch (error: any) {
      socket.emit('summary_generation_error', {
        message: 'Failed to generate summary',
        error: error.message
      });
    }
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

  const systemPrompt = `Let's play a game: You are an upbeat, encouraging tutor who helps students understand concepts by explaining ideas and asking students questions. Start by introducing yourself to the student as their AI-Tutor  named "Socrates" who is happy to help them with any questions. Ask them what topic I want to understand and what level. Wait until they provide a response.  Then Ask them what they know already about the topic they have chosen. Wait for a response. Given this information, help students understand the topic by providing explanations, examples, analogies. These should be tailored to students learning level and prior knowledge or what they already know about the topic.
  Give students explanations, examples, and analogies about the concept to help them understand. You should guide students in an open-ended way. Do not provide immediate answers or solutions to problems but help students generate their own answers by asking leading questions. Ask students to explain their thinking. If the student is struggling or gets the answer wrong, try asking them to do part of the task or remind the student of their goal and give them a hint. If students improve, then praise them and show excitement. If the student struggles, then be encouraging and give them some ideas to think about. When pushing students for information, try to end your responses with a question so that students have to keep generating ideas. Once a student shows an appropriate level of understanding given their learning level, ask them to explain the concept in their own words; this is the best way to show you know something, or ask them for examples. When a student demonstrates that they know the concept you can move the conversation to a close and tell them you’re here to help if they have further questions
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
    // socket.emit('new_conversation', conversationId);
  }

  socket.emit('current_conversation', conversationId);

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

  const model = socketAiModel(socket, event, 'gpt-4-0613');

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
        }),
        () => Promise.resolve(socket.emit('saved conversation', true))
      ]);
    }
  });
});

noteWorkspaceNamespace.on('connection', async (socket) => {
  console.log('Socket connected');

  const {
    studentId,
    noteId,
    conversationId: convoId,
    isDevelopment
  } = socket.handshake.auth;
  const event = 'chat response';
  let conversationId = convoId;

  if (!noteId) {
    console.error('Note id is required');
    socket.emit('error', 'Note id is required');
    return;
  }

  let note;

  console.log(isDevelopment);

  try {
    console.log(`Fetching note for noteId: ${noteId}`);
    note = await fetchNote(noteId, isDevelopment);
  } catch (error: any) {
    console.error(`Error fetching note: ${error}`);
    socket.emit('error', error.message);
    return;
  }

  if (!convoId) {
    console.log(`Creating new conversation for studentId: ${studentId}`);
    try {
      conversationId = await getChatConversationId({
        referenceId: noteId,
        reference: 'note'
      });

      // if (!conversationId) {
      //   conversationId = await createNewConversation({
      //     referenceId: noteId,
      //     reference: 'note'
      //   }).then((convo) => convo?.id);
      // }
    } catch (error: any) {
      console.error(`Error creating new conversation: ${error.message}`);
      socket.emit('error', error.message);
      return;
    }
  }

  socket.emit('current_conversation', conversationId);
  console.log(`Emitted current conversation: ${conversationId}`);

  const hasContent = Boolean(note?.note);
  if (!hasContent) {
    console.log(note);
    console.error('Note has no content');
    socket.emit('error', 'Note has no content');
    return;
  }

  const noteData = extractTextFromJson(note.note);

  console.log(noteData);

  const systemPrompt = chatWithNotePrompt(noteData);

  const chatManager = new ChatManager(
    socket,
    event,
    systemPrompt,
    studentId,
    conversationId
  );

  try {
    console.log(`Loading chats for conversationId: ${conversationId}`);
    await chatManager.loadChats();
  } catch (error: any) {
    console.error(`Error loading chats: ${error.message}`);
    socket.emit('error', error.message);
    return;
  }

  let { chain, model, pastMessages } = await chatManager.loadModel();

  socket.on('chat message', async (message) => {
    console.log(`Received chat message: ${message}`);

    const question = `Using context from the note: [${noteData}] supplied and the chat history provided, answer any questions the user asks — never make one up outside of the information provided. Make your answers brief, exciting and informative. Be charming and have a personality.
    
    Suggest follow-up discussions based on the information, and format them in bullet points of three discussions.
    
    Make your answers in markdown.

    Do not discuss with me. If I send you a message that does not seem like  a question about the document or from the history of the chat so far, respond with a variation of: 'I'm sorry, that is not a question about this document. Would you like to ask me something about this document?'
    
    If the user asks for more information use chat history and the information in document to provide more information. 

    this is the history of the chat so far: ${pastMessages}
    
    My question is: ${message}

    
    Your answer:`;

    try {
      const answer = await chain.call({
        input: question
      });
      socket.emit(`${event} end`, answer?.response);

      // Logging and persisting chat in the database
      const userQuery = wrapForQL('user', message);
      const assistantResponse = wrapForQL('assistant', answer?.response);

      chatManager.addChat(new HumanChatMessage(message));
      chatManager.addChat(new AIChatMessage(answer?.response));

      await Promise.all([
        createNewChat({
          studentId,
          log: userQuery,
          conversationId
        }),
        createNewChat({
          studentId,
          log: assistantResponse,
          conversationId
        })
      ]);
      console.log('Chats saved to database');
      socket.emit('saved conversation', true);
    } catch (error: any) {
      console.error(`Error during chat message processing: ${error.message}`);
      socket.emit('error', error.message);
    }
  });

  socket.on('refresh_note', async () => {
    console.log('Refreshing note...');
    try {
      socket.emit('refresh_status', { status: 'REFRESH_LOADING' });
      note = await fetchNote(noteId, isDevelopment);

      const prompt = chatWithNotePrompt(extractTextFromJson(note.note));
      chatManager.setSystemPrompt(prompt);

      // Load model with updated information
      const data = await chatManager.loadModel();
      pastMessages = data.pastMessages;
      chain = data.chain;
      model = data.model;

      console.log('Note refreshed successfully');
      socket.emit('refresh_status', { status: 'REFRESH_DONE' });
    } catch (error: any) {
      console.error(`Error refreshing note: ${error.message}`);
      socket.emit('refresh_status', {
        status: 'REFRESH_ERROR',
        error: error.message
      });
    }
  });

  socket.on('generate_summary', async () => {
    try {
      try {
        const answer = await chatManager.summarizeText(noteData);
        socket.emit('new_note_summary', { summary: answer?.text });
      } catch (error: any) {
        console.error(`Error loading chats: ${error.message}`);
        socket.emit('summary_generation_error', {
          message: 'Failed to generate summary',
          error: error.message
        });
        return;
      }
    } catch (error: any) {
      socket.emit('summary_generation_error', {
        message: 'Failed to generate summary',
        error: error.message
      });
    }
  });
});
