const fs = require('fs');// Modern HTML parser
const axios = require('axios');
const os = require('os');
const cheerio = require('cheerio');

//   ./Llama-3.2-1B-Instruct.Q6_K.llamafile --port 1337 --host 0.0.0.0     
// Configuration
const config = {
  inputFile: 'test_1.html',
  outputFile: 'translated.html',
  llmServer: 'http://localhost:1337/v1/chat/completions',
  chunkSize: 2000, // Smaller chunks to avoid memory issues
  maxWorkers: Math.max(1, os.cpus().length - 1), // Leave one CPU core free
  progressInterval: 1000, // Log progress every 1000 chunks
  translationPrompt: (text) => `Translate this to Vietnamese:\n${text}. This text can include HTML tags. Please keep the HTML tags intact and only translate the text content. Please make sense the text with previous text I gave you and next text, since every text is embeded in a div or span tag, so it will not make sense individually. Just return me the translated text, nothing else`
};

function translateText(text) {
  return new Promise((resolve, reject) => {
    axios.post(config.llmServer, {
      messages: [{
        role: "user",
        content: config.translationPrompt(text)
      }],
      // max_tokens: 1000,
      temperature: 0.7,
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    })
    .then(response => {
      resolve(response.data.choices[0].message.content);
    })
    .catch(error => {
      console.error('Error details:', error.response?.data || error.message);
      resolve(text); // Fallback to original text
    });
  });
}

/**
 * Translate HTML content while preserving structure
 */
async function translateHTML(inputFilePath, outputFilePath) {
  const htmlContent = fs.readFileSync(inputFilePath, 'utf8');
  const $ = cheerio.load(htmlContent);

  // Iterate over text nodes and translate them
  const promises = [];
  $('*').each(function () {
    const element = $(this);
    if (element.text().trim()) {
      const originalText = element.text().trim();
      promises.push(
        translateText(originalText).then((translatedText) => {
          element.text(translatedText);
        })
      );
    }
  });

  await Promise.all(promises);

  // Save the translated HTML
  fs.writeFileSync(outputFilePath, $.html(), 'utf8');
}

// Example usage
(async () => {
  const inputFilePath = config.inputFile; // Path to your input HTML file
  const outputFilePath = config.outputFile; // Path for the translated output file

  await translateHTML(inputFilePath, outputFilePath);
  console.log('Translation complete! Translated file saved as:', outputFilePath);
})();