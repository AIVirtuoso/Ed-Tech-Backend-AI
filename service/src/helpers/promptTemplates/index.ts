type QuizType =
  | 'multipleChoiceSingle'
  | 'multipleChoiceMulti'
  | 'trueFalse'
  | 'openEnded'
  | 'mixed';

export const systemPrompt = `You are a friendly, enthusiastic and pleasant study helper receives context from things I'm reading and uses that context to answer my questions. Your tone is conversational, and even when you're not sure what the answer to a question is, you are never terse, but helpful. You can also draw from our previous conversations to make recommendations if you're uncertain how to answer my questions. Do not break character by mentioning that you're an AI model, do not talk about your limitations — only figure out ways to help within the context of the snippets I send you and our previous conversations. To create the impression that you're a friendly and lively helper, include human elements in your response, such as commenting on my question (eg: 'that's an interesting question!') or suggesting a better question to ask.
Don't say things about 'provided context' either. If you don't have enough context to answer a question, helpfully suggest thay they rephrase the question as sometimes a differently-phrased question can help you find the answer.
  Make sure all your answers are in markdown syntax.
  `;

export const homeworkHelpPrompt = (topic: string) =>
  `You're an incredibly intelligent, incredibly empathetic ${topic} teacher. Your approach to teaching is to take the student through a step-by-step process, explaining the concepts to them, asking them questions to see if they understand, and when they don't, you correct them. You lead the conversation, ask pop quiz questions, make illustrations and draw parallels and consistently ask questions to gauge their understanding.
  
  Make sure all your answers are in markdown syntax.
  `;

export const summarizeNotePrompt = `Please read the provided note and provide a summary in your own words. Where appropriate, your summary should include the main thesis or argument, the key points or evidence supporting this argument, the author's conclusions, and the implications or significance of these findings. Please also note any important keywords or terminology. In addition to this, and only where applicable, provide a critique of the argument, highlighting any strengths and weaknesses, gaps, or biases. If applicable, identify any areas that need further research or clarification for better understanding. The summary should be concise and clear, giving a reader who hasn't read the note a good understanding of its content and areas for further learning.`;

export const conversationDescriptionPrompt = `Can you structure a very concise but precise takeaway on our discussion using these headers 1. What student needs help with 2. What student understands`;

export const generateDocumentKeywordsPrompt = (
  note: JSON
) => `Condense the supplied note into an array of keywords. The keywords are the most crucial words or phrases that you think is worth discussing with me, and capture the essence of the note. Each keyword should be no longer than five words.

  The shape of the array should be: ["keyword1", "keyword2", "etc"]
  
  Here is the note: ${JSON.stringify(note, null, 2)}`;

export const mnemonicPrompt = (
  query: string
) => `You are a mnemonic generator. When you receive input, you try to understand the context, paying attention to the first letters in the input, and then you will come up with a catchy, memorable one-liner that helps with memorizing the input. You will then explain how the one-liner works, and the cognitive shortcuts it helps the user internalize. Your input is: ${query}. Return only A JSON response in this format: 
        
        {
          "status": "200, if you succeeded, or 500 if you couldn't come up with an answer, or 400 if the request made no sense",
          explainer: {
            "answer": "The actual mnemonic",
            "context": "Your exhaustive explanation for how, and why, the mnemonic works",
          }
        }
        `;

export const generalFlashcardPrompt = (
  count: string,
  difficulty: string,
  subject: string,
  topic: string,
  blacklistedQuestions?: string[]
) => {
  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Do not ask any of these questions: [${blacklistedQuestions || ''}]`
      : '';
  return `Generate ONLY ${count} ${difficulty}-grade flash cards based on this ${subject} topic: ${topic}. Make sure your flash cards at exactly at a ${difficulty} level — no harder or simpler. 
  Do not include any explanations, ${promptForMoreQuestions}. Only provide a RFC8259 compliant JSON response following this format without deviation:
   {
    "front": "Flash card question, suitable for a ${difficulty} level",
    "back": "Answer/completion of the flash card question, also written to be understood by someone at a $difficulty} education level.",
    "explainer": "helpful explanation of the answer (ie, back of flashcard) that disambiguates the topic further for the student. The explanation shobe at a ${difficulty} level.",
    "helpful reading": "related topics and materials pertaining to the topic. Don't include links, just textbook references."
  }
          
  Wrap the total flashcards generated in an object, like this:
          
   {
     flashcards: [
      // the ${count} flashcards go here
    ]
  }`;
};

export const flashCardsFromNotesPrompt = (
  note: string,
  count: number,
  blacklistedQuestions?: string[]
) => {
  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Avoid creating flashcards from these existing questions: [${blacklistedQuestions.join(
          ', '
        )}].`
      : '';
  return `
  Generate ${count} flashcards from the data within the square brackets: [${note}]. ${promptForMoreQuestions}Remember:
  1. Do not use or get influenced by metadata like 'textColor', 'backgroundColor', etc. Only use these for noting new lines or important content.
  2. Your primary source of information is the 'text' property inside each 'content' field.
  3. If the note doesn't have relevant content , return a payload in the following shape:
  {
    "status": 400,
    "message": "Your supplied topic is not covered in the note specified."
  }
  
  Convert the parsed text into flashcards, using the following format:
  {
    "front": "front of flash card — as a question",
    "back": "back of flashcard — as an answer to the question from the front",
    "explainer": "ELI5-type explanation of the answer that disambiguates the topic further",
    "helpful reading": "If there's related reading in the notes, include them. If not, omit this field."
  }
  
  Finally, wrap the generated flashcards in an object:
  {
    flashcards: [
      // the ${count} flashcards are placed here
      ]
  }`;
};

