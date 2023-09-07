import { z } from 'zod';

const docsSchema = z.object({
  body: z.object({
    studentId: z.string({ required_error: 'studentId is required' }),
    note: z.string({ required_error: 'note is required' }),
    count: z.number({
      required_error: 'number of flash cards to generate must be specified'
    }),
    topic: z.string().optional()
  })
});

export default docsSchema;
