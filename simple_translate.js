const axios = require('axios');

async function translateText(text) {
  try {
    const response = await axios.post('http://localhost:1337/v1/chat/completions', {
      messages: [{
        role: "user",
        content: `Translate this text to Vietnamese: "${text}"`
      }],
      max_tokens: 1000,
      temperature: 0.7,
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });
    return response.data.choices[0].message.content; // Adjust based on response
  } catch (error) {
    console.error('Error details:', error.response?.data || error.message);
    return text;
  }
}

(async () => {
  const text = "Hello, how are you?";
  const translatedText = await translateText(text);
  console.log('Translated Text:', translatedText);
})();