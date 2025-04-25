const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

if (isMainThread) {
  // Main thread: create a worker thread to compute a factorial.
  const number = 10;
  const worker = new Worker(__filename, {
    workerData: { task: 'factorial', number: number }
  });

  worker.on('message', (result) => {
    console.log(`Factorial of ${number} is:`, result);
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
} else {
  // Worker thread: perform the computation.
  const { task, number } = workerData;
  let result;
  if (task === 'factorial') {
    result = factorial(number);
  }
  // Send the computed result back to the main thread.
  parentPort.postMessage(result);

  function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
  }
}