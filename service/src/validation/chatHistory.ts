import { z } from 'zod';

const chatHistorySchema = z.object({
  query: z.object({
    studentId: z.string({
      required_error: 'studentId required'
    }),
    documentId: z.string({
      required_error: 'documentId required'
    }),
    noteId: z.string({
      required_error: 'noteIs required'
    })
  })
});

export default chatHistorySchema;
