import { createOrUpdateDocument } from '../../db/models/document';
import express from 'express';
import config from '../../config/index';
import { Request, Response, NextFunction } from 'express';
import PDFTextExtractor from '../helpers/pdfTextExtractor';
import { toggleChatPin, getPinnedChats } from '../../db/models/conversationLog';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import LocalPDFExtractor from '../services/localExtractor';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

import { uuid } from 'uuidv4';
// @ts-ignore
import pdf from 'pdf-parse';
// @ts-ignore
import mime from 'mime-types';
import validate from '../validation/index';
import schema from '../validation/schema';
import { OpenAIConfig } from '../types/configs';
import Models from '../../db/models';
import { OpenAI } from 'langchain/llms/openai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { OPENAI_MODELS, USER_REFERENCE } from '../helpers/constants';
import {
  retrieveDocument,
  updateDocument,
  deleteSummary
} from '../../db/models/document';
import fs from 'fs';
import paginatedFind from '../helpers/pagination';
import { summarizeNotePrompt } from '../helpers/promptTemplates/';
import {
  chatHasTitle,
  deleteConversation,
  getChatConversationId,
  storeChatTitle,
  getDocumentHistory,
  getTextNoteHistory
} from '../../db/models/conversation';
import {
  fetchAllStudentChats,
  fetchSpecificStudentChat,
  handleReaction
} from '../../db/models/conversationLog';
import { database, credential } from 'firebase-admin';
import { AIChatMessage, HumanChatMessage } from 'langchain/schema';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import llmCreateConversationTitle from '../helpers/llmFunctions/createConversationTitle';
import generateConversationDescription from '../helpers/llmFunctions/getConversationDescription';
import { fetchNotes } from '../helpers/getNote';
import serviceAccount from '../../config/serviceAccountKeys.json';

if (!getApps().length) {
  initializeApp({
    credential: credential.cert(serviceAccount as any),
    databaseURL: 'https://shepherd-app-382114-default-rtdb.firebaseio.com'
  });
}

const db = database();

const { DocumentModel: documents, ChatLog: chats } = Models;

const {
  ingest,
  summary,
  blockNotes,
  chatHistory,
  patchSummary,
  editHistoryTitle
} = schema;
interface Chats {
  log: Array<any>;
}

const openAIconfig: OpenAIConfig = config.openai;

const {
  bucketName,
  outputBucketName,
  snsRoleArn,
  snsTopicArn
}: { [key: string]: string } = config.textExtractor;

const createDocumentAndReturnFilePath = async (
  documentURL: string,
  documentId: string
) => {
  const fetchResponse = await fetch(documentURL);
  const documentType = fetchResponse.headers.get('Content-Type');

  const mimeType = mime.extension(documentType);
  const docBuffer = await fetchResponse.arrayBuffer();
  const docBinary = Buffer.from(docBuffer);
  const filePath = __dirname + `/temp/${documentId}.${mimeType}`;
  fs.writeFileSync(filePath, docBinary, 'binary');

  return filePath;
};

const updateProgressLog = async (progressLogId: string, updateData: any) => {
  const progressDbName = 'ingest-progress-log';
  const progressDb = db.ref(progressDbName);
  await progressDb.child(progressLogId).update(updateData);
};

const notes = express.Router();

notes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.query;

    if (!studentId) throw new Error('No studentId present in request!');

    const studentDocs = await paginatedFind(documents, {
      referenceId: studentId
    });

    res.send(studentDocs);
  } catch (e: any) {
    next(e);
  }
});

notes.get(
  '/chat/history',
  validate(chatHistory),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentId, noteId } = req.query;

      const reference = (() => {
        if (documentId) return USER_REFERENCE.DOCUMENT;
        if (noteId) return USER_REFERENCE.NOTE;
        return USER_REFERENCE.STUDENT;
      })();

      const conversationId = await getChatConversationId(
        {
          reference,
          // @ts-ignore
          referenceId: documentId || noteId || studentId
        },
        false
      );

      if (!conversationId) {
        res.send([]);
      }

      const chatHistory = await paginatedFind(
        chats,
        {
          studentId,
          conversationId
        },
        { limit: 50 }
      );

      const mappedChatHistory = chatHistory
        .map((history: Chats) => history)
        .reverse();

      res.send(mappedChatHistory);
    } catch (e: any) {
      next(e);
    }
  }
);

