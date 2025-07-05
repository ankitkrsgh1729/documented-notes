# Node.js: Child Processes, Routing, and Process Management - Study Notes

## Table of Contents
1. [Child Process Module](#child-process-module)
2. [spawn() vs fork()](#spawn-vs-fork)
3. [Express Router vs Direct app.use()](#express-router-vs-direct-appuse)
4. [Creating New Processes](#creating-new-processes)
5. [Real-World Examples](#real-world-examples)
6. [Quick Reference Tables](#quick-reference-tables)

---

## Child Process Module

### What is child_process?
The `child_process` module allows Node.js to create and manage separate operating system processes. It's Node.js's solution to overcome the single-threaded limitation for CPU-intensive tasks.

### Why Do We Need It?

#### The Problem:
```javascript
// BAD: This blocks the entire application
function heavyComputation(n) {
  let result = 0;
  for (let i = 0; i < n; i++) {
    result += Math.random();
  }
  return result;
}

app.get('/heavy-task', (req, res) => {
  const result = heavyComputation(10000000); // BLOCKS everything!
  res.json({ result });
});

// While computation runs, ALL other requests are blocked
// Server becomes unresponsive
```

#### The Solution:
```javascript
// GOOD: Use child process for heavy computation
const { fork } = require('child_process');

app.get('/heavy-task', (req, res) => {
  const worker = fork('heavy-worker.js');
  
  worker.send({ task: 'compute', data: 10000000 });
  
  worker.on('message', (result) => {
    res.json({ result });
    worker.kill(); // Clean up
  });
});

// heavy-worker.js
process.on('message', (msg) => {
  if (msg.task === 'compute') {
    const result = heavyComputation(msg.data);
    process.send({ result });
  }
});
```

### Key Benefits:
- **Non-blocking**: Main thread remains responsive
- **CPU utilization**: Can use multiple CPU cores
- **Isolation**: Child process crashes don't affect main process
- **Scalability**: Can spawn multiple workers

---

## spawn() vs fork()

### Core Differences

| Feature | spawn() | fork() |
|---------|---------|---------|
| **Purpose** | Execute any system command | Run Node.js scripts only |
| **Communication** | Streams (stdout/stderr) | IPC (Inter-Process Communication) |
| **Data Transfer** | Text streams | JavaScript objects |
| **Memory Usage** | Lower | Higher (new V8 instance) |
| **Use Case** | System commands, utilities | CPU-intensive Node.js tasks |

### spawn() - System Commands

```javascript
const { spawn } = require('child_process');

// Execute system commands
const ls = spawn('ls', ['-la', '/usr']);

ls.stdout.on('data', (data) => {
  console.log(`Output: ${data}`);
});

ls.stderr.on('data', (data) => {
  console.error(`Error: ${data}`);
});

ls.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});
```

### fork() - Node.js Processes

```javascript
const { fork } = require('child_process');

// Create Node.js child process
const child = fork('worker.js');

// Send JavaScript objects
child.send({ 
  task: 'processData', 
  data: [1, 2, 3, 4, 5] 
});

// Receive JavaScript objects
child.on('message', (result) => {
  console.log('Result:', result);
});

// worker.js
process.on('message', (msg) => {
  if (msg.task === 'processData') {
    const processed = msg.data.map(x => x * 2);
    process.send({ processed });
  }
});
```

### When to Use Which?

#### Use spawn() for:
- Running system commands (`ls`, `grep`, `ffmpeg`)
- Executing shell scripts
- Converting files with external tools
- System administration tasks

#### Use fork() for:
- CPU-intensive JavaScript computations
- Data processing tasks
- Image/video processing with Node.js libraries
- Background job processing

---

## Express Router vs Direct app.use()

### Comparison Overview

| Aspect | Direct app.use() | Router |
|--------|------------------|--------|
| **Best For** | Simple apps, prototypes | Large, complex applications |
| **Organization** | All routes in one file | Modular, separate files |
| **Maintainability** | Becomes messy quickly | Highly maintainable |
| **Team Development** | Merge conflicts | Parallel development |
| **Middleware Scope** | Global or per-route | Per-router group |
| **Reusability** | Limited | High |

### Direct app.use() - Simple Approach

```javascript
const express = require('express');
const app = express();

// All routes in main file
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/users', (req, res) => {
  res.json({ message: 'User created' });
});

app.get('/products', (req, res) => {
  res.json({ products: [] });
});

// Becomes unmanageable as app grows...
```

### Router - Modular Approach

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();

// Router-specific middleware
router.use((req, res, next) => {
  console.log('User route accessed');
  next();
});

router.get('/', (req, res) => {
  res.json({ users: [] });
});

router.post('/', (req, res) => {
  res.json({ message: 'User created' });
});

module.exports = router;

// main app.js
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);
```

### When to Use Router

#### Use Router when:
1. **Application has 10+ routes**
2. **Multiple developers working on different features**
3. **Need different middleware for different route groups**
4. **Building APIs with versioning**
5. **Want to reuse routes across projects**

#### Example: API Versioning with Router
```javascript
// routes/v1/users.js
const router = express.Router();
router.get('/', getUsersV1);
module.exports = router;

// routes/v2/users.js
const router = express.Router();
router.get('/', getUsersV2);
module.exports = router;

// app.js
app.use('/api/v1/users', require('./routes/v1/users'));
app.use('/api/v2/users', require('./routes/v2/users'));
```

---

## Creating New Processes

### What Does "Creating New Processes" Mean?

When Node.js creates a child process, it's asking the **operating system** to create a completely separate process - not a thread within the existing process.

### Process Architecture

```
Operating System
├── Process 1 (PID: 1234) - Main Node.js app
│   ├── Memory: 50MB
│   ├── V8 Engine Instance
│   └── Event Loop Thread
├── Process 2 (PID: 1235) - Child process
│   ├── Memory: 45MB
│   ├── V8 Engine Instance
│   └── Event Loop Thread
└── Process 3 (PID: 1236) - Another child
    ├── Memory: 40MB
    ├── V8 Engine Instance
    └── Event Loop Thread
```

### Proof of Separate Processes

```javascript
// main.js
const { fork } = require('child_process');

console.log('Main Process PID:', process.pid);
console.log('Main Memory:', process.memoryUsage().rss);

const child = fork('child.js');

child.on('message', (msg) => {
  console.log('Child Info:', msg);
});

// child.js
process.send({
  childPID: process.pid,
  parentPID: process.ppid,
  memory: process.memoryUsage().rss
});

// Output:
// Main Process PID: 1234
// Main Memory: 26214400
// Child Info: { childPID: 1235, parentPID: 1234, memory: 25165824 }
```

### Memory Isolation Example

```javascript
// main.js
let mainData = { count: 0 };

const child = fork('child.js');
child.send({ data: mainData });

// Modify main data
mainData.count = 100;
console.log('Main data:', mainData); // { count: 100 }

// child.js
process.on('message', (msg) => {
  let childData = msg.data;
  childData.count = 999;
  console.log('Child data:', childData); // { count: 999 }
  
  // This doesn't affect main process!
  process.send({ childData });
});

// Main process data remains { count: 100 }
// Child process data is { count: 999 }
// Completely separate memory spaces!
```

### Key Characteristics of New Processes

1. **Separate PIDs**: Each process has unique Process ID
2. **Isolated Memory**: Changes in one don't affect others
3. **Independent Resources**: File handles, connections, etc.
4. **Crash Isolation**: One process crash doesn't kill others
5. **CPU Core Utilization**: Each process can use different CPU cores

---

## Real-World Examples

### 1. E-commerce Order Processing

```javascript
// main.js - Web server
const express = require('express');
const { fork } = require('child_process');
const app = express();

app.post('/place-order', async (req, res) => {
  const order = req.body;
  
  // Spawn separate processes for different tasks
  const emailWorker = fork('workers/email-worker.js');
  const inventoryWorker = fork('workers/inventory-worker.js');
  const paymentWorker = fork('workers/payment-worker.js');
  
  // Send tasks to workers
  emailWorker.send({ task: 'send-confirmation', order });
  inventoryWorker.send({ task: 'update-stock', order });
  paymentWorker.send({ task: 'process-payment', order });
  
  // Respond immediately
  res.json({ 
    message: 'Order received',
    orderId: order.id,
    status: 'processing'
  });
});

// workers/email-worker.js
process.on('message', async (msg) => {
  if (msg.task === 'send-confirmation') {
    console.log(`Email worker ${process.pid} processing order ${msg.order.id}`);
    
    // Send email (this runs in separate process)
    await sendConfirmationEmail(msg.order);
    
    process.send({ 
      task: 'email-sent', 
      orderId: msg.order.id,
      workerPID: process.pid
    });
  }
});
```

### 2. Image Processing Service

```javascript
// main.js
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/process-image', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;
  
  // Spawn image processing worker
  const worker = fork('workers/image-processor.js');
  
  worker.send({
    task: 'resize-and-optimize',
    imagePath,
    sizes: [100, 300, 800]
  });
  
  worker.on('message', (result) => {
    res.json({
      original: imagePath,
      processed: result.outputPaths
    });
    worker.kill();
  });
});

// workers/image-processor.js
const sharp = require('sharp');

process.on('message', async (msg) => {
  if (msg.task === 'resize-and-optimize') {
    const outputPaths = [];
    
    for (const size of msg.sizes) {
      const outputPath = `processed/${size}_${Date.now()}.jpg`;
      
      await sharp(msg.imagePath)
        .resize(size, size)
        .jpeg({ quality: 80 })
        .toFile(outputPath);
        
      outputPaths.push(outputPath);
    }
    
    process.send({ outputPaths });
  }
});
```

### 3. Data Analytics Pipeline

```javascript
// main.js
app.get('/analytics/report', (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Spawn workers for different analytics
  const salesWorker = fork('workers/sales-analytics.js');
  const userWorker = fork('workers/user-analytics.js');
  const performanceWorker = fork('workers/performance-analytics.js');
  
  const tasks = [
    { worker: salesWorker, type: 'sales' },
    { worker: userWorker, type: 'users' },
    { worker: performanceWorker, type: 'performance' }
  ];
  
  let results = {};
  let completedTasks = 0;
  
  tasks.forEach(({ worker, type }) => {
    worker.send({ startDate, endDate });
    
    worker.on('message', (data) => {
      results[type] = data;
      completedTasks++;
      
      if (completedTasks === tasks.length) {
        res.json({ analytics: results });
        tasks.forEach(({ worker }) => worker.kill());
      }
    });
  });
});
```

### 4. CPU-Intensive Calculations

```javascript
// main.js - Prime number finder
app.get('/find-primes/:limit', (req, res) => {
  const limit = parseInt(req.params.limit);
  const numWorkers = require('os').cpus().length;
  const chunkSize = Math.ceil(limit / numWorkers);
  
  let allPrimes = [];
  let completedWorkers = 0;
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = fork('workers/prime-finder.js');
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, limit);
    
    worker.send({ start, end });
    
    worker.on('message', (primes) => {
      allPrimes = allPrimes.concat(primes);
      completedWorkers++;
      
      if (completedWorkers === numWorkers) {
        allPrimes.sort((a, b) => a - b);
        res.json({ 
          primes: allPrimes,
          count: allPrimes.length,
          range: `1-${limit}`
        });
      }
      
      worker.kill();
    });
  }
});

// workers/prime-finder.js
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

process.on('message', (msg) => {
  const { start, end } = msg;
  const primes = [];
  
  for (let i = start; i <= end; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }
  }
  
  process.send(primes);
});
```

---

## Quick Reference Tables

### Child Process Methods Comparison

| Method | Purpose | Communication | Best For |
|--------|---------|---------------|----------|
| `fork()` | Run Node.js scripts | IPC messages | CPU-intensive JS tasks |
| `spawn()` | Execute commands | Streams | System commands |
| `exec()` | Execute shell commands | Buffer output | Simple shell commands |
| `execFile()` | Execute files directly | Buffer output | Running executables |

### Process vs Thread Comparison

| Aspect | Process (Node.js) | Thread (Java/C++) |
|--------|------------------|------------------|
| **Memory** | Isolated | Shared |
| **Crash Impact** | Isolated | Affects all threads |
| **Communication** | IPC | Shared memory |
| **Creation Cost** | Higher | Lower |
| **Debugging** | Easier | Complex |
| **Synchronization** | Not needed | Required |

### Router vs Direct Routes Decision Matrix

| Application Size | Team Size | Recommended Approach |
|------------------|-----------|---------------------|
| < 10 routes | 1-2 developers | Direct app.use() |
| 10-50 routes | 2-5 developers | Router (feature-based) |
| 50+ routes | 5+ developers | Router (module-based) |
| Microservices | Any | Router (service-based) |

### When to Use Child Processes

| Use Case | Child Process? | Reason |
|----------|---------------|--------|
| File I/O | ❌ | Node.js handles async I/O well |
| Database queries | ❌ | Use connection pooling instead |
| Image processing | ✅ | CPU-intensive, blocks event loop |
| Video encoding | ✅ | Very CPU-intensive |
| Mathematical calculations | ✅ | Blocks event loop |
| API calls | ❌ | Node.js excels at I/O |
| Email sending | ✅ | Can be delegated to workers |
| Report generation | ✅ | Often CPU-intensive |

### Memory and Performance Considerations

| Scenario | Memory Usage | Performance | Recommendation |
|----------|-------------|-------------|----------------|
| 1 child process | ~25MB each | Good | Acceptable |
| 10 child processes | ~250MB total | Excellent | Optimal for multi-core |
| 100 child processes | ~2.5GB total | May degrade | Consider worker pools |
| 1000 child processes | ~25GB total | Poor | Definitely use pools |

---

## Key Takeaways

1. **Child processes are separate OS processes, not threads**
2. **Each process has its own memory, PID, and V8 instance**
3. **Use child processes for CPU-intensive tasks only**
4. **Router provides better organization for large applications**
5. **Process isolation means better crash resilience**
6. **Communication between processes requires IPC or streams**
7. **Memory usage scales with number of child processes**
8. **Always clean up child processes to prevent memory leaks**

---

## Best Practices

### Child Process Management
```javascript
// Always handle process cleanup
const worker = fork('worker.js');

// Set timeout for long-running tasks
const timeout = setTimeout(() => {
  worker.kill();
}, 30000); // 30 seconds

worker.on('message', (result) => {
  clearTimeout(timeout);
  worker.kill();
});

worker.on('error', (err) => {
  clearTimeout(timeout);
  console.error('Worker error:', err);
});
```

### Router Organization
```javascript
// Organize routes by feature, not by HTTP method
// Good: /routes/users.js, /routes/products.js
// Bad: /routes/get.js, /routes/post.js

// Use middleware for common functionality
router.use(authenticate);
router.use(validateInput);
router.use(logRequest);
```

This comprehensive guide covers the essential concepts of Node.js child processes, routing patterns, and process management that are crucial for building scalable applications.