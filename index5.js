// translateHTML.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');

// Configuration
const config = {
  inputFile: 'test_1.html',
  outputFile: 'translated.html',
  llmServer: 'http://localhost:1337/v1/chat/completions',
  // Left one core free
  maxWorkers: Math.max(1, os.cpus().length - 1),
};

async function translateHTML(inputFilePath, outputFilePath) {
  // Load and parse HTML
  const htmlContent = fs.readFileSync(inputFilePath, 'utf8');
  const $ = cheerio.load(htmlContent);

  // Extract text nodes and store associated cheerio elements
  let tasks = [];
  let elements = [];
  $('*').each(function () {
    const text = $(this).text().trim();
    if (text) {
      tasks.push({ id: tasks.length, text });
      elements.push($(this));
    }
  });

  const totalTasks = tasks.length;
  console.log(`Found ${totalTasks} text nodes to translate.`);

  // Initialize CLI progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(totalTasks, 0);

  // Variables for tracking progress and results
  let completedTasks = 0;
  const results = {};
  const taskQueue = tasks.slice(); // Clone the tasks list

  // Create a pool of workers
  const workers = [];
  console.log('Max workers:', config.maxWorkers);
  for (let i = 0; i < 5; i++) {
    const workerPath = path.join(__dirname, 'translate_worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        // Pass configuration if needed (e.g. llmServer)
        llmServer: config.llmServer,
      },
    });

    worker.on('message', (msg) => {
      // Receive translated text result from the worker
      results[msg.id] = msg.translation;
      completedTasks++;
      progressBar.update(completedTasks);

      // Assign next task if available
      if (taskQueue.length > 0) {
        const nextTask = taskQueue.shift();
        worker.postMessage(nextTask);
      } else {
        // No tasks left, close this worker
        worker.terminate();
      }
    });

    worker.on('error', (err) => {
      console.error('Worker encountered an error:', err);
    });

    workers.push(worker);
  }

  // Start the initial tasks for all workers
  workers.forEach((worker) => {
    if (taskQueue.length > 0) {
      const task = taskQueue.shift();
      worker.postMessage(task);
    }
  });

  // Wait until all tasks are completed
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (completedTasks === totalTasks) {
        clearInterval(interval);
        progressBar.stop();
        resolve();
      }
    }, 500);
  });

  // Update the HTML with the translated text
  tasks.forEach((task, index) => {
    if (results[task.id]) {
      elements[index].text(results[task.id]);
    }
  });

  // Write out the translated HTML to a file
  fs.writeFileSync(outputFilePath, $.html(), 'utf8');
  console.log('Translation complete! Translated file saved as:', outputFilePath);
}

// Execute translation
translateHTML(config.inputFile, config.outputFile);
