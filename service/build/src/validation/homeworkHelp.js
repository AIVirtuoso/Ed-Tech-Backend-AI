import { z } from 'zod';
const homeworkHelpSchema = z.object({
    body: z.object({
        studentId: z.string({ required_error: 'studentId is required' }),
        topic: z.string({ required_error: 'topic is required' })
    })
});
export default homeworkHelpSchema;
