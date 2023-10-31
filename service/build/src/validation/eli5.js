import { z } from 'zod';
const eli5Schema = z.object({
    body: z.object({
        topic: z.string({
            required_error: 'You must specify the topic you want explained'
        }),
        level: z.string({
            required_error: 'Please specify the level of complexity you want the topic explained to you at. An example is "beginner", "grade 5", "astrophysicist"'
        })
    })
});
export default eli5Schema;
