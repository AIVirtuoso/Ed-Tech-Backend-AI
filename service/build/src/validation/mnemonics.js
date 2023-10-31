import { z } from 'zod';
const mnemonicsSchema = z.object({
    body: z.object({
        query: z.string({
            required_error: 'Mnemonic query required'
        })
    })
});
export default mnemonicsSchema;
