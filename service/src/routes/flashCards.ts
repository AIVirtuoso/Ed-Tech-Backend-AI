import express from 'express';
import config from 'config';
import { Request, Response, NextFunction } from 'express';
import { ai, PORT, server, embedding, pineconeIndex } from '../routes/index';
import { OpenAI } from 'langchain/llms/openai';
import validate from '../validation/index';
import Schema from '../validation/schema';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAIConfig } from 'src/types/configs';
import Models from '../../db/models';

const openAIconfig: OpenAIConfig = config.get('openai');

const flashCards = express.Router();

flashCards.post(
  '/students/:studentId',
  validate(Schema.queryEmbeddingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { topic, count, subject } = req.body;

      let difficulty = req.body?.difficulty || 'college';

      const model = new OpenAI({
        temperature: 0.9,
        openAIApiKey: openAIconfig.apikey,
        modelName: 'gpt-3.5-turbo-16k-0613'
      });

      const response = await model.call(
        `Generate ONLY ${count} ${difficulty}-grade flash cards based on this ${subject} topic: ${topic}. Make sure your flash cards at exactly at a ${difficulty} level — no harder or simpler. Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation:
          {
            "front": "Flash card question, suitable for a ${difficulty} level",
          "back": "Answer/completion of the flash card question, also written to be understood by someone at a $difficulty} education level.",
          "explainer": "helpful explanation of the answer (ie, back of flashcard) that disambiguates the topic further for the student. The explanation should be at a ${difficulty} level.",
          "helpful reading": "related topics and materials pertaining to the topic. Don't include links, just textbook references."
          }
           Wrap the total flashcards generated in an object, like this:
          
          {
            flashcards: [
              // the ${count} flashcards go here
            ]
          }`
      );
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

      const documents = await vectorStore.similaritySearch(topic, 30);

      const model = new OpenAI({
        temperature: 0,
        openAIApiKey: openAIconfig.apikey,
        modelName: 'gpt-3.5-turbo-16k-0613',
        maxConcurrency: 10
      });

      const response = await model.call(
        `Convert this note ${JSON.stringify(
          documents
        )} into ${count} flashcards. If the document has nothing relating to the topic, return a payload with this shape: 
        {
          "status": 400,
          "message": "Your supplied topic is not covered in the note specified."
        }
        
        Only use context from the note in generating the flash cards. Use snippets of the note to formulate both the front and back properties of the JSON object. Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation:
          {
            "front": "front of flash card — as a question",
          "back": "back of flashcard — as an answer to the question from the front",
          "explainer": "helpful, ELI5-type explanation of the answer (ie, back of flashcard) that disambiguates the topic further for the student",
          "helpful reading": "If there is related reading in the notes, include them. Otherwise omit this field."
          }
          Wrap the total flashcards generated in an object, like this:
          
          {
            flashcards: [
              // the ${count} flashcards go here
            ]
          }`
      );
      res.send(JSON.parse(response));
      res.end();
    } catch (e) {
      next(e);
    }
  }
);

export default flashCards;
