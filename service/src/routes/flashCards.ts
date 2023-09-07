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
      let { count, note } = req.body;

      // First, parse the note to check if it's valid JSON and if content is empty or null
      let parsedNote;

      try {
        parsedNote = JSON.parse(note);
      } catch (e) {
        throw new Error('The provided note is not a valid JSON string.');
      }

      const hasContent = parsedNote.some(
        (item: any) =>
          item.content &&
          item.content.length > 0 &&
          item.content.some(
            (segment: any) => segment.text && segment.text.trim()
          )
      );

      if (!hasContent) {
        return {
          status: 400,
          message:
            'Cannot create questions for this note because the content is empty or null.'
        };
      }

      const flashCardsFromNotes = flashCardsFromNotesPrompt(note, count);

      let topK = 50;

      const model = new OpenAI({
        temperature: 0,
        openAIApiKey: openAIconfig.apikey,
        modelName: OPENAI_MODELS.GPT_3_5_16K
      });

      const generateCards = async (): Promise<any> => {
        console.debug('Generating Cards');
        try {
          const response = await model.call(flashCardsFromNotes);
          res.json(JSON.parse(response));
          res.end();
        } catch (e: any) {
          console.debug('Error in generateCards', e);
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

export default flashCards;
