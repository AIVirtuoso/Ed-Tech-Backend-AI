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
      grade: z.string({}).optional(),
      difficulty: z
        .enum([
          'kindergarten',
          'high school',
          'college',
          'PhD',
          'genius',
          'phd',
          'mixed'
        ])
        .optional(),
      existingQuestions: z.array(z.string()).optional(),
      subTopics: z.array(z.string()).optional(),
      count: z.number({
        required_error: 'Number of flash cards to generate required'
      })
    })
    .optional()
});

export default queryEmbeddingsSchema;
