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
import { FLASHCARD_DIFFICULTY } from '../helpers/constants';
import {
  generalQuizPrompt,
  quizzesFromDocsPrompt,
  flashCardsFromNotesPrompt,
  quizzesCSVPrompt
} from '../helpers/promptTemplates';
import extractTextFromJson from '../helpers/parseNote';
import fetchNote from '../helpers/getNote';
import { Languages } from 'src/types';
import { String } from 'aws-sdk/clients/cloudsearch';

const openAIconfig: OpenAIConfig = config.openai;

const quizzes = express.Router();

type QuizType =
  | 'multipleChoiceSingle'
  | 'multipleChoiceMulti'
  | 'trueFalse'
  | 'openEnded';

interface Option {
  content: string;
  isCorrect: boolean;
}

interface Quiz {
  question: string;
  type: QuizType;
  options?: Option[];
  answer?: string; // For openEnded questions
}

interface QuizzesContainer {
  quizzes: Quiz[];
}

function csvToJson(csvString: string): QuizzesContainer {
  const lines = csvString
    .trim()
    .split('\n')
    .filter((line) => line);
  const quizzes: Quiz[] = lines.map((line) => {
    // Splitting while considering CSV specifics, ignoring commas inside quotes
    const [question_id, type, question, optionsString, answer_index] = line
      .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
      .map((item) => item.replace(/^"|"$/g, ''));

    let options: Option[] = [];

    if (type === 'multipleChoiceSingle' || type === 'multipleChoiceMulti') {
      const optionsArray = optionsString.split('|');
      options = optionsArray.map((option, index) => {
        const isCorrect =
          type === 'multipleChoiceMulti'
            ? answer_index.split('|').map(Number).includes(index)
            : Number(answer_index) === index;
        return { content: option, isCorrect };
      });
    } else if (type === 'trueFalse') {
      options = [
        { content: 'True', isCorrect: answer_index === '0' },
        { content: 'False', isCorrect: answer_index === '1' }
      ];
    }

    const quiz: Quiz = {
      question,
      type: type as QuizType
    };

    if (
      ['multipleChoiceSingle', 'multipleChoiceMulti', 'trueFalse'].includes(
        type
      )
    ) {
      quiz.options = options;
    } else if (type === 'openEnded') {
      // Assuming the answer might be directly in the answer_index for openEnded types
      quiz.answer = answer_index;
    }

    return quiz;
  });

  return { quizzes: quizzes.slice(1) };
}

quizzes.post(
  '/students/:studentId',
  validate(Schema.queryEmbeddingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lang = req.query.lang as Languages;
      let { topic, count, subject, type } = req.body;

      let difficulty = req.body?.difficulty || FLASHCARD_DIFFICULTY.COLLEGE;

      const model = new OpenAI({
        temperature: 0.9,
        openAIApiKey: openAIconfig.apikey,
        modelName: req.gptVersion
      });

      // Replace with your quiz genewration logic based on the flashcard logic.
      const quizPrompt = quizzesCSVPrompt(
        type,
        count,
        difficulty,
        subject,
        topic,
        lang
      );

      const response = await model.call(quizPrompt);
      console.log(response);
      const result = csvToJson(response);
      res.send(result);
      res.end();
    } catch (e) {
      next(e);
    }
  }
);

quizzes.post(
  '/generate-from-plain-notes',
  validate(Schema.generateFromNotesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { count, noteId } = req.body;
      let note;
      try {
        note = await fetchNote(noteId);
      } catch (error: any) {
        return res.status(400).json({ message: 'Failed to find note' });
      }

      const hasContent = Boolean(note?.note);

      if (!hasContent) {
        res.status(400).json({
          message:
            'Cannot create quizzes for this note because the content is empty or null.'
        });
        return;
      }

      const noteData = extractTextFromJson(note.note);

      // Replace with your quiz generation logic based on the flashcard logic.
      const quizzesFromNotes = flashCardsFromNotesPrompt(noteData, count);

      let topK = 50;

      const model = new OpenAI({
        temperature: 0,
        openAIApiKey: openAIconfig.apikey,
        modelName: req.gptVersion
      });

      const generateQuizzes = async (): Promise<any> => {
        try {
          const response = await model.call(quizzesFromNotes);
          res.json(JSON.parse(response));
        } catch (e: any) {
          console.debug('Error in generateQuizzes', e);
          if (e?.response?.data?.error?.code === 'context_length_exceeded') {
            topK -= 10;
            return await generateQuizzes();
          } else {
            throw new Error(JSON.stringify(e));
          }
        }
      };

      await generateQuizzes();
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
);

quizzes.post(
  '/generate-from-notes',
  validate(Schema.quizzesFromDocs),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lang = req.query.lang as Languages;
      let { topic, count, studentId, documentId, type } = req.body;

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
      // Replace with your quiz generation logic based on the flashcard logic.
      const quizzesFromDocs = quizzesFromDocsPrompt(
        JSON.stringify(docs),
        count,
        type,
        undefined,
        undefined,
        lang
      );

      const generateQuizzes = async (): Promise<any> => {
        try {
          const response = await model.call(quizzesFromDocs);
          res.json(JSON.parse(response));
          res.end();
        } catch (e: any) {
          if (e?.response?.data?.error?.code === 'context_length_exceeded') {
            if (topK === 0) {
              throw new Error('Top K can not go lower than zero');
            }
            topK -= 10;
            docs = await documents();
            return await generateQuizzes();
          } else {
            throw new Error(JSON.stringify(e));
          }
        }
      };

      await generateQuizzes();
    } catch (e) {
      next(e);
    }
  }
);

export default quizzes;
