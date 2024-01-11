import express from 'express';
import config from 'config';
import { saveHighlightComment } from '../../db/models/highlights';
import { Request, Response, NextFunction } from 'express';
import { embedding, pineconeIndex } from '../routes/index';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAI } from 'langchain/llms/openai';
import { OpenAIConfig } from 'src/types/configs';
import validate from '../validation/index';
import Schema from '../validation/schema';
import {
  createOrUpdateHighlight,
  getHighlights,
  getHighlight
} from '../../db/models/highlights';

const { highlights, commentGenerateSchema, commentSaveSchema } = Schema;
const highlight = express.Router();

interface Query {
  documentId: string;
}

const openAIConfig: OpenAIConfig = config.get('openai');

highlight.post(
  '/',
  validate(highlights),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { documentId, highlight } = req.body;

      const data = await createOrUpdateHighlight({ documentId, highlight });

      res.send({ status: 'Highlight successfully created!', data });
    } catch (e: any) {
      next({
        message:
          "Check that your documentId matches an actual document, and that you're correctly supplying the highlight payload"
      });
    }
  }
);

highlight.post(
  '/comment/generate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId, highlightText, studentId } = req.body;
      const isValid = [documentId, highlightText, studentId].every(Boolean);
      if (!isValid) {
        throw new Error(
          'documentId, highlightText, and studentId are required.'
        );
      }

      const getDocumentVectorStore = async ({
        studentId,
        documentId
      }: {
        studentId: string;
        documentId: string;
      }) => {
        // Implement the logic to fetch document content from vector store
        return PineconeStore.fromExistingIndex(embedding, {
          pineconeIndex,
          namespace: studentId,
          filter: { documentId: { $eq: `${documentId}` } }
        });
      };

      let topK = 50;

      const vectorStore = await getDocumentVectorStore({
        studentId,
        documentId
      });
      const getDocs = () => vectorStore.similaritySearch(highlightText, topK);

      let document = await getDocs();
      const model = new OpenAI({
        temperature: 0.5,
        openAIApiKey: openAIConfig.apikey,
        modelName: 'text-davinci-003' // Or whatever the appropriate GPT-4 model name is
      });

      const prompt = `With context from this document: ${JSON.stringify(
        document
      )}. Help me understand this text in simpler terms, then explain why it is important: ${highlightText}.`;

      const generateComment = async (): Promise<any> => {
        try {
          const response = await model.call(prompt);
          res.json({ comment: response });
          res.end();
        } catch (e: any) {
          if (e?.response?.data?.error?.code === 'context_length_exceeded') {
            if (topK === 0) {
              throw new Error('Top K cannot go lower than zero');
            }
            topK -= 10;
            document = await getDocs();
            return await generateComment();
          } else {
            throw new Error(JSON.stringify(e));
          }
        }
      };

      await generateComment();
    } catch (e: any) {
      next({
        message: e.message
      });
    }
  }
);

highlight.post(
  '/comment/save',
  validate(commentSaveSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { highlightId, content, studentId, highlight, documentId } = req.body;

      if (!highlightId) {
        if (!highlight) {
          throw new Error('Either Highlight or highlightId is required.');
        }
        if (!documentId) {
          throw new Error(
            'documentId is required if you are saving a new highlight.'
          );
        }
      }
      highlight = await createOrUpdateHighlight({ highlight, documentId });
      highlightId = highlight.id;

      if (!highlightId || !content) {
        throw new Error('Highlight ID and comment are required.');
      }

      const savedComment = await saveHighlightComment({
        highlightId,
        content,
        studentId
      });

      res.send({
        status: 'Comment successfully saved!',
        data: savedComment,
        highlight
      });
    } catch (e: any) {
      console.log(e);
      next({
        message:
          'Failed to save the comment. Please make sure you are correctly supplying the highlightId and the comment.'
      });
    }
  }
);

highlight.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { documentId } = req.query as unknown as Query;

    if (!documentId)
      throw new Error('You need a documentId to retrieve document highlights!');

    const data = await getHighlights(documentId);

    res.send(data);
  } catch (e: any) {
    next(e);
  }
});

export default highlight;
