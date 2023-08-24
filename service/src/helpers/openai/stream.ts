import { Response } from 'express';
import { createChat } from 'completions';
import { OpenAIConfig } from '../../types/configs';
import config from 'config';

const openAIconfig: OpenAIConfig = config.get('openai');
interface StreamChats {
  message: any[];
  apiKey?: string;
  model?: string;
  res: Response;
}

const streamChatCompletion = async ({
  message,
  apiKey,
  model,
  res
}: StreamChats) => {
  let packedResponse = '';
  const chat = createChat({
    apiKey: apiKey || openAIconfig.apikey,
    model: model || 'gpt-3.5-turbo-16k'
  });

  await chat
    .sendMessage(JSON.stringify(message), {
      onUpdate: (message) => {
        const { delta } = message?.message?.choices[0];

        // @ts-ignore
        if (delta?.content) {
          // @ts-ignore
          packedResponse += delta.content as string;
          // @ts-ignore
          res.write(delta.content);
        }
      }
    })
    .catch(() => {
      res.write(
        'Something went wrong. Try re-sending your last message, or contact ShepherdTutors support.'
      );
    });

  return packedResponse;
};

export default streamChatCompletion;
