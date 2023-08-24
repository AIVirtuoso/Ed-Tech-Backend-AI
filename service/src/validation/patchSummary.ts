import { z } from 'zod';

const patchSummary = z.object({
  body: z.object({
    studentId: z.string({
      required_error: 'studentId required'
    }),
    documentId: z.string({
      required_error: 'documentId required'
    }),
    summary: z.string({
      required_error: 'summary is required!'
    })
  })
});

export default patchSummary;
