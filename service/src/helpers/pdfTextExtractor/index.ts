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
    studentId?: string,
    documentId?: string
  ): Promise<string> {
    const pdfKey = this.extractS3KeyFromUrl(pdfUrl);

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

  public extractS3KeyFromUrl(url: string): string {
    console.log(`Extracting S3 key from URL: ${url}`);

    url = decodeURIComponent(url.replace(/\+/g, ' '));
    const urlParts = url.split('/');
    return `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`;
  }

  /**
   * Retrieves text from the Textract job using parallel fetching.
   * @param {string} jobId - The ID of the Textract job.
   * @return {Promise<string>} - The full extracted text.
   */
  public async getTextFromJob(jobId: string): Promise<string> {
    console.log(`Getting text from job: ${jobId}`);
    await this.waitForJobCompletion(jobId);
    console.log(`Job ${jobId} is complete. Fetching the results...`);

    let fullText: string = '';
    let nextToken: string | undefined;
    let fetchPromises: Promise<any>[] = [];

    do {
      const params: AWS.Textract.GetDocumentTextDetectionRequest = {
        JobId: jobId,
        NextToken: nextToken
      };

      // @ts-ignore
      const fetchPromise = textract
        .getDocumentTextDetection(params)
        .promise()
        .then((response) => {
          response.Blocks?.forEach((block) => {
            if (block.BlockType === 'LINE') {
              fullText += block.Text + '\n';
            }
          });
          return response.NextToken;
        })
        .catch((err) => {
          console.error(`Error fetching text detection results: ${err}`);
          throw err;
        });

      // ts-ignore-next-line
      fetchPromises.push(fetchPromise);

      // Update nextToken for the next iteration
      const response = await fetchPromise;
      nextToken = response;
    } while (nextToken);

    // Wait for all fetches to complete
    await Promise.all(fetchPromises);

    console.log(`All pages processed for job ${jobId}`);
    return fullText;
  }

  private async waitForJobCompletion(jobId: string): Promise<void> {
    console.log(`Waiting for job ${jobId} to complete...`);
    let jobStatus = 'IN_PROGRESS';
    let error: any;
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
        error = response.StatusMessage;
        break;
      }
      console.log(`Job ${jobId} still in progress, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (jobStatus === 'FAILED') {
      throw new Error(`Textract job ${jobId} failed with error: ${error}`);
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

  /**
   * Stores text in S3 and references in DynamoDB.
   * @param {string} pdfUrl - The URL of the PDF.
   * @param {string} text - The text to be stored.
   */
  public async storeJobDetailsInDynamoDB(pdfUrl: string, text: string) {
    const uniqueId = this.extractS3KeyFromUrl(pdfUrl);
    const s3Key = `${this.outputS3Prefix}/${uniqueId}`;

    // Store text in S3
    try {
      await s3
        .putObject({
          Bucket: this.outputBucketName,
          Key: s3Key,
          Body: text,
          ContentType: 'text/plain'
        })
        .promise();
      console.log(`Text stored in S3 under key: ${s3Key}`);
    } catch (err) {
      console.error(`Error storing text in S3: ${err}`);
      throw err;
    }

    // Store reference in DynamoDB
    const data = {
      textrxtjobs: { S: uniqueId },
      S3Key: { S: s3Key }
    };

    await dynamodb
      .putItem({
        TableName: 'StoreTextractJobs',
        Item: data
      })
      .promise();
    console.log(`Stored S3 key for ID ${uniqueId} in DynamoDB`);
  }

  /**
   * Retrieves text from S3 using reference stored in DynamoDB.
   * @param {string} url - The URL of the PDF.
   * @param {string} prefix - Unused, kept for compatibility.
   * @return {Promise<string | null>} The retrieved text or null if not found.
   */
  public async getTextFromDynamoDB(
    url: string,
    prefix: string
  ): Promise<string | null> {
    const uniqueId = this.extractS3KeyFromUrl(url);

    console.log(`Retrieving S3 key from DynamoDB for ID: ${uniqueId}`);

    try {
      const dynamoResponse = await dynamodb
        .getItem({
          TableName: 'StoreTextractJobs',
          Key: {
            textrxtjobs: { S: uniqueId }
          }
        })
        .promise();

      const s3Key = dynamoResponse.Item?.S3Key?.S;

      if (!s3Key) {
        console.log(`No S3 key found for ID ${uniqueId}`);
        return null;
      }

      console.log(`Retrieved S3 key fsor ID ${uniqueId}: ${s3Key}`);

      // Retrieve text from S3
      const s3Response = await s3
        .getObject({
          Bucket: this.outputBucketName,
          Key: s3Key
        })
        .promise();

      const body = s3Response.Body;
      return body ? body.toString('utf-8') : null;
    } catch (error) {
      console.error(`Error retrieving text: ${error}`);
      throw error;
    }
  }
}

export default PDFTextExtractor;
