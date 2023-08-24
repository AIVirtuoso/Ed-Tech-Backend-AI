import express from 'express';
import { Request, Response, NextFunction } from 'express';
import validate from '../validation/index';
import Schema from '../validation/schema';
import Models from '../../db/models';
import { homeworkHelpPrompt } from '../helpers/promptTemplates/';
import { encodingForModel } from 'js-tiktoken';
import streamChatCompletion from '../helpers/openai/stream';

const model = 'gpt-3.5-turbo-16k';
const MAX_TOKENS_LIMIT = 16_000;

const homeworkHelp = express.Router();

homeworkHelp.get(
  '/chat-window',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    } catch (e) {
      next(e);
    }
  }
);

// homeworkHelp.post(
//   '/chat',
//   validate(Schema.homeworkHelpSchema),
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { studentId, topic, query } = req.body;
//       let chatContext: any[] = [];
//       let newChat = false;

//       const prepareMessage = (role: 'user' | 'assistant', content: string) => ({
//         role,
//         content
//       });

//       const documentId = `homework-${topic}`;

//       const systemMessage = (topic: string) => ({
//         role: 'system',
//         content: homeworkHelpPrompt(topic)
//       });

//       let chatHistory = await Models.ChatHistoryModel.findOne({
//         where: {
//           documentId,
//           studentId
//         },
//         order: [['createdAt']]
//       }).then((res: any) => res?.chatLog ?? []);

//       const encoder = encodingForModel(model);
//       const encoding = encoder.encode(JSON.stringify(chatHistory || ''));

//       const contextWindowExceeded = encoding.length > MAX_TOKENS_LIMIT;

//       if (!chatHistory || contextWindowExceeded) {
//         chatHistory = [systemMessage(topic)];
//         newChat = true;
//       }
//       chatContext = [...chatHistory, prepareMessage('user', query)];

//       res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache, no-transform',
//         Connection: 'keep-alive'
//       });

//       let aiResponse = await streamChatCompletion({
//         message: chatContext,
//         res
//       });

//       res.end();

//       const aiCompletion = prepareMessage('assistant', aiResponse);

//       const updateChatHistory = async (chats: any[], isNew: boolean) => {
//         const meta = {
//           studentId,
//           chatLog: chats,
//           documentId
//         };

//         if (isNew) {
//           await createNewChat(meta);
//         } else {
//           await updateChat(meta);
//         }
//       };
//       const updatedChatContext = [...chatContext, aiCompletion];
//       await updateChatHistory(updatedChatContext, newChat);
//     } catch (e: any) {
//       next(e);
//     }
//   }
// );

export default homeworkHelp;
