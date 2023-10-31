import { z } from 'zod';
const chat = z.object({
    body: z.object({
        query: z.string({
            required_error: 'query required'
        }),
        studentId: z.string({
            required_error: 'studentId required'
        }),
        documentId: z.string({
            required_error: 'documentId required'
        })
    }),
    headers: z.object({
        limit: z.number().optional(),
        offset: z.number().optional()
    })
});
export default chat;