notes.get(
  '/chat/document_history',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentType } = req.query;

      if (!studentId) throw new Error('No studentId present in request!');

      const env = (req.query.env || '') as string;

      const isDevelopment = env?.includes('dev');

      const notes = await fetchNotes(
        studentId as string,
        isDevelopment as boolean
      ).catch((error) => console.log(error));
      if (!notes || notes.length === 0) {
        throw new Error('This student has no note');
      }
      const notesIds = notes.map((note: any) => note._id);
      const noteReferences = await getTextNoteHistory(notesIds);

      const docNotes = notes.filter((note: any) =>
        noteReferences.includes(note._id)
      );
      const data = docNotes.map((doc: any) => ({
        ...doc,
        title: doc.topic,
        type: 'note'
      }));

      const studentDocs = await getDocumentHistory(studentId as string);
      const studentFiles = studentDocs.map((doc: any) => ({
        ...doc.dataValues,
        type: 'file'
      }));
      const newData = [...studentFiles, ...data];

      res.send(newData);
    } catch (e: any) {
      next(e);
    }
  }
);

notes.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentId } = req.query;

      const reference = documentId
        ? USER_REFERENCE.DOCUMENT
        : USER_REFERENCE.STUDENT;

      const conversationId = await getChatConversationId({
        reference,
        // @ts-ignore
        referenceId: documentId || studentId
      });

      // @ts-ignore
      const chatHistory = await fetchAllStudentChats({ studentId });

      // const mappedChatHistory = chatHistory
      //   .map((history: Chats) => history.log)
      //   .reverse();

      res.send(chatHistory);
    } catch (e: any) {
      next(e);
    }
  }
);

notes.get(
  '/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;

      let chatHistory = await fetchSpecificStudentChat(conversationId);

      const hasTitle = await chatHasTitle(conversationId);
      if (!hasTitle) {
        const pastMessages: any[] = [];

        const mappedChatHistory = chatHistory
          .map((history: Chats) => history.log)
          .reverse();

        mappedChatHistory.forEach((message: any) => {
          if (message.role === 'assistant')
            pastMessages.push(new AIChatMessage(message.content));
          if (message.role === 'user')
            pastMessages.push(new HumanChatMessage(message.content));
        });

        const memory = new BufferMemory({
          chatHistory: new ChatMessageHistory(pastMessages)
        });
        const title = await llmCreateConversationTitle('', undefined, memory);
        await storeChatTitle(conversationId, title);
        chatHistory = await fetchSpecificStudentChat(conversationId);
      }

      // const mappedChatHistory = chatHistory
      //   .map((history: Chats) => history.log)
      //   .reverse();

      res.send(chatHistory);
    } catch (e: any) {
      next(e);
    }
  }
);

notes.delete(
  '/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;

      // Assuming you have a function to delete the chat conversation in your database
      await deleteConversation(conversationId);

      res.send({
        message: `Successfully deleted conversation with id ${conversationId}`
      });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.post(
  '/toggle_pin',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chatId, studentId } = req.body;
      await toggleChatPin(chatId, studentId);
      res.status(200).send({ message: 'Chat pinned successfully!' });
    } catch (error) {
      next(error);
    }
  }
);

notes.get(
  '/pinned_chat',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.query;
      const pinnedChats = await getPinnedChats(studentId as string);
      res.status(200).send({ data: pinnedChats });
    } catch (error) {
      next(error);
    }
  }
);