export const flashCardsFromDocsPrompt = (
  docs: string,
  count: number,
  blacklistedQuestions?: string[]
) => {
  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Avoid creating flashcards from these existing questions: [${blacklistedQuestions.join(
          ', '
        )}].`
      : '';
  return `Convert this note ${docs} into ${count} flashcards. ${promptForMoreQuestions}. If the document has nothing relating to the topic, return a payload with this shape:
  
  {
    "status": 400,
    "message": "Your supplied topic is not covered in the note specified."
  }
  
  Only use context from the note in generating the flash cards. Use snippets of the note to formulate both the front and back properties of the JSON object. Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation:
  
  {
    "front": "front of flash card — as a question",
    "back": "back of flashcard — as an answer to the question from the front",
    "explainer": "helpful, ELI5-type explanation of the answer (ie, back of flashcard) that disambiguates the topic further for the student",
    "helpful reading": "If there is related reading in the notes, include them. Otherwise omit this field."
  }
  
  Wrap the total flashcards generated in an object, like this:
  {
    flashcards: [
      // the ${count} flashcards go here
      ]
  }`;
};

const promptStructures = {
  multipleChoiceSingle: `Each question should have multiple options, with only one being correct. Return options in the format:
  {
    "question": "The open-ended question",
     "type": trueFalse,
    "options":  [{
      "content": "Option content",
      "isCorrect": true/false
    }]
  }`,
  multipleChoiceMulti: `Each question should have multiple options, where one or more could be correct. Return options in the format:
  {
    "question": "The open-ended question",
     "type": trueFalse,
    "options":  [{
      "content": "Option content",
      "isCorrect": true/false
    }]
  }`,
  trueFalse: `Each question should have two options: true and false. Return options in the format:
  {
    "question": "The open-ended question",
    type: trueFalse,
    "options":  [{
      "content": "true/false",
      "isCorrect": true/false
    }]
  }`,
  openEnded: `Each question requires a concise answer without options. Return in the format:
  {
    "question": "The open-ended question",
     type: openEnded,
    "answer": "Direct answer to the question",
    "explanation": "Explanation of the answer"
  }`
};

const generateOptionsStructure = (type: QuizType) => {
  if (type === 'mixed') {
    return `Generate a mix of question types: multiple choice (single and multiple answers), true/false, and open-ended. Use the appropriate formats:
  Multiple Choice (Single Answer): 
  ${promptStructures.multipleChoiceSingle}
  
  Multiple Choice (Multiple Answers): 
  ${promptStructures.multipleChoiceMulti}
  
  True/False:
  ${promptStructures.trueFalse}
  
  Open-Ended:
  ${promptStructures.openEnded}`;
  }

  return promptStructures[type] || '';
};

export const generalQuizPrompt = (
  type: QuizType = 'mixed',
  count: string,
  level: string,
  subject: string,
  topic: string
) => {
  const optionsStructure = generateOptionsStructure(type);

  const basePrompt = `You are a quiz creator of highly diagnostic quizzes. You will make good low-stakes tests and diagnostics. 
    You will then ask ${count} questions for the ${topic} topic under ${subject}. Ensure the questions quiz the college student at a ${level} on that topic and are highly relevant, going beyond just facts.
   At the end of the quiz, provide an answer key and explain the right answer. `;

  return `${basePrompt} 
    ${optionsStructure}
    Wrap the total flashcards generated in an object, Only provide a RFC8259 compliant JSON response following this format without deviation::
  {
    quizzes: [
      // the ${count} quizzes go here
      ]
  }`;
};

export const quizzesFromDocsPrompt = (
  docs: string,
  count: number,
  type: QuizType = 'mixed',
  blacklistedQuestions?: string[]
) => {
  const optionsStructure = generateOptionsStructure(type);

  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Avoid creating quizzes from these existing questions: [${blacklistedQuestions.join(
          ', '
        )}].`
      : '';

  return `Using the provided document, create ${count} quizzes of type ${type} about the content within the document. ${promptForMoreQuestions}
  
  Make sure to formulate questions and options (if applicable) based on the information present in the document. Ensure that the quizzes are relevant, clear, and concise.

  Use the following structures for each quiz type:

  ${optionsStructure}

  Wrap the total quizzes generated in an object, like this:
  {
    quizzes: [
      // the ${count} quizzes go here
      ]
  }

  If the document does not have enough information to generate ${count} quizzes of type ${type}, return a payload with this shape:
  {
    "status": 400,
    "message": "Insufficient information in the document to generate the requested number of quizzes."
  }
`;
};
