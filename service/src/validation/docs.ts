import { z } from 'zod';

const docsSchema = z.object({
  body: z.object({
    studentId: z.string({ required_error: 'studentId is required' }),
    documentId: z.string({ required_error: 'documentId is required' })
  })
});

export default docsSchema;
