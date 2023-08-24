import { z } from 'zod';

const queryEmbeddingsSchema = z.object({
  body: z
    .object({
      topic: z.string({
        required_error: 'Topic required'
      }),
      subject: z.string({
        required_error: 'Subject required'
      }),
      difficulty: z
        .enum(['kindergarten', 'high school', 'college', 'PhD', 'genius'])
        .optional(),
      count: z.number({
        required_error: 'Number of flash cards to generate required'
      })
    })
    .optional()
});

export default queryEmbeddingsSchema;
