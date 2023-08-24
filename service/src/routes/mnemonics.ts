import express from 'express';
import config from 'config';
import { Request, Response, NextFunction } from 'express';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { OpenAI } from 'langchain/llms/openai';
import validate from '../validation/index';
import Schema from '../validation/schema';
import { OpenAIConfig } from '../types/configs';

const openAIconfig: OpenAIConfig = config.get('openai');

const mnemonics = express.Router();

mnemonics.post(
  '/generate',
  validate(Schema.mnemonicsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { query } = req.body;

      const model = new OpenAI({
        temperature: 0.5,
        openAIApiKey: openAIconfig.apikey,
        modelName: 'gpt-4'
      });

      const response = await model.call(
        `You are a mnemonic generator. When you receive input, you try to understand the context, paying attention to the first letters in the input, and then you will come up with a catchy, memorable one-liner that helps with memorizing the input. You will then explain how the one-liner works, and the cognitive shortcuts it helps the user internalize. Your input is: ${query}. Return only A JSON response in this format: 
        
        {
          "status": "200, if you succeeded, or 500 if you couldn't come up with an answer, or 400 if the request made no sense",
          explainer: {
            "answer": "The actual mnemonic",
            "context": "Your exhaustive explanation for how, and why, the mnemonic works",
          }
        }
        `
      );

      res.send(JSON.parse(response));
      res.end();
    } catch (e) {
      next(e);
    }
  }
);

export default mnemonics;
