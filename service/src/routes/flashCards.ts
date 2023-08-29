import express from 'express';
import config from 'config';
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
  flashCardsFromNotesPrompt
} from '../helpers/promptTemplates';

const openAIconfig: OpenAIConfig = config.get('openai');

const flashCards = express.Router();

flashCards.post(
  '/students/:studentId',
  validate(Schema.queryEmbeddingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { topic, count, subject } = req.body;

      let difficulty = req.body?.difficulty || FLASHCARD_DIFFICULTY.COLLEGE;

      const model = new OpenAI({
        temperature: 0.9,
        openAIApiKey: openAIconfig.apikey,
        modelName: OPENAI_MODELS.GPT_3_5_16K
      });

      const flashCardPrompt = generalFlashcardPrompt(
        count,
        difficulty,
        subject,
        topic
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
  '/generate-from-notes',
  validate(Schema.generateFromNotesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { topic, count, studentId, documentId } = req.body;

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
        await vectorStore.similaritySearch(topic, topK);

      const model = new OpenAI({
        temperature: 0,
        openAIApiKey: openAIconfig.apikey,
        modelName: OPENAI_MODELS.GPT_3_5_16K
      });

      let docs = await documents();
      const flashCardsFromNotes = flashCardsFromNotesPrompt(
        JSON.stringify(docs),
        count
      );

      const generateCards = async () =>
        await model
          .call(flashCardsFromNotes)
          .then((response) => {
            res.send(JSON.parse(response));
            res.end();
          })
          .catch(async (e: any): Promise<any> => {
            if (e?.response?.data?.error?.code === 'context_length_exceeded') {
              topK -= 10;
              docs = await documents(topK);
              return await generateCards();
            } else throw new Error(JSON.stringify(e));
          });
    } catch (e) {
      next(e);
    }
  }
);

export default flashCards;
