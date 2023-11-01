import z from 'zod';

export const quizRequestSchema = z.object({
  topic: z.string(),
  count: z.number(),
  subject: z.string(),
  type: z
    .enum([
      'multipleChoiceSingle',
      'multipleChoiceMulti',
      'trueFalse',
      'openEnded',
      'mixed'
    ])
    .optional(),
  difficulty: z
    .enum(['kindergarten', 'high school', 'college', 'PhD', 'genius', 'phd'])
    .optional()
});

export const quizzesFromDocs = z.object({
  topic: z.string().optional(),
  count: z.number(),
  subject: z.string().optional(),
  existingQuestions: z.array(z.string()).optional(),
  documentId: z.string({ required_error: 'documentId is required' }),
  type: z
    .enum([
      'multipleChoiceSingle',
      'multipleChoiceMulti',
      'trueFalse',
      'openEnded',
      'mixed'
    ])
    .optional(),
  difficulty: z
    .enum(['kindergarten', 'high school', 'college', 'PhD', 'genius', 'phd'])
    .optional()
});
