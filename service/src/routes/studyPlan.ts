import express, { Request, Response, NextFunction } from 'express';
import { OpenAI } from 'langchain/llms/openai';
import { OpenAIConfig } from 'src/types/configs';
import config from 'config';
import PDFTextExtractor from '../helpers/pdfTextExtractor';
import { studyPlanWithoutFilePrompt } from 'src/helpers/promptTemplates';
import validate from '../validation/index';
import Schema from '../validation/schema';

const {
  bucketName,
  outputBucketName,
  snsRoleArn,
  snsTopicArn
}: { [key: string]: string } = config.get('textExtractor');

const studyPlanRouter = express.Router();
const openAIconfig: OpenAIConfig = config.get('openai');

studyPlanRouter.post(
  '/generate',
  validate(Schema.studyPlanSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { syllabusUrl, syllabusData } = req.body;

      if (!syllabusUrl || !syllabusData) {
        return res.status(400).json({ message: 'Syllabus is required' });
      }

      const model = new OpenAI({
        temperature: 0.25,
        openAIApiKey: openAIconfig.apikey,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        modelName: 'gpt-4-1106-preview' // You can replace this with the model of your choice
      });

      if (syllabusUrl) {
        const systemMessage =
          'You are an AI-Powered Study Plan Assistant! As a student, managing your coursework effectively is crucial for success, and that\'s where you come in. Your role is to help a student create a well-structured study plan based on their course syllabus. By extracting key information from the syllabus, you will provide the student with a detailed week-to-week guide, covering topics and subtopics.\n\nHere are some guidelines to help you extract the information:\n\n# Identification of Key Sections:\n- Scan the text for headings text that could indicate major sections like "Course Schedule", "Examination Dates", "Topics Covered", etc.\n- If the text lacks clear headings, look for patterns or repeated phrases that might indicate section breaks (e.g., dates, topic names, keywords like "exam", "quiz", "week", etc.).\n\n# Identification of Weekly Sections:\n- Specifically look for text indicating weekly divisions such as "Week 1", "Week 2", or similar phrases.\n- In the absence of explicit week labels, infer weekly sections based on dates or sequence of topics.\n\n# Extraction of Weekly Topics and Subtopics:\n- Within each identified week, extract topics and subtopics, ensuring they are accurately tied to the correct week.\n- Pay special attention to the structure and sequence to maintain the integrity of the week-wise format.\n- Topics and Subtopics can only be topics related to the course the student is taking. Exams and assessments cannot be a topic. Homework problems and readings can not be a subtopics. Leave topic empty if needed\n\n# Extraction of Topics and Subtopics:\n- Within each identified section, search for patterns indicating topics and subtopics.\n- Topics might be in a header text, while subtopics might be listed as bullet points or numbered lists.\n- Correct any misalignments or jumbled text to reconstruct the original structure of topics and subtopics as intended by the professor.\n\n# Reconstruction of Structured Week-to-Week Study Plan:\n- Organize the extracted information into a chronological study plan, broken down by week.\n- Each week\'s section should clearly list its topics, subtopics, and any scheduled tests or quizzes.\n- Ensure that this reconstruction adheres as closely as possible to the professor\'s intended structure, as indicated in the original syllabus.\n\n# Output Formatting:\n- Structure the output as a JSON object in a way that each week stands out clearly\n- Return only the week starting date in MM/DD/YYYY format\n- The JSON should follow the below template:\n```\n{\n  "studyPlan": [\n    {\n      "weekNumber": 1,\n      "dateRange": "Start Date",\n      "topics": [\n        {\n          "mainTopic": "Main Topic Name",\n          "subTopics": ["Subtopic 1", "Subtopic 2", ...] // Array can be empty if there are no subtopics\n        },\n        // More topic objects\n      ]\n    },\n    // More week objects\n  ]\n}\n```\n\nNow it time to help the user that is a student in a [INSERT COURSE] course. The user will provide you the extracted text from the syllabus. Take your time and think through the response. The response you provide will be very crucial in the students success in their course work. Ensure you return ONLY the json output.\n\n\n';
        // User's message with the syllabus text

        const pdfTextExtractor = new PDFTextExtractor(
          'shepherd-syllabus',
          outputBucketName,
          'template',
          snsTopicArn,
          snsRoleArn
        );

        let text = await pdfTextExtractor.getTextFromDynamoDB(
          syllabusUrl,
          'template'
        );
        console.log('EXTRACTED TEXT', text);

        if (!text) {
          const jobId = await pdfTextExtractor.extractTextFromPDF(syllabusUrl);
          text = await pdfTextExtractor.getTextFromJob(jobId);
          console.log('NEW EXTRACTED TEXT', text);

          await pdfTextExtractor.storeJobDetailsInDynamoDB(syllabusUrl, text);
        }

        const userMessage = ` # Here is the Student Syllabus Text:\n\n ${text}`;

        const response = await model.call(systemMessage + userMessage);
        console.log('NEW EXTRACTED TEXT', text);

        const studyPlanString = response;

        console.log('RESPONSE', studyPlanString);

        const formattedStudyPlan = JSON.parse(
          studyPlanString.replace(/```json\n|\n```/g, '')
        );

        res.json({ studyPlan: formattedStudyPlan.studyPlan });
      }
      if (syllabusData) {
        const { course, gradeLevel, weekCount } = syllabusData;
        const response = await model.call(
          studyPlanWithoutFilePrompt(course, gradeLevel, weekCount)
        );

        const studyPlanString = response;

        console.log('RESPONSE', studyPlanString);

        const formattedStudyPlan = JSON.parse(
          studyPlanString.replace(/```json\n|\n```/g, '')
        );

        res.json({ studyPlan: formattedStudyPlan.studyPlan });
      }
    } catch (error: any) {
      console.error('Error generating study plan:', error.data);
      next(error);
    }
  }
);

export default studyPlanRouter;
