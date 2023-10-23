import z from 'zod';

export const quizRequestSchema = z.object({
  topic: z.string(),
  count: z.number(),
  subject: z.string(),
  type: z.enum([
    'multipleChoiceSingle',
    'multipleChoiceMulti',
    'trueFalse',
    'openEnded',
    'mixed'
  ]),
  difficulty: z
    .enum(['kindergarten', 'high school', 'college', 'PhD', 'genius', 'phd'])
    .optional()
});
