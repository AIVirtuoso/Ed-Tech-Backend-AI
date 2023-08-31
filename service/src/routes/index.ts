import express from 'express';
import { Response } from 'express';
import Middleware from '../middleware/index';
import notes from './notes';
import flashCards from './flashCards';
import { PineconeClient } from '@pinecone-database/pinecone';
import mnemonics from './mnemonics';
import highlights from './highlights';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { OpenAI } from 'langchain/llms/openai';
import cors from 'cors';
import http from 'http';
import config from 'config';
import { VectorOperationsApi } from '@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch';

const PORT = 3000;
const SOCKET_PORT = 9000;

const { auth, error } = Middleware;

const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200
};

const ai = express();
ai.use(cors(corsOptions));

ai.get('/status', (_, res: Response) => {
  const alive = {
    status: 200,
    message: 'The shepherd is alive',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
  res.send(alive);
});

const server = http.createServer(ai);

server.listen(SOCKET_PORT, () => {
  console.log(`Socket is plugged-in at localhost:${SOCKET_PORT}`);
});

// Configs are now shared among the routes!
ai.locals.config = config;

console.log(`🤖 Application config file loaded\n`);

// @ts-ignore
const { apikey: openAIApiKey, model: modelName } = config.get('openai');

const embedding = new OpenAIEmbeddings({
  openAIApiKey,
  batchSize: 2048,
  stripNewLines: false
});

const model = new OpenAI({
  openAIApiKey,
  modelName,
  temperature: 0.4
});

let pineconeIndex: VectorOperationsApi;

const preparePinecone = async () => {
  const pinecone = new PineconeClient();
  // @ts-ignore
  const { apikey, environment, index } = config.get('pinecone');
  await pinecone.init({
    apiKey: apikey,
    environment
  });

  const vectorIndex = pinecone.Index(index);
  ai.locals.pineconeIndex = vectorIndex;
  pineconeIndex = vectorIndex;
};

preparePinecone();
console.log(`\n🤖 Vector store OK \n`);
ai.locals.embeddingAI = embedding;
ai.locals.chatModel = model;

ai.use(auth);
ai.use(express.json());
ai.use('/notes', notes);
ai.use('/flash-cards', flashCards);
ai.use('/mnemonics', mnemonics);
ai.use('/highlights', highlights);

ai.use(error);

export { ai, PORT, server, embedding, config, model, pineconeIndex };
