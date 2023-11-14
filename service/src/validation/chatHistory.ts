import { z } from 'zod';

const chatHistorySchema = z.object({
  query: z.object({
    studentId: z.string({
      required_error: 'studentId required'
    }),
    documentId: z
      .string({
        required_error: 'documentId required'
      })
      .optional(),
    noteId: z
      .string({
        required_error: 'noteId required'
      })
      .optional()
  })
});

export default chatHistorySchema;
