import { z } from 'zod';

const highlightsSchema = z.object({
  body: z.object({
    documentId: z.string({
      required_error: 'documentId required'
    }),
    highlight: z.unknown()
  })
});

export default highlightsSchema;
