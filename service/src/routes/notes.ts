import { createOrUpdateDocument } from './../../db/models/document';
import express from 'express';
import config from 'config';
import { Request, Response, NextFunction } from 'express';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { CharacterTextSplitter } from 'langchain/text_splitter';
// @ts-ignore
import pdf from 'pdf-parse';
// @ts-ignore
import mime from 'mime-types';
import validate from '../validation/index';
import schema from '../validation/schema';
import { OpenAIConfig } from '../types/configs';
import Models from '../../db/models';
import { OpenAI } from 'langchain/llms/openai';
import {
  retrieveDocument,
  updateDocument,
  deleteSummary
} from '../../db/models/document';
import fs from 'fs';
import paginatedFind from '../helpers/pagination';
import { summarizeNotePrompt } from '../helpers/promptTemplates/';
import { getChatConversationId } from '../../db/models/conversation';
import {
  fetchAllStudentChats,
  fetchSpecificStudentChat
} from '../../db/models/conversationLog';

const { DocumentModel: documents, ChatLog: chats } = Models;

const { ingest, summary, blockNotes, chatHistory, patchSummary } = schema;

interface Chats {
  log: Array<any>;
}

const openAIconfig: OpenAIConfig = config.get('openai');

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
      const { studentId, documentId } = req.query;

      const reference = documentId ? 'document' : 'student';

      const conversationId = await getChatConversationId({
        reference,
        // @ts-ignore
        referenceId: documentId || studentId
      });

      const chatHistory = await paginatedFind(
        chats,
        {
          studentId,
          conversationId
        },
        { limit: 50 }
      );

      const mappedChatHistory = chatHistory
        .map((history: Chats) => history.log)
        .reverse();

      res.send(mappedChatHistory);
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

      const reference = documentId ? 'document' : 'student';

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

      const chatHistory = await fetchSpecificStudentChat(conversationId);

      // const mappedChatHistory = chatHistory
      //   .map((history: Chats) => history.log)
      //   .reverse();

      res.send(chatHistory);
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
      const { document, studentId, documentId, courseId, title } = req.body;
      const documentURL = 'https://shepherd.com';
      const documentData = {
        reference: 'student',
        referenceId: studentId,
        documentId,
        courseId,
        title,
        documentURL
      };

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
      const { documentURL, studentId, title, documentId } = req.body;

      const { apiKey } = res.app.locals.config.get('unstructured');

      const { embeddingAI: embedding, pineconeIndex } = res.app.locals;

      const filePath = await createDocumentAndReturnFilePath(
        documentURL,
        studentId
      );

      const pdfdata = fs.readFileSync(filePath);

      const text = await pdf(pdfdata).then((data: any) => data.text);

      const splitter = new CharacterTextSplitter({
        chunkSize: 1536,
        chunkOverlap: 500
      });

      const chunks = await splitter.createDocuments([text], [{ documentId }]);

      let data: any = [];

      await PineconeStore.fromDocuments(chunks, embedding, {
        pineconeIndex,
        namespace: studentId
      }).then(async () => {
        data = await createOrUpdateDocument({
          reference: 'student',
          referenceId: studentId,
          ...req.body
        });
      });
      fs.unlink(filePath, (err) => {
        err && console.log('failed to delete file along path ', filePath);
        !err && console.log('successfully deleted');
      });

      res.send({
        message: `Successfully saved document titled '${title}' for '${studentId}'`,
        data
      });
    } catch (e) {
      next(e);
    }
  }
);

notes.delete(
  '/clear',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pineconeIndex } = res.app.locals;

      const { studentId } = req.body;

      if (!studentId)
        throw new Error('You gotta add a studentId in the body, yo.');

      const deleteRequest = await Promise.all([
        await pineconeIndex.delete1({
          deleteAll: true,
          namespace: studentId
        }),
        await documents.destroy({
          where: {
            referenceId: studentId
          }
        })
      ]).then((res) => ({
        message: `All documents cleared for student with id ${studentId}`,
        data: res
      }));

      res.send(deleteRequest);
    } catch (e) {
      next(e);
    }
  }
);

export default notes;
