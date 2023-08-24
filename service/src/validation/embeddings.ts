import { z } from 'zod';

const ingest = z.object({
  body: z.object({
    documentURL: z.string({ required_error: 'Document URL is required' }).url({
      message: 'This must be a URL'
    }),
    tags: z.array(z.string()).optional(),
    studentId: z.string({ required_error: 'studentId is required' }),
    courseId: z.string().optional(),
    documentId: z.string({ required_error: 'documentId is required' })
  })
});

export default ingest;
