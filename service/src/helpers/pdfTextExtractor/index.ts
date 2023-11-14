import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIAUWHUFD3XCENJWZP5',
  secretAccessKey: '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',
  region: 'us-east-2'
});

const s3 = new AWS.S3();
const textract = new AWS.Textract();
const dynamodb = new AWS.DynamoDB();

class PDFTextExtractor {
  private bucketName: string;
  private outputBucketName: string;
  private outputS3Prefix: string;
  private snsTopicArn: string;
  private snsRoleArn: string;

  constructor(
    bucketName: string,
    outputBucketName: string,
    outputS3Prefix: string,
    snsTopicArn: string,
    snsRoleArn: string
  ) {
    this.bucketName = bucketName;
    this.outputBucketName = outputBucketName;
    this.outputS3Prefix = outputS3Prefix;
    this.snsTopicArn = snsTopicArn;
    this.snsRoleArn = snsRoleArn;
  }

  public async extractTextFromPDF(
    pdfUrl: string,
    studentId: string,
    documentId: string
  ): Promise<string> {
    console.log('Extracting text from PDF...');
    const pdfKey = this.extractS3KeyFromUrl(pdfUrl);
    console.log(`PDF key extracted: ${pdfKey}`);

    const params = {
      DocumentLocation: { S3Object: { Bucket: this.bucketName, Name: pdfKey } },
      OutputConfig: {
        S3Bucket: this.outputBucketName,
        S3Prefix: this.outputS3Prefix
      },
      NotificationChannel: {
        SNSTopicArn: this.snsTopicArn,
        RoleArn: this.snsRoleArn
      }
    };

    console.log('Starting document text detection...');
    const response = await textract
      .startDocumentTextDetection(params)
      .promise();
    console.log('Text detection started:', response);

    const jobId = response.JobId;
    if (!jobId) {
      throw new Error('Job ID not found in response');
    }

    console.log(`Job ID received: ${jobId}`);
    // The next line is commented out because storing to DynamoDB is beyond the scope of this example
    // await this.storeJobDetailsInDynamoDB(jobId, studentId, documentId);

    return jobId;
  }

  private extractS3KeyFromUrl(url: string): string {
    console.log(`Extracting S3 key from URL: ${url}`);
    const urlParts = url.split('/');
    return `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`;
  }

  public async getTextFromJob(jobId: string): Promise<string> {
    console.log(`Getting text from job: ${jobId}`);
    await this.waitForJobCompletion(jobId);
    console.log(`Job ${jobId} is complete. Fetching the results...`);

    let fullText: string = '';
    let nextToken: string | undefined;

    const getDocumentTextDetection = async (
      jobId: string,
      nextToken?: string
    ): Promise<string> => {
      console.log(
        `Fetching page results for job ${jobId} ${
          nextToken ? `with next token: ${nextToken}` : ''
        }`
      );

      const params: AWS.Textract.GetDocumentTextDetectionRequest = {
        JobId: jobId,
        NextToken: nextToken
      };

      try {
        const response = await textract
          .getDocumentTextDetection(params)
          .promise();
        console.log(
          `Results received for page ${
            nextToken ? `with token: ${nextToken}` : ''
          }`
        );

        response.Blocks?.forEach((block) => {
          if (block.BlockType === 'LINE') {
            fullText += block.Text + '\n';
          }
        });

        if (response.NextToken) {
          console.log(`More pages detected for job ${jobId}`);
          return getDocumentTextDetection(jobId, response.NextToken);
        } else {
          console.log(`All pages processed for job ${jobId}`);
          return fullText;
        }
      } catch (err) {
        console.error(`Error fetching text detection results: ${err}`);
        throw err;
      }
    };

    return getDocumentTextDetection(jobId);
  }

  private async waitForJobCompletion(jobId: string): Promise<void> {
    console.log(`Waiting for job ${jobId} to complete...`);
    let jobStatus = 'IN_PROGRESS';
    while (jobStatus === 'IN_PROGRESS') {
      const response = await textract
        .getDocumentTextDetection({ JobId: jobId })
        .promise();
      console.log(`Job status for ${jobId}: ${response.JobStatus}`);

      if (!response.JobStatus) {
        throw new Error('Invalid job status response');
      }
      jobStatus = response.JobStatus;
      if (jobStatus === 'SUCCEEDED' || jobStatus === 'FAILED') {
        break;
      }
      console.log(`Job ${jobId} still in progress, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (jobStatus === 'FAILED') {
      throw new Error(`Textract job ${jobId} failed`);
    }
    console.log(`Job ${jobId} completed with status ${jobStatus}`);
  }

  private processJobResults(results: AWS.S3.GetObjectOutput[]): string {
    let fullText = '';
    for (const result of results) {
      if (result.Body) {
        const pageText = JSON.parse(result.Body.toString('utf-8'));
        fullText += pageText.Text + '\n'; // Concatenate text from all pages
      }
    }
    return fullText;
  }

  public async storeJobDetailsInDynamoDB(uniqueId: string, text: string) {
    const data = {
      textrxtjobs: { S: uniqueId },
      Data: { S: text }
    };

    await dynamodb
      .putItem({
        TableName: 'StoreTextractJobs',
        Item: data
      })
      .promise();
  }
}

export default PDFTextExtractor;
