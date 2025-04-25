const express = require('express');
const path = require('path');
const fs = require('fs');
const ngrok = require('@ngrok/ngrok');

const app = express();
const port = 3001;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/goc', (req, res) => {
  console.log('Request received for /goc');
  const filePath = path.join(__dirname, 'public', 'translated.html');
  console.log('Attempting to stream english.html', filePath);

  const stream = fs.createReadStream(filePath);
  stream.on('error', err => {
    console.error('Error streaming english.html:', err);
    res.status(500).send('Error streaming english.html');
  });
  stream.pipe(res);
});

// Fallback route for SPA (optional)
app.get('/en', (req, res) => {
  console.log('Request received for /');
  try {
    console.log('Attempting to send index.html', path.join(__dirname, 'public', 'english.html'));
    res.sendFile(path.join(__dirname, 'public', 'english.html'));
  } catch (err) {
    console.error('Error serving index.html:', err);
    res.status(500).send('Error serving index.html');
  }
});

app.get('/vn', (req, res) => {
  console.log('Request received for /translated');
  try {
    console.log('Attempting to send translated.html', path.join(__dirname, 'public', 'translated.html'));
    res.sendFile(path.join(__dirname, 'public', 'translated.html'));
  } catch (err) {
    console.error('Error serving translated.html:', err);
    res.status(500).send('Error serving translated.html');
  }
});



// Start the server
app.listen(port, async () => {
  console.log(`Server running locally at http://localhost:${port}`);
  try {
    // Expose your server with ngrok
    // Ensure your NGROK_AUTHTOKEN environment variable is set, or pass it directly.
    const url = await ngrok.connect({ addr: port, authtoken: "2u6iHG5E2EHu10xeYb9MYpScM8P_22HSzGicpHQLyRH2A39uc" });
    console.log(`Ngrok tunnel established at: ${url.url()}`);
  } catch (error) {
    console.error('Error establishing ngrok tunnel:', error);
  }
});
