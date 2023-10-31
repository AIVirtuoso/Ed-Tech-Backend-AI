import express from 'express';
import config from 'config';
import { embedding, pineconeIndex } from '../routes/index';
import { OpenAI } from 'langchain/llms/openai';
import validate from '../validation/index';
import Schema from '../validation/schema';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import Models from '../../db/models';
import { OPENAI_MODELS, FLASHCARD_DIFFICULTY } from '../helpers/constants';
import { generalQuizPrompt, flashCardsFromNotesPrompt, flashCardsFromDocsPrompt } from '../helpers/promptTemplates';
import extractTextFromJson from '../helpers/parseNote';
import fetchNote from '../helpers/getNote';
const openAIconfig = config.get('openai');
const quizzes = express.Router();
quizzes.post('/students/:studentId', validate(Schema.queryEmbeddingsSchema), async (req, res, next) => {
    try {
        let { topic, count, subject, type } = req.body;
        let difficulty = req.body?.difficulty || FLASHCARD_DIFFICULTY.COLLEGE;
        const model = new OpenAI({
            temperature: 0.9,
            openAIApiKey: openAIconfig.apikey,
            modelName: OPENAI_MODELS.GPT_4
        });
        // Replace with your quiz generation logic based on the flashcard logic.
        const quizPrompt = generalQuizPrompt(type, count, difficulty, subject, topic);
        const response = await model.call(quizPrompt);
        res.send(JSON.parse(response));
        res.end();
    }
    catch (e) {
        next(e);
    }
});
quizzes.post('/generate-from-plain-notes', validate(Schema.generateFromNotesSchema), async (req, res, next) => {
    try {
        const { count, noteId } = req.body;
        let note;
        try {
            note = await fetchNote(noteId);
        }
        catch (error) {
            return res.status(400).json({ message: 'Failed to find note' });
        }
        const hasContent = Boolean(note?.note);
        if (!hasContent) {
            res.status(400).json({
                message: 'Cannot create quizzes for this note because the content is empty or null.'
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
            modelName: OPENAI_MODELS.GPT_3_5_16K
        });
        const generateQuizzes = async () => {
            try {
                const response = await model.call(quizzesFromNotes);
                res.json(JSON.parse(response));
            }
            catch (e) {
                console.debug('Error in generateQuizzes', e);
                if (e?.response?.data?.error?.code === 'context_length_exceeded') {
                    topK -= 10;
                    return await generateQuizzes();
                }
                else {
                    throw new Error(JSON.stringify(e));
                }
            }
        };
        await generateQuizzes();
    }
    catch (e) {
        console.log(e);
        next(e);
    }
});
quizzes.post('/generate-from-notes', validate(Schema.generateFromDocsSchema), async (req, res, next) => {
    try {
        let { topic, count, studentId, documentId } = req.body;
        let additionalTopicContext = '';
        if (topic)
            additionalTopicContext = ` based on this topic: ${topic}`;
        const document = await Models.DocumentModel.findOne({
            where: {
                referenceId: studentId,
                documentId
            }
        });
        if (!document)
            res.send('No student document for the specified document Id');
        const getDocumentVectorStore = async ({ studentId, documentId }) => {
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
        const documents = async (top_K = topK) => await vectorStore.similaritySearch(topic || '', topK);
        const model = new OpenAI({
            temperature: 0,
            openAIApiKey: openAIconfig.apikey,
            modelName: OPENAI_MODELS.GPT_3_5_16K
        });
        let docs = await documents();
        // Replace with your quiz generation logic based on the flashcard logic.
        const quizzesFromDocs = flashCardsFromDocsPrompt(JSON.stringify(docs), count);
        const generateQuizzes = async () => {
            try {
                const response = await model.call(quizzesFromDocs);
                res.json(JSON.parse(response));
                res.end();
            }
            catch (e) {
                if (e?.response?.data?.error?.code === 'context_length_exceeded') {
                    if (topK === 0) {
                        throw new Error('Top K can not go lower than zero');
                    }
                    topK -= 10;
                    docs = await documents();
                    return await generateQuizzes();
                }
                else {
                    throw new Error(JSON.stringify(e));
                }
            }
        };
        await generateQuizzes();
    }
    catch (e) {
        next(e);
    }
});
export default quizzes;
