import express from 'express';
import config from '../../config/index';
import { Request, Response, NextFunction } from 'express';
import { OpenAI } from 'langchain/llms/openai';
import validate from '../validation/index';
import Schema from '../validation/schema';
import { OpenAIConfig } from '../types/configs';
import { OPENAI_MODELS } from '../helpers/constants';
import { mnemonicPrompt } from '../helpers/promptTemplates/';

const openAIconfig: OpenAIConfig = config.openai;

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
        modelName: OPENAI_MODELS.GPT_4
      });

      const mnemonic = mnemonicPrompt(query);

      const response = await model.call(mnemonic);

      res.send(JSON.parse(response));
      res.end();
    } catch (e) {
      next(e);
    }
  }
);

export default mnemonics;
