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
import PdfTextExtractor from './src/helpers/pdfTextExtractor';
import {
  summarizeNotePrompt,
  summarizeNoteSummariesPrompt
} from './src/helpers/promptTemplates/index';
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
import {
  getDocchatBalance,
  setDocchatBalance,
  getAItutorChatBalance,
  setAItutorChatBalance
} from './src/middleware/fermataCheck';

const CONVERSATION_STARTER_TEXT = 'Shall we begin, Socrates?';
// Setting up some general shit for global AI assistant usage
const wrapForQL = (role: 'user' | 'assistant', content: string) => ({
  role,
  content
});
const { apikey, model: modelName } = config.get('openai') as any;

const {
  bucketName,
  outputBucketName,
  snsRoleArn,
  snsTopicArn
}: { [key: string]: string } = config.get('textExtractor');

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
  const { studentId, documentId, firebaseId } = socket.handshake.auth;
  // console.log(socket.handshake.auth);

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

  socket.emit('ready', true);

  const currentChatBalance = await getDocchatBalance(firebaseId);
  if (!currentChatBalance || currentChatBalance < 1) {
    socket.emit('docchat_limit_reached', true);
  }

  // Done with setting up the chat AI requirements, so we can tell the client we're ready to discuss.

  const chats = await paginatedFind(
    ChatLog,
    {
      studentId,
      conversationId
    },
    { limit: 20 }
  );

  socket.on('fetch_history', async ({ limit, offset }) => {
    try {
      const chats = await paginatedFind(
        ChatLog,
        {
          studentId,
          conversationId
        },
        {
          limit,
          offset
        }
      );
      const mappedChatHistory = chats.map((history: any) => history);
      socket.emit('chat_history', JSON.stringify(mappedChatHistory));
    } catch (error: any) {
      socket.emit('fetch_history_error', { message: error.message });
    }
  });

  // Use the full chat history (all messages)
  const pastMessages: any[] = chats.map((chat: any) => {
    if (chat.log.role === 'assistant')
      return new AIChatMessage(chat.log.content);
    if (chat.log.role === 'user') return new HumanChatMessage(chat.log.content);
  });

  // Client sends us a chat message
  socket.on('chat message', async (message) => {
    const chatBalance = await setDocchatBalance(firebaseId);
    if (!chatBalance || chatBalance < 1) {
      socket.emit('docchat_limit_reached', true);
      return;
    }
    console.log('currentChatBalance', chatBalance);

    const userQuery = wrapForQL('user', message);
    const event = 'chat response';

    let topK = 30;

    let chain = docChatChain(event, topK);

    const question = `Using context from the PDF document supplied and the chat history provided, answer any questions the user asks — never make one up outside of the information provided. Make your answers brief, exciting and informative. Be charming and have a personality.
    
    Suggest follow-up discussions based on the information, and format them in bullet points of three discussions.
    
    Make your answers in markdown.

    Could you please also use the following specific LaTeX math mode delimiters in your response whenever returing equations and formulas?
    
    LaTex math mode specific delimiters as following
    display math mode: insert linebreak after opening '$$', '\[' and before closing '$$', '\]'

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
    const model = new ChatOpenAI({
      openAIApiKey: apikey,
      modelName: modelName
    });

    let answers = [];

    for (let SUMMARY_TOP_K = 50; SUMMARY_TOP_K >= 30; SUMMARY_TOP_K -= 10) {
      console.log('CURRENT TOP K', SUMMARY_TOP_K);
      const chain = RetrievalQAChain.fromLLM(
        model,
        vectorStore.asRetriever(SUMMARY_TOP_K)
      );

      try {
        const answer = await chain.call({ query: summarizeNotePrompt });
        if (answer?.text) {
          answers.push(answer.text);
        }
      } catch (error: any) {
        socket.emit('summary_generation_error', {
          message: 'Failed to generate summary',
          error: error.message
        });
        return;
      }
    }

    console.log('ANSWERS', answers);

    try {
      const summaryModel = socketAiModel(socket, 'summary');

      const chain = new ConversationChain({
        llm: summaryModel
      });

      const answer = await chain.call({
        input: `${summarizeNoteSummariesPrompt}. Here is the text: ${answers.join()}`
      });
      socket.emit('summary_done', true);

      try {
        await updateDocument({
          data: {
            summary: answer.response
          },
          referenceId: studentId,
          documentId
        });
      } catch (error) {
        console.log('ERROR CREATING', error);
      }
    } catch (error: any) {
      console.log('STORE SUMMARY FOR DOC FAULED');
      socket.emit('summary_generation_error', {
        message: 'Failed to summarize answers',
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
    name,
    level,
    conversationId: convoId,
    documentId,
    firebaseId
  } = socket.handshake.auth;
  console.log('studentId', studentId);
  const event = 'chat response';

  const currentChatBalance = await getAItutorChatBalance(firebaseId);
  if (!currentChatBalance || currentChatBalance < 1) {
    socket.emit('aitutorchat_limit_reached', true);
    return;
  }

  const getSystemPrompt = async (documentId?: string) => {
    const pdfTextExtractor = new PdfTextExtractor(
      bucketName,
      outputBucketName,
      studentId,
      snsTopicArn,
      snsRoleArn
    );
    let documentData;
    if (documentId) {
      documentData = await pdfTextExtractor.getTextFromDynamoDB(
        documentId,
        studentId
      );
    }

    const namePrompt = name ? `whose name is ${name}` : '';

    const systemPrompt = `Let's play a game: You are an upbeat, encouraging tutor who helps students understand concepts by explaining ideas and asking students questions. Start by introducing yourself to the student as their AI-Tutor  named "Socrates" who is happy to help them with any questions. Ask them what topic I want to understand and what level. Wait until they provide a response.  
    Then, to ensure a tailored learning experience, ask them to briefly share what they already know about the topic. Wait for a response. Following this, introduce a crucial step by asking them to evaluate their understanding of the foundational concepts related to the topic. Use a prompt like this:

    "Before we proceed, could you let me know how comfortable you are with the basic concepts underlying [mention the subject/topic]? This might include [list a few foundational topics or concepts]. It's okay if you're not familiar with some or all of these – I'm here to help you understand these fundamentals along the way as needed.”

    Given this information, help students understand the topic by providing explanations, examples, analogies, and questions tailored to their learning level and prior knowledge or what they already know about the topic.    
        
    Could you please also use the following specific LaTeX math mode delimiters in your response whenever returing equations and formulas?
    
    LaTex math mode specific delimiters as following
    display math mode: insert linebreak after opening '$$', '\[' and before closing '$$', \]
    
    You should guide students in an open-ended way. Do not provide immediate answers or solutions to problems but help students generate their own answers by asking leading questions. Ask students to explain their thinking. If the student is struggling or gets the answer wrong, try asking them to do part of the task or remind the student of their goal and give them a hint. If students improve, then praise them and show excitement. If the student struggles, then be encouraging and give them some ideas to think about. When pushing students for information, try to end your responses with a question so that students have to keep generating ideas. Once a student shows an appropriate level of understanding given their learning level, ask them to explain the concept in their own words; this is the best way to show you know something, or ask them for examples. When a student demonstrates that they know the concept you can move the conversation to a close and tell them you’re here to help if they have further questions
    
    I'm studying ${subject} and I need help with ${topic}. I'm a ${level} college student ${namePrompt}
    Our dialogue so far: {history}
    Student: {input}
    Tutor:`;
    return systemPrompt;
  };

  let systemPrompt = await getSystemPrompt(documentId);

  let conversationId = convoId;
  let isNewChat;

  if (!convoId) {
    conversationId = await createNewConversation({
      referenceId: studentId,
      reference: 'student',
      topic,
      subject,
      level
    })
      .then((convo) => convo?.id)
      .catch((error) => console.log(error));
    isNewChat = true;
    // socket.emit('new_conversation', conversationId);
  }

  socket.emit('current_conversation', conversationId);
  console.log('current_conversation', conversationId);
  console.log('studentId', studentId);

  const chats = await paginatedFind(
    ChatLog,
    {
      studentId,
      conversationId
    },
    {
      limit: 15
    }
  );

  socket.on('fetch_history', async ({ limit, offset }) => {
    try {
      const chats = await paginatedFind(
        ChatLog,
        {
          studentId,
          conversationId
        },
        {
          limit,
          offset
        }
      );
      const mappedChatHistory = chats.map((history: any) => history).reverse();
      console.log('MAPPED HISTORY', mappedChatHistory);
      socket.emit('chat_history', JSON.stringify(mappedChatHistory));
    } catch (error: any) {
      console.log(error);
      socket.emit('fetch_history_error', { message: error.message });
    }
  });

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

  socket.on('chat message', async (message) => {
    const chatBalance = await setAItutorChatBalance(firebaseId);
    if (!chatBalance || chatBalance < 1) {
      socket.emit('aitutorchat_limit_reached', true);
      return;
    }
    console.log('currentChatBalance', chatBalance);

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
  socket.emit('ready', true);
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

  let noteData = extractTextFromJson(note.note);

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

    Could you please also use the following specific LaTeX math mode delimiters in your response whenever returing equations and formulas?
    
    LaTex math mode specific delimiters as following
    display math mode: insert linebreak after opening '$$', '\[' and before closing '$$', \]

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

      noteData = extractTextFromJson(note.note);

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

  socket.on('generate summary', async () => {
    try {
      console.log('SUMMARIZING TEXT');
      const answer = await chatManager.summarizeText(noteData);
      console.log('SUMMARIZED TEXT', answer);
      socket.emit('new_note_summary', { summary: answer?.response });
    } catch (error: any) {
      console.error(`Error loading chats: ${error.message}`);
      socket.emit('summary_generation_error', {
        message: 'Failed to generate summary',
        error: error.message
      });
      return;
    }
  });
});
