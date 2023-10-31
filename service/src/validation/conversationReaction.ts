import { z } from 'zod';

// Define the schema
const reaction = z.object({
  chatId: z.string(),
  reactionType: z.union([z.literal('like'), z.literal('dislike')]) // only allows 'like' or 'dislike'
});

export default reaction;
