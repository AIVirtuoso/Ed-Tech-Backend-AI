"use strict";
const PineconeStore = require('langchain/vectorstores/pinecone').PineconeStore;
const BufferMemory = require('langchain/memory').BufferMemory;
const HumanChatMessage = require('langchain/schema').HumanChatMessage;
const AIChatMessage = require('langchain/schema').AIChatMessage;
const ChatOpenAI = require('langchain/chat_models/openai').ChatOpenAI;
const ConversationalRetrievalQAChain = require('langchain/chains').ConversationalRetrievalQAChain;
const chatHistory = require('./chatHistory');
const config = require('./config').config;
const PineconeClient = require('@pinecone-database/pinecone').PineconeClient;
const OpenAIEmbeddings = require('langchain/embeddings/openai').OpenAIEmbeddings;
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { apikey } = config['openai'];
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const embedding = new OpenAIEmbeddings({
    openAIApiKey: apikey,
    batchSize: 2048,
    stripNewLines: true
});
const preparePinecone = async () => {
    const pinecone = new PineconeClient();
    // @ts-ignore
    const { apikey, environment, index } = config['pinecone'];
    await pinecone.init({
        apiKey: apikey,
        environment
    });
    return pinecone.Index(index);
};
const getDocumentVectorStore = async ({ studentId, documentId }) => {
    const pineconeIndex = await preparePinecone();
    return await PineconeStore.fromExistingIndex(embedding, {
        pineconeIndex,
        namespace: studentId,
        filter: { documentId: { $eq: `${documentId}` } }
    });
};
const aiPrompt = (message) => {
    return ` - Chat History: ${JSON.stringify(chatHistory)} - Document Context: The pdf document
  - Current Message: ${message} 
  Instructions:
  1. Understand the current message. 
  2. If you deduce that the user is asking for more information/context, use the chat history and document to provide additional context. If no specific context is found, ask the user for clarification, also use the chat history to provide a list of suggestions. 
 3. Answer using the PDF document and chat history for context. Keep answers concise, engaging, and informative.
 4. Use markdown for formatting. 
 5. Propose three follow-up discussions based on the information in bullet points. 
 6. Do not engage in discussions outside the user's query. 
 Question: ${message} Answer: `;
};
async function getAIResponse(studentId, documentId, message) {
    const vectorStore = await getDocumentVectorStore({ studentId, documentId });
    const convoHistory = [...chatHistory];
    const userMessage = {
        role: 'User',
        message: message
    };
    const model = new ChatOpenAI({
        openAIApiKey: apikey
    });
    const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorStore.asRetriever(30), {
        memory: new BufferMemory({
            memoryKey: 'chat_history',
            inputKey: 'question',
            outputKey: 'text'
        })
    });
    const question = aiPrompt(message);
    const response = await chain.call({ question, chat_history: convoHistory });
    let aiMessage = {};
    if (response && response.text) {
        aiMessage = {
            role: 'AI',
            message: response.text
        };
    }
    else {
        throw new Error('No response from AI');
    }
    // Append new messages to the chat history
    convoHistory.push(userMessage);
    convoHistory.push(aiMessage);
    // Convert the chat history to a string format
    const content = 'module.exports = ' + JSON.stringify(convoHistory, null, 2) + ';';
    // Write the updated chat history back to the file
    fs.writeFileSync(path.join(__dirname, 'chatHistory.js'), content);
    return response.text;
}
const studentId = '4906166763aa2579e58c97d';
const documentId = '47a24ac-8e00-4ffe-b749-43698a770f39';
rl.question('Please enter your message: ', function (message) {
    getAIResponse(studentId, documentId, message).then((data) => {
        console.log(data);
        rl.close();
    });
});
return `
  this is a stringified JSON of history of the chat so far: ${JSON.stringify(chatHistory)}
  
   First comprehend the message: ${message}, if the user asks for more, read the chat history and the last chat in the history and also the document, use that to provide more context to the user. 
   
  Using context from the PDF document supplied and the chat history provided, answer any questions the user asks. Make your answers brief, exciting and informative. Be charming and have a personality.
    
    Suggest follow-up discussions based on the information, and format them in bullet points of three discussions.
    
    Make your answers in markdown.

    Do not discuss with me. 
    
    If the user asks for more information use chat history and the information in document to provide more information. 
    
    
    My question is: ${message}
  
    Your answer`;