notes.post(
  '/conversations/:conversationId/update',
  validate(editHistoryTitle),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;
      const { newTitle } = req.body; // Assuming you are sending the new title in the request body

      if (!newTitle)
        throw new Error(`New title not provided! ${JSON.stringify(req.body)}`);

      // Assuming you have a function to update the title of the chat conversation in your database
      await storeChatTitle(conversationId, newTitle);

      res.send({
        message: `Successfully updated title for conversation with id ${conversationId}`,
        updatedTitle: newTitle
      });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.post(
  '/summary/generate',
  validate(summary),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentId } = req.body;

      const referenceId = studentId;
      // @ts-ignore
      const document = await retrieveDocument({ referenceId, documentId });

      if (!document)
        throw new Error(
          `No document with id ${documentId} for student with id ${studentId}`
        );

      const model = new OpenAI({
        temperature: 0.9,
        openAIApiKey: openAIconfig.apikey,
        modelName: 'gpt-3.5-turbo-16k-0613'
      });

      const prompt = summarizeNotePrompt;

      const summary = await model.call(prompt);

      await updateDocument({
        data: {
          summary
        },
        // @ts-ignore
        referenceId,
        // @ts-ignore
        documentId
      });

      res.send({ summary });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.get(
  '/conversations/:conversationId/description',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;

      const pastMessages: any[] = [];

      let chatHistory = await fetchSpecificStudentChat(conversationId);

      const chatInfo: any[] = [];

      const mappedChatHistory = chatHistory
        .map((history: Chats) => history.log)
        .reverse();

      mappedChatHistory.forEach((message: any) => {
        if (message.role === 'user') {
          chatInfo.push(`student: ${message.content}`);
          pastMessages.push(new HumanChatMessage(message.content));
        } else {
          chatInfo.push(`tutor: ${message.content}`);
          pastMessages.push(new AIChatMessage(message.content));
        }
      });

      const memory = new BufferMemory({
        chatHistory: new ChatMessageHistory(pastMessages)
      });
      const description = await generateConversationDescription(
        chatInfo.join('-'),
        memory
      );

      res.send({
        data: description,
        pastMessages
      });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.post(
  '/chat/toggle_reaction',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chatId, reactionType } = req.body;
      if (!chatId || !reactionType)
        throw new Error('chatId and reactionType required!');

      if (!['like', 'dislike'].includes(reactionType))
        throw new Error('reactionType must be either "like" or "dislike"');
      const chat = await handleReaction(chatId, reactionType as 'like');
      res.send({ chat });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.get(
  '/summary',
  validate(chatHistory),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentId } = req.query;

      const referenceId = studentId;
      // @ts-ignore
      const document = await retrieveDocument({ referenceId, documentId });

      if (!document)
        throw new Error(
          `Cannot retrieve summary for document as it doesn't exist for this student!`
        );

      res.send({ summary: document?.summary });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.delete(
  '/summary',
  validate(chatHistory),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentId } = req.query;

      const referenceId = studentId;
      // @ts-ignore
      await deleteSummary({ referenceId, documentId });
      res.send({
        message: `Successfully deleted summary for document with id ${documentId}`
      });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.patch(
  '/summary',
  validate(patchSummary),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, documentId, summary } = req.body;

      if (!summary) throw new Error('No summary supplied!');

      const referenceId = studentId;
      // @ts-ignore
      await updateDocument({ data: { summary }, referenceId, documentId });

      res.send({ summary });
    } catch (e: any) {
      next(e);
    }
  }
);

notes.post(
  '/create',
  validate(blockNotes),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { document, studentId, documentId, title } = req.body;
      const documentData = req.body;
      const wrapText = document.map((document: string) => {
        return {
          pageContent: document,
          metadata: {
            documentId
          }
        };
      });

      const { embeddingAI: embedding, pineconeIndex } = res.app.locals;

      Promise.all([
        await PineconeStore.fromDocuments(wrapText, embedding, {
          pineconeIndex,
          namespace: studentId
        }),
        await createOrUpdateDocument(documentData)
      ]).then((results) => {
        res.send({
          message: `Successfully saved document titled '${title}' for '${studentId}'`,
          data: results[1]
        });
      });
    } catch (e) {
      next(e);
    }
  }
);

