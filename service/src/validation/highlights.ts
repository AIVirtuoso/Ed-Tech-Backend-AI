import { z } from 'zod';

const highlightsSchema = z.object({
  body: z.object({
    documentId: z.string({
      required_error: 'documentId required'
    }),
    highlight: z.unknown()
  })
});

export const commentGenerateSchema = z.object({
  body: z.object({
    documentId: z.string({
      required_error: 'documentId is required'
    }),
    highlightText: z.string({
      required_error: 'highlightText is required'
    }),
    studentId: z.string({
      required_error: 'studentId is required'
    })
  })
});

export const commentSaveSchema = z.object({
  body: z.object({
    highlightId: z.string({
      required_error: 'highlightId is required'
    }),
    content: z.string({
      required_error: 'Comment content is required'
    }),
    studentId: z.string().optional() // if studentId is optional; otherwise, remove .optional()
  })
});

export default highlightsSchema;
