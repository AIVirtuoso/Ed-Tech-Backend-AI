import eli5Schema from './eli5';
import ingest from './embeddings';
import queryEmbeddingsSchema from './queryEmbeddings';
import docsSchema from './docs';
import chat from './docChat';
import summary from './summary';
import chatHistory from './chatHistory';
import mnemonicsSchema from './mnemonics';
import generateFromNotesSchema from './generateFromNotes';
import generateFromDocsSchema from './generateFromDocs';
import homeworkHelpSchema from './homeworkHelp';
import blockNotes from './blockNotes';
import editHistoryTitle from './editHistoryTitle';
import highlights, {
  commentGenerateSchema,
  commentSaveSchema
} from './highlights';
import patchSummary from './patchSummary';
import reaction from './conversationReaction';
import highlightComment from './highlightComment';
import { quizRequestSchema, quizzesFromDocs } from './quizzes';
import studyPlanSchema from './generateStudyPlan';

export default {
  eli5Schema,
  ingest,
  queryEmbeddingsSchema,
  docsSchema,
  chat,
  mnemonicsSchema,
  generateFromNotesSchema,
  homeworkHelpSchema,
  generateFromDocsSchema,
  chatHistory,
  blockNotes,
  summary,
  highlights,
  patchSummary,
  editHistoryTitle,
  quizRequestSchema,
  highlightComment,
  quizzesFromDocs,
  reaction,
  commentGenerateSchema,
  commentSaveSchema,
  studyPlanSchema
};
