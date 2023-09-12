import { z } from 'zod';

const editHistoryTitle = z.object({
  body: z.object({
    newTitle: z.string({
      required_error: 'newTitle required'
    })
  })
});

export default editHistoryTitle;
