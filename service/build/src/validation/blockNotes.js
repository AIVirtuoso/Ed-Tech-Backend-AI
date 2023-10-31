import { z } from 'zod';
const blockNotes = z.object({
    body: z.object({
        studentId: z.string({ required_error: 'studentId is required' }),
        document: z.array(z.string({ required_error: 'An array of strings required' })),
        documentId: z.string({ required_error: 'documentId is required' })
    }),
});
export default blockNotes;
