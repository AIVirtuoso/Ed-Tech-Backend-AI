import { z } from 'zod';
const summary = z.object({
    body: z.object({
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
export default summary;