notes.post(
  '/ingest',
  validate(ingest),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { documentURL, studentId, title, progressLogId } = req.body;

      const documentId = uuid();
      const progressDbName = 'ingest-progress-log';

      const startTime = Date.now();

      if (!progressLogId) {
        const job = db.ref(progressDbName).push();
        progressLogId = job.key;
      }

      let text: string | null = null;
      let filePath: any | undefined;

      updateProgressLog(progressLogId, { status: 'Text Extraction Started' });

      const pdfTextExtractor = new PDFTextExtractor(
        bucketName,
        outputBucketName,
        studentId,
        snsTopicArn,
        snsRoleArn
      );

      const localTextExtractor = new LocalPDFExtractor();
      const extractorInfo = await localTextExtractor.extractText(documentURL);

      if (extractorInfo.status === 'success') {
        if (extractorInfo.lineCount >= 20) {
          text = extractorInfo.text;
        }
      }

      if (!text) {
        updateProgressLog(progressLogId, {
          status: 'Image Scanning Started, this may take a long time'
        });
        const jobId = await pdfTextExtractor
          .extractTextFromPDF(documentURL, studentId, documentId)
          .catch(() => {
            return undefined;
          });
        if (jobId) {
          text = await pdfTextExtractor.getTextFromJob(jobId);
          await pdfTextExtractor.storeJobDetailsInDynamoDB(documentURL, text);
        } else {
          // Fallback mechanism to read the PDF directly
          filePath = await createDocumentAndReturnFilePath(
            documentURL,
            studentId
          );
          const pdfdata = fs.readFileSync(filePath);
          text = await pdf(pdfdata).then((data: any) => data.text);
        }
      }

      if (!text) {
        return res.json({ message: 'Failed to extract' });
      }

      const { embeddingAI: embedding, pineconeIndex } = res.app.locals;

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 512,
        chunkOverlap: 20
      });

      const chunks = await splitter.createDocuments([text], [{ documentId }]);

      // Calculate max text length
      const maxTextLength = 4050;

      // Trim the text if it exceeds the max length
      if (text.length > maxTextLength) {
        text = text.substring(0, maxTextLength);
      }
      // Generate keywords using openai
      const openAImodel = new OpenAI({
        openAIApiKey: openAIconfig.apikey,
        modelName: 'gpt-3.5-turbo'
      });

      const prompt = `Please provide a list of at least 20 relevant keywords for the following text. 
      Each keyword should be only one word, unless there is a highly pertinent paring of words that occur frequently in the document.
      The keywords selected should be in comma-separated format and reflect the main ideas or subjects discussed in the text. 
      The keywords should be insightful and pertinent to the text, capturing the core themes, concepts, topics or opportunities for contextual depth.
      Please return the keywords in a comma-separated format without any trailing punctuation.:\n\n${text}`;

      // Call OpenAI to generate keywords
      let keywords: string[];

      try {
        updateProgressLog(progressLogId, {
          status: 'Extracting Keywords'
        });
        const response = await openAImodel.call(prompt);

        keywords = response.split(',').map((kw: string) => kw.trim());
      } catch (error) {
        keywords = [];
      }

      let data: any = [];
      // const { pineconeIndex, embeddingAI: embedding } = res.app.locals;

      // Create or update the document using keywords
      await PineconeStore.fromDocuments(chunks, embedding, {
        pineconeIndex,
        namespace: studentId
      })
        .then(async () => {
          data = await createOrUpdateDocument({
            reference: USER_REFERENCE.STUDENT,
            referenceId: studentId,
            documentId,
            title,
            documentURL,
            keywords
          });
        })
        .catch((e) => {
          console.log('erroror ====? ', e.stack);
          return next(Error(e.stack));
        });

      if (filePath) {
        fs.unlink(filePath, (err) => {
          err && console.log('failed to delete file along path ', filePath);
          !err && console.log('successfully deleted');
        });
      }

      const endTime = Date.now();
      const ingestDuration = Math.round((endTime - startTime) / 1000); // Duration in seconds
      await updateProgressLog(progressLogId, {
        jobProgress: 'completed',
        ingestDuration: `${ingestDuration} seconds`
      });

      res.send({
        message: `Successfully saved document with id ${documentId} titled '${title}' for student with id '${studentId}`,
        data,
        response: data[0]
      });
    } catch (e: any) {
      console.log(e.message);
      console.log(e.stack);
      next(e);
    }
  }
);

notes.delete(
  '/clear',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // SUPER-NUKE all student chat and document records — both on Pinecone and on Postgres. Only useful for debugging.
      const { pineconeIndex } = res.app.locals;

      const { studentId } = req.query;

      if (!studentId) throw new Error('sudentId required.');

      const conversationId = await getChatConversationId({
        reference: USER_REFERENCE.STUDENT,
        // @ts-ignore
        referenceId: studentId
      });

      const deleteRequest = await Promise.all([
        await pineconeIndex.delete1({
          deleteAll: true,
          namespace: studentId
        }),
        await documents.destroy({
          where: {
            referenceId: studentId
          }
        }),
        await chats.destroy({
          where: {
            conversationId
          }
        })
      ]).then((res) => ({
        message: `Successfully executed request to delete chats, documents and embeddings for student with id ${studentId}`,
        data: res
      }));

      res.send(deleteRequest);
    } catch (e) {
      next(e);
    }
  }
);

// notes.get(
//   '/keywords',
//   validate(Schema.docsSchema),
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { studentId, documentId } = req.body;

//       const referenceId = studentId;
//       // @ts-ignore
//       const document = await retrieveDocument({ referenceId, documentId });

//       const note = document?.document;
//       const keywords = document?.keywords;

//       if (!!keywords) return res.send(keywords);

//       if (!!note) {
//         const model = new OpenAI({
//           temperature: 0,
//           openAIApiKey: openAIconfig.apikey,
// modelName: OPENAI_MODELS.GPT_3_5_16K
//         });

//         const prompt = generateDocumentKeywordsPrompt(note);

//         const keywords = await model.call(prompt);

//         await updateDocument({
//           referenceId,
//           documentId,
//           data: {
//             keywords
//           }
//         }).catch((e) => next(e));
//         return res.send(JSON.parse(keywords));
//       } else return res.send([]);
//     } catch (e: any) {
//       res.send([]);
//     }
//   }
// );

export default notes;
