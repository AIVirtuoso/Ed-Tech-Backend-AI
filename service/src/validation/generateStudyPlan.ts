import { z } from 'zod';

const syllabusDataSchema = z.object({
  course: z.string({ required_error: 'Course is required' }),
  gradeLevel: z.string({ required_error: 'Grade level is required' }),
  weekCount: z.number({ required_error: 'Week count is required' })
});

const studyPlanSchema = z.object({
  body: z
    .object({
      syllabusUrl: z.string().optional(),
      syllabusData: syllabusDataSchema.optional()
    })
    .refine((data) => data.syllabusUrl || data.syllabusData, {
      message: 'Either syllabusUrl or syllabusData is required'
    })
});

export default studyPlanSchema;
