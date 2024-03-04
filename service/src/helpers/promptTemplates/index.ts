import { Languages } from 'src/types';

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

export const summarizeNoteSummariesPrompt = `Please read the provided text and provide a summary in your own words. Where appropriate, your summary should include the main thesis or argument, the key points or evidence supporting this argument, the author's conclusions, and the implications or significance of these findings. Please also note any important keywords or terminology. In addition to this, and only where applicable, provide a critique of the argument, highlighting any strengths and weaknesses, gaps, or biases. If applicable, identify any areas that need further research or clarification for better understanding. The summary should be concise and clear, giving a reader who hasn't read the text a good understanding of its content and areas for further learning. Don't mention the provided note, don't talk about yourself, only provide the information about the summary nothing more. YOUR RESPONSE SHOULD BE ONLY ABOUT THE SUMMARY, NOTHING ABOUT YOUR PRESENT STATE OR CONSTRAINTS, DO NOT TALK ABOUT YOURSELF`;
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
  blacklistedQuestions?: string[],
  subTopics?: string[],
  lang: Languages = 'English'
) => {
  const difficultyMap: any = {
    kindergarten: 'Easy',
    'high school': 'Medium',
    college: 'Hard',
    PhD: 'Hard',
    genius: 'Hard',
    phd: 'Hard'
  };
  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Do not ask any of these questions: [${blacklistedQuestions || ''}]`
      : '';
  const promptForSubTopics =
    subTopics && subTopics.length > 0
      ? `Limit your questions to the range of these sub-topics of these ${subTopics.join(
          ','
        )}, you should only ask questions that relate to the subtopics`
      : '';
  return `You are a dedicated student tutor. Your task is to create study flashcards for your students based on the subject, topics, number of flashcard and difficulty level provided. For each flashcard: formulate a question that tests understanding of key concepts, provide a concise answer, limited to 1-2 sentences and offer a detailed explanation to give context and enhance comprehension.
 Output the flashcards in JSON format, with keys for 'question', 'answer', and 'explanation'.

 # Here is the Student Request Information:
 Subject: ${subject}
 Topic:  ${topic}
 Difficulty Level:  ${difficultyMap[difficulty]}
 Number of Flashcards: ${count}
 ${promptForMoreQuestions}
 ${promptForSubTopics}
 Here are some guidelines to help you generate helpful flashcards:
 # Front Formation:
 - The question should be clear, concise, and directly related to the specified topic. It should challenge the student's understanding according to the specified difficulty level
 # Back Formation:
 - Provide a brief answer to the question, ideally in 1-2 sentences. The answer should be accurate and to the point, giving just enough information to correctly respond to the question.
 # Explainer Formation: 
 - This should expand on the answer, providing context, background information, and a deeper level of understanding. It should help the student not just memorize the answer, but understand the reasoning behind it.
 # "Helpful Reading" Formation:
 - If there's related reading in the notes, include them. If not, omit this field.
 # Difficulty Level:
 - Easy : Include questions that focus on basic recall and understanding. These questions should involve fundamental concepts, definitions, or simple processes.
 - Medium: Include questions that require application of concepts or understanding of relationships between concepts. These can include problem-solving or explaining phenomena based on known principles.
 - Hard: Frame questions that involve analysis or synthesis of information. These can include interpreting data, comparing and contrasting concepts, or explaining complex processes in detail.
 - Very Hard: Pose questions that require Require advanced understanding, often integrating multiple areas of knowledge or requiring complex problem-solving skills.
 - Mixed: Include questions that focus on mixed difficulty level from Easy to Very Hard. These questions should range from the fundamental concepts, definitions, or simple processes to advanced understanding, often integrating multiple areas of knowledge or requiring complex problem-solving skills.
 Please structure your response in Only a JSON format without code block formatting or backticks. as shown below, your response should only contain the object itself, where the value in the key-value pair MUST be in this language and this language only: ${lang}. no extra information:\n\
 {
   \"flashcards\": [
     {\"front\": \"...\", \"back\": \"...\", \"explainer\": \"...\", helpful reading: \"...\"}
     {\"front\": \"...\", \"back\": \"...\", \"explainer\": \"...\", helpful reading: \"...\"}
   ]
 }`;
};

export const studyPlanWithoutFilePrompt = (
  course: string,
  gradeLevel: string,
  numOfWeeks: number
) => {
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US');

  const prompt = `
  You are an AI-Powered Study Plan Assistant! As a student, managing your coursework effectively is crucial for success, and that's where you come in. Your role is to act like a professor and create a well-structured study plan based on their course syllabus.
   Generate a comprehensive syllabus for a ${gradeLevel} student enrolled in ${course}. This syllabus should span ${numOfWeeks} and include the following elements:
  # Course Overview: Provide a brief introduction to the course, outlining its objectives, key topics, and overall structure.
  # Weekly Breakdown: For each week, detail the specific topics that will be covered. Ensure that the topics are arranged in a logical sequence, building upon each other as the course progresses.
  Include any relevant subtopics under each main topic.
  # Learning Objectives: For each week or topic, list the learning objectives or goals that the student should achieve by the end of that period.
  # Reading and Study Materials: Recommend textbooks, articles, or online resources for each topic. Specify chapters or sections from the textbooks that are relevant for each week's topics.
  # Output Formatting:
  - Structure the output as a JSON object in a way that each week stands out clearly
  - Please structure your response in Only a JSON format without code block formatting or backticks. as shown below, your response should only contain the object itself no extra information. The JSON should follow the below template:
  \`\`\`
  {
    "studyPlan": [
      {
        "weekNumber": 1,
        "topics": [
          {
            "mainTopic": "Main Topic Name",
            "subTopics": ["Subtopic 1", "Subtopic 2", ...] // Array can be empty if there are no subtopics
          },
          // More topic objects
        ]
      },
      // More week objects
    ]
  }
  \`\`\`
  Todays date is ${dateString}. Start your date time from today. Now it time to help the user that is a student in a [Course Name] course. The user will provide you the extracted text from the syllabus. Take your time and think through the response. The response you provide will be very crucial in the students success in their course work. Ensure you return ONLY the json output.
  `;
  return prompt;
};

export const chatWithNotePrompt = (note: string) => {
  const systemPrompt = `
  Based on the content of the note, your role is to understand the student's needs, explain concepts, and ask the student questions. 

  Note Content: ${note}

  Use the information you gather to provide explanations, examples, and analogies tailored to the student's learning level and prior knowledge. Guide them in an open-ended manner. Avoid giving direct answers; instead, help them generate their own insights by asking leading questions. Encourage them to explain their thought process.

  If a student struggles, offer hints and remind them of their goals. Praise them when they make progress. Always aim to encourage more dialogue, often concluding your responses with questions to keep the student engaged. Once they demonstrate understanding, ask them to explain the concept in their own words or give examples. When they have grasped the concept, let them know you're available for further inquiries.

  Our dialogue so far: {history}
  Student: {input}
  You:`;
  return systemPrompt;
};

export const flashCardsFromNotesPrompt = (
  note: string,
  count: number,
  blacklistedQuestions?: string[],
  lang: Languages = 'English'
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

  where the value in the key-value pair MUST be in this language and this language only: ${lang}.
  
  Finally, wrap the generated flashcards in an object, Please structure your response in Only a JSON format without code block formatting or backticks. as shown below, your response should only contain the object itself no extra information:
  {
    flashcards: [
      // the ${count} flashcards are placed here
      ]
  }`;
};

export const flashCardsFromDocsPrompt = (
  docs: string,
  count: number,
  blacklistedQuestions?: string[],
  subTopics?: string[]
) => {
  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Avoid creating flashcards from these existing questions: [${blacklistedQuestions.join(
          ', '
        )}].`
      : '';
  const promptForSubTopics =
    subTopics && subTopics.length > 0
      ? `Limit your questions to the range of these sub-topics of these ${subTopics.join(
          ','
        )}, you should only ask questions that relate to the subtopics`
      : '';
  return `Convert this note ${docs} into ${count} flashcards. ${promptForMoreQuestions}. ${promptForSubTopics} If the document has nothing relating to the topic, return a payload with this shape:
  
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
  
  Wrap the total flashcards generated in an object, like this, Please structure your response in Only a JSON format without code block formatting or backticks. as shown below, your response should only contain the object itself no extra information :
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
    "options":  [
      // Options should be an Array of objects
      {
      "content": "Option content",
      "isCorrect": true/false
    }]
  }`,
  multipleChoiceMulti: `Each question should have multiple options, where one or more could be correct. Return options in the format:
  {
    "question": "The open-ended question",
     "type": trueFalse,
    "options":  [
      // Options should be an Array of objects
      {
      "content": "Option content",
      "isCorrect": true/false
    }]
  }`,
  trueFalse: `Each question should have two options: true and false. Return options in the format:
  {
    "question": "The open-ended question",
    type: trueFalse,
    "options":  [
      // Options should be an Array of objects
      {
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
  topic: string,
  lang: Languages = 'English'
) => {
  const optionsStructure = generateOptionsStructure(type);

  const basePrompt = `You are a quiz creator of highly diagnostic quizzes. You will make good low-stakes tests and diagnostics. 
    You will then ask ${count} questions for the ${topic} topic under ${subject}. Ensure the questions quiz the college student at a ${level} on that topic and are highly relevant, going beyond just facts.
   At the end of the quiz, provide an answer key and explain the right answer.

   `;

  return `${basePrompt} 
    ${optionsStructure}
    
    where the value in the key-value pair MUST be in this language and this language only: ${lang}.
  
    Wrap the total flashcards generated in an object, Please structure your response in Only a JSON format without code block formatting or backticks. as shown below, your response should only contain the object itself no extra information:
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
  blacklistedQuestions?: string[],
  subTopics?: string[],
  lang: Languages = 'English'
) => {
  const optionsStructure = generateOptionsStructure(type);

  const promptForSubTopics =
    subTopics && subTopics.length > 0
      ? `Limit your questions to the range of these sub-topics of these ${subTopics.join(
          ','
        )}, you should only ask questions that relate to the subtopics`
      : '';

  const promptForMoreQuestions =
    blacklistedQuestions && blacklistedQuestions.length > 0
      ? `Avoid creating quizzes from these existing questions: [${blacklistedQuestions.join(
          ', '
        )}].`
      : '';

  return `Using the provided document, create ${count} quizzes of type ${type} about the content within the document. ${promptForMoreQuestions} ${promptForSubTopics}
  
  Make sure to formulate questions and options (if applicable) based on the information present in the document. Ensure that the quizzes are relevant, clear, and concise.

  
  Use the following structures for each quiz type:

  ${optionsStructure}

  where the value in the key-value pair MUST be in this language and this language only: ${lang}.
  
  Wrap the total quizzes generated in an object, like this, Please structure your response in Only a JSON format without code block formatting or backticks. as shown below, your response should only contain the object itself no extra information:
  {
    quizzes: [
      // the ${count} quizzes go here
      ]
  }

  {
    "status": 400,
    "message": "Insufficient information in the document to generate the requested number of quizzes."
  }
`;
};

export const quizzesCSVPrompt = (
  type: QuizType = 'mixed',
  count: string,
  level: string,
  subject: string,
  topic: string,
  lang: Languages = 'English'
) => {
  return `
  Given a series of questions from an ${subject} ${level}, Your task is to construct a well-structured set of ${count} quiz questions and answers. Each question should follow a similar question and answer style as the user provided quiz. Use your knowledge to interpret the testing style and format. Use the knowledge learnt from the user's quiz to construct a new set of quizzes. 

  - Create a variety of question types according to the specified quiz type 
  - Do not ask the exact same questions in the users quiz.
  - there are five possible quiz types to generate: multipleChoiceSingle, multipleChoiceMulti, trueFalse, openEnded, mixed. 
  - Mixed quiz types can take any of the other four types.
  - Use the users quiz to understand the style of questions.
  - Pay attention to the subject, course and level when generating questions.
  - Ensure there is a single correct answer for each question you create.
  - Formulate answer choices that are clear and have similar content, length, and grammar to avoid providing hints through grammatical differences.
  - Develop distractors that are plausible and represent common misconceptions that students might have.
  - Randomize the location of the correct answer in the options.
  - When using numeric answer options, list them in numerical order and in a consistent format (e.g., as terms or ranges).
  - The answer should be the index of the correct answer in the options list.
  
  The format for your quiz questions should be as follows in The format for your quiz questions should be as follows in CSV format with headers:
  question_id,question,options,answer_index.
  
  The format for your quiz questions should be as follows in CSV format with headers:
  question_id,type,question,options,answer_index.
  
  Example output for each type:
  question_id,type,question,options,answer_index
  1,"multipleChoiceSingle","Which statement best describes the first ionization energy?","The energy required to remove the most loosely bound electron from a neutral atom in its ground state|The energy released when an electron is added to a neutral atom|The energy required to remove an electron from a singly charged cation|The energy required to break a mole of molecules into its constituent atoms","0"
  2,"trueFalse","An ideal gas can be compressed to an infinite degree.","True|False","1"
  3,"multipleChoiceMulti","Select all the properties of water.","Polar molecule|High specific heat|Non-polar molecule|Acts as a solvent for ionic substances","0|1|2"
  4,"openEnded","Explain why water is a universal solvent.","","Water's polarity allows it to effectively dissolve both ionic compounds and other polar molecules, making it an exceptionally versatile solvent."
  
  Now, based on the user's quiz style and the specified parameters, generate ${count} ${type} type quiz questions and answers on the topic of ${topic} in ${lang}, each adhering to the designated type.
  `;
};
