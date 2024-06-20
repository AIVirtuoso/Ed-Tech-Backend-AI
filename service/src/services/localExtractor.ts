import pdfParse from 'pdf-parse';
import axios from 'axios';

class LocalPDFExtractor {
  async extractText(pdfUrl: string): Promise<{
    status: string;
    lineCount: number;
    text: string;
    wordCount: number;
    error?: string;
  }> {
    try {
      // Fetch the PDF from the URL using Axios
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      const pdfBuffer = response.data;

      // Parse the PDF and extract text using pdf-parse
      const data = await pdfParse(pdfBuffer);
      const text = data.text;

      // Count the number of lines
      const lineCount = text.split(/\r\n|\r|\n/).length;
      const wordCount = text.replace(/\r\n|\r|\n/, '').trim().length;
      console.log('Word count:', wordCount);

      return {
        status: 'success',
        lineCount: lineCount,
        wordCount: wordCount,
        text: text
      };
    } catch (error: any) {
      console.error('Error extracting text from PDF:', error);
      return {
        status: 'error',
        lineCount: 0,
        wordCount: 0,
        text: '',
        error: error.message
      };
    }
  }
}

export default LocalPDFExtractor;

// Example usage:
// const extractor = new LocalPDFExtractor();
// extractor.extractText('http://example.com/path/to/document.pdf')
//   .then(result => console.log(result));
