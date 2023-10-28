import { z } from 'zod';

const CommentSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  highlightText: z.string().min(1, 'Highlight text is required'),
  studentId: z.string().min(1, 'Student ID is required')
});

export default CommentSchema;
