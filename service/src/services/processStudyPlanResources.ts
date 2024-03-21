import { database, credential } from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';
import config from '../../config/index';
import { OpenAI } from 'langchain/llms/openai';
import axios from 'axios';
import PDFTextExtractor from '../helpers/pdfTextExtractor';
import LocalPDFExtractor from './localExtractor';
import { OPENAI_MODELS, FLASHCARD_DIFFICULTY } from '../helpers/constants';
import {
  generalFlashcardPrompt,
  generalQuizPrompt,
  flashCardsFromDocsPrompt,
  quizzesFromDocsPrompt
} from '../helpers/promptTemplates';
import { OpenAIConfig } from 'src/types/configs';
import serviceAccount from '../../config/serviceAccountKeys.json';

const openAIconfig: OpenAIConfig = config.openai;

const {
  bucketName,
  outputBucketName,
  snsRoleArn,
  snsTopicArn
}: { [key: string]: string } = config.textExtractor;

type SubTopic = {
  description: string;
  label: string;
};

type JobData = {
  createdAt: number;
  difficulty: string;
  documentUrls: string[];
  resourceType: 'flashcard' | 'quiz';
  status: 'notStarted' | 'inProgress' | 'failed' | 'done';
  subTopics: SubTopic[];
  subject: string;
  topic: string;
  userId: string;
  retryCount?: number;
};

class ProcessStudyPlanService {
  private db: database.Database;
  private retryInterval: number;
  private maxRetries: number;

  constructor() {
    console.log('Initializing ProcessStudyPlanService');
    if (!getApps().length) {
      initializeApp({
        credential: credential.cert(serviceAccount as any),
        databaseURL: 'https://shepherd-app-382114-default-rtdb.firebaseio.com'
      });
    }

    this.db = database();
    this.retryInterval = 15 * 60 * 1000; // 15 minutes
    this.maxRetries = 5;
  }

  public async notifyMainServiceOfResourceGeneration(
    jobId: string
  ): Promise<void> {
    const url = `${process.env.MAIN_SERVICE_API_URL}/extractStudyPlanResource/${jobId}`;
    await axios.post(url, {
      jobId
    });
  }

  public async init(): Promise<void> {
    console.log('Initializing job processing');
    this.watchForJobs();
  }

  private async processJob(jobId: string, jobData: JobData): Promise<void> {
    console.log(`Processing job: ${jobId}`);
    try {
      let resource: any;
      let supportingText;
      if (jobData.documentUrls) {
        const fileUrl = jobData.documentUrls[0];
        if (fileUrl) {
          console.log('Has file url');
          try {
            const localExtractor = new LocalPDFExtractor();

            const extractorInfo = await localExtractor.extractText(fileUrl);

            if (extractorInfo.status === 'success') {
              if (
                extractorInfo.lineCount >= 20 &&
                extractorInfo.wordCount >= 100
              ) {
                supportingText = extractorInfo.text;
              }
            }

            const url = new URL(fileUrl);
            const pathSegments = url.pathname
              .split('/')
              .filter((segment) => segment !== '');
            // Ensure there are enough segments to extract the second to the last
            if (pathSegments.length < 2) {
              throw new Error('URL does not student folder path');
            }
            const folderName = pathSegments[pathSegments.length - 2];

            const pdfTextExtractor = new PDFTextExtractor(
              bucketName,
              outputBucketName,
              folderName,
              snsTopicArn,
              snsRoleArn
            );

            const jobId = await pdfTextExtractor.extractTextFromPDF(fileUrl);

            const text = await pdfTextExtractor.getTextFromJob(jobId);
            await pdfTextExtractor.storeJobDetailsInDynamoDB(fileUrl, text);
            supportingText = text;
          } catch (error: any) {
            console.log(error);
            await this.db.ref(`study-plan-resource-queue/${jobId}`).update({
              ingestError: error.message
            });
          }
        }
      }
      if (jobData.resourceType === 'flashcard') {
        resource = await this.generateFlashcard(jobData, jobId, supportingText);
      } else if (jobData.resourceType === 'quiz') {
        resource = await this.generateQuizQuestions(
          jobData,
          jobId,
          supportingText
        );
      }

      console.log('Resource generated:', resource);

      if (resource) {
        await this.db.ref(`study-plan-resource-queue/${jobId}`).update({
          status: 'done',
          resource
        });
        await this.notifyMainServiceOfResourceGeneration(jobId);
      }
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
      await this.db.ref(`study-plan-resource-queue/${jobId}`).update({
        status: 'failed',
        retryCount: (jobData.retryCount || 0) + 1
      });
    }
  }

  private async generateFlashcard(
    jobData: JobData,
    jobId: string,
    documentString?: string
  ): Promise<any> {
    console.log('Generating flashcard:', jobId);
    const model = new OpenAI({
      temperature: 0,
      openAIApiKey: openAIconfig.apikey,
      modelName: OPENAI_MODELS.GPT_4
    });

    let flashcardPrompt: string;

    if (!documentString) {
      flashcardPrompt = generalFlashcardPrompt(
        '5',
        'mixed',
        jobData.subject,
        jobData.topic,
        undefined,
        jobData.subTopics.map((subTopic) => subTopic.label)
      );
    } else {
      flashcardPrompt = flashCardsFromDocsPrompt(
        documentString,
        5,
        jobData.subTopics.map((subTopic) => subTopic.label)
      );
    }

    const response = await model.call(flashcardPrompt);
    console.log('Flashcard generated:', response);
    return JSON.parse(response).flashcards;
  }

  private async generateQuizQuestions(
    jobData: JobData,
    jobId: string,
    documentString?: string
  ): Promise<any> {
    console.log('Generating quizzes:', jobId);
    const model = new OpenAI({
      temperature: 0,
      openAIApiKey: openAIconfig.apikey,
      modelName: OPENAI_MODELS.GPT_4
    });

    let flashcardPrompt: string;

    if (!documentString) {
      flashcardPrompt = generalQuizPrompt(
        'mixed',
        '5',
        'college',
        jobData.subject,
        jobData.topic
      );
    } else {
      flashcardPrompt = quizzesFromDocsPrompt(
        documentString,
        5,
        'mixed',
        jobData.subTopics.map((subTopic) => subTopic.label)
      );
    }

    const response = await model.call(flashcardPrompt);
    console.log('Quizzes generated:', response);
    return JSON.parse(response).quizzes;
  }

  private async watchForJobs(): Promise<void> {
    console.log('Watching for jobs');
    const ref = this.db.ref('study-plan-resource-queue');
    ref.on('child_added', async (snapshot: any) => {
      const jobId = snapshot.key;
      const jobData = snapshot.val() as JobData;
      if (['notStarted', 'failed'].includes(jobData.status)) {
        if (!jobData.retryCount || jobData.retryCount < this.maxRetries) {
          await this.processJob(jobId, jobData);
        }
      }
    });

    setInterval(() => {
      this.retryFailedJobs();
    }, this.retryInterval);
  }

  private async retryFailedJobs(): Promise<void> {
    console.log('Retrying failed jobs');
    const snapshot = await this.db
      .ref('study-plan-resource-queue')
      .orderByChild('status')
      .equalTo('failed')
      .once('value');

    const jobs = snapshot.val();
    for (const jobId in jobs) {
      if (!jobs.hasOwnProperty(jobId)) continue;

      const jobData = jobs[jobId] as JobData;
      if (jobData.retryCount && jobData.retryCount < this.maxRetries) {
        await this.processJob(jobId, jobData);
      }
    }
  }
}

export default ProcessStudyPlanService;
