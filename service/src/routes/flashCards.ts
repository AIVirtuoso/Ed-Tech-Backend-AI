import express from 'express';
import config from '../../config/index';
import { Request, Response, NextFunction } from 'express';
import { embedding, pineconeIndex } from '../routes/index';
import { OpenAI } from 'langchain/llms/openai';
import validate from '../validation/index';
import Schema from '../validation/schema';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAIConfig } from 'src/types/configs';
import Models from '../../db/models';
import { OPENAI_MODELS, FLASHCARD_DIFFICULTY } from '../helpers/constants';
import {
  generalFlashcardPrompt,
  flashCardsFromNotesPrompt,
  flashCardsFromDocsPrompt
} from '../helpers/promptTemplates';
import extractTextFromJson from '../helpers/parseNote';
import fetchNote from '../helpers/getNote';
import { Languages } from 'src/types';

const openAIconfig: OpenAIConfig = config.openai;

const flashCards = express.Router();

flashCards.post(
  '/students/:studentId',
  validate(Schema.queryEmbeddingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lang = req.query.lang as Languages;
      let { topic, count, subject, existingQuestions, subTopics } = req.body;

      let difficulty = req.body?.difficulty || FLASHCARD_DIFFICULTY.COLLEGE;

      const model = new OpenAI({
        temperature: 0.9,
        openAIApiKey: openAIconfig.apikey,
        modelName: req.gptVersion
      });

      const flashCardPrompt = generalFlashcardPrompt(
        count,
        difficulty,
        subject,
        topic,
        existingQuestions,
        subTopics,
        lang
      );

      const response = await model.call(flashCardPrompt);

      res.send(JSON.parse(response));
      res.end();
    } catch (e) {
      next(e);
    }
  }
);

flashCards.post(
  '/generate-from-plain-notes',
  validate(Schema.generateFromNotesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lang = req.query.lang as Languages;
      const { count, noteId, existingQuestions } = req.body;
      const { env: userEnv } = req.query;
      let note;
      try {
        const env = (userEnv || '') as string;
        const isDevelopment = !userEnv ? false : env.includes('develop');
        note = await fetchNote(noteId, isDevelopment);
      } catch (error: any) {
        return res.status(400).json({ message: 'Failed to find note' });
      }

      const hasContent = Boolean(note?.note);

      if (!hasContent) {
        res.status(400).json({
          message:
            'Cannot create questions for this note because the content is empty or null.'
        });
        return;
      }

      const noteData = extractTextFromJson(note.note);

      const flashCardsFromNotes = flashCardsFromNotesPrompt(
        noteData,
        count,
        existingQuestions,
        lang
      );
      let topK = 50;

      const model = new OpenAI({
        temperature: 0,
        openAIApiKey: openAIconfig.apikey,
        modelName: req.gptVersion
      });

      const generateCards = async (): Promise<any> => {
        try {
          const response = await model.call(flashCardsFromNotes);
          res.json(JSON.parse(response));
        } catch (e: any) {
          if (e?.response?.data?.error?.code === 'context_length_exceeded') {
            topK -= 10;
            return await generateCards();
          } else {
            throw new Error(JSON.stringify(e));
          }
        }
      };

      await generateCards();
    } catch (e) {
      next(e);
    }
  }
);

flashCards.post(
  '/generate-from-notes',
  validate(Schema.generateFromDocsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { topic, count, studentId, documentId, existingQuestions } = req.body;

      let additionalTopicContext = '';

      if (topic) additionalTopicContext = ` based on this topic: ${topic}`;

      const document = await Models.DocumentModel.findOne({
        where: {
          referenceId: studentId,
          documentId
        }
      });

      if (!document)
        res.send('No student document for the specified document Id');

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

      const vectorStore = await getDocumentVectorStore({
        studentId,
        documentId
      });

      let topK = 50;

      const documents = async (top_K: number = topK) =>
        await vectorStore.similaritySearch(topic || '', topK);

      const model = new OpenAI({
        temperature: 0,
        openAIApiKey: openAIconfig.apikey,
        modelName: req.gptVersion
      });

      let docs = await documents();
      const flashCardsFromNotes = flashCardsFromDocsPrompt(
        JSON.stringify(docs),
        count,
        existingQuestions
      );

      const generateCards = async (): Promise<any> => {
        try {
          const response = await model.call(flashCardsFromNotes);
          res.json(JSON.parse(response));
          res.end();
        } catch (e: any) {
          if (e?.response?.data?.error?.code === 'context_length_exceeded') {
            if (topK === 0) {
              throw new Error('Top K can not go lower than zero');
            }
            topK -= 10;
            docs = await documents();
            return await generateCards();
          } else {
            throw new Error(JSON.stringify(e));
          }
        }
      };

      await generateCards();
    } catch (e) {
      next(e);
    }
  }
);

export default flashCards;
