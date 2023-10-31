import express from 'express';
import config from 'config';
import { embedding, pineconeIndex } from '../routes/index';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAI } from 'langchain/llms/openai';
import validate from '../validation/index';
import Schema from '../validation/schema';
import { createOrUpdateHighlight, getHighlights } from '../../db/models/highlights';
const { highlights } = Schema;
const highlight = express.Router();
const openAIConfig = config.get('openai');
highlight.post('/', validate(highlights), async (req, res, next) => {
    try {
        let { documentId, highlight } = req.body;
        const data = await createOrUpdateHighlight({ documentId, highlight });
        res.send({ status: 'Highlight successfully created!', data });
    }
    catch (e) {
        next({
            message: "Check that your documentId matches an actual document, and that you're correctly supplying the highlight payload"
        });
    }
});
highlight.post('/comment', async (req, res, next) => {
    try {
        const { documentId, highlightText, studentId } = req.body;
        const getDocumentVectorStore = async ({ studentId, documentId }) => {
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
        const prompt = `With context from this document: ${JSON.stringify(document)}. Help me understand this text in simpler terms, then explain why it is important: ${highlightText}.`;
        const generateComment = async () => {
            try {
                const response = await model.call(prompt);
                res.json({ comment: response });
                res.end();
            }
            catch (e) {
                if (e?.response?.data?.error?.code === 'context_length_exceeded') {
                    if (topK === 0) {
                        throw new Error('Top K cannot go lower than zero');
                    }
                    topK -= 10;
                    document = await getDocs();
                    return await generateComment();
                }
                else {
                    throw new Error(JSON.stringify(e));
                }
            }
        };
        await generateComment();
    }
    catch (e) {
        next({
            message: "Failed to generate comment. Make sure you're correctly supplying the highlight text or highlight ID, document ID, and student ID."
        });
    }
});
highlight.get('/', async (req, res, next) => {
    try {
        let { documentId } = req.query;
        if (!documentId)
            throw new Error('You need a documentId to retrieve document highlights!');
        const data = await getHighlights(documentId);
        res.send(data);
    }
    catch (e) {
        next(e);
    }
});
export default highlight;
