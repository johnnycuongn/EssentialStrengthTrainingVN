// translateWorker.js
const { parentPort, workerData } = require('worker_threads');
const axios = require('axios');

// Use the LLM server URL passed down from the main process (or default)
const llmServer = 'http://localhost:1337/v1/chat/completions';

// Function to create a prompt for translation
function translationPrompt(text) {
  return `Translate this text to Vietnamese: \n${text}`;
}

// Worker function to translate text using axios
async function translateText(text) {
  console.log('Translating text:', text);
  try {
    const response = await axios.post(
      llmServer,
      {
        messages: [
          {
            role: 'user',
            content: translationPrompt(text),
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Response:', response.data.choices[0].message.content);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error in worker:', error.response?.data || error.message);
    // Return original text on error
    return text;
  }
}

// Listen for tasks from the main thread
parentPort.on('message', async (task) => {
  const translatedText = await translateText(task.text);
  // Send back the result with its task ID
  parentPort.postMessage(translatedText);
});