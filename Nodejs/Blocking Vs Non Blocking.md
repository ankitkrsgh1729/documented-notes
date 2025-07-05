# Node.js Event Loop - Complete Interview Guide

## Java vs JavaScript - The Fundamental Difference

### Java (Traditional Blocking)
```java
// Java - One thread per request
String data = readFile("file.txt");  // Thread STOPS and WAITS
processData(data);                   // Executes after 5 seconds
```
**Problems:**
- 1000 users = 1000 threads
- Each thread uses ~1MB memory
- Most threads just waiting for I/O
- Heavy resource usage

### JavaScript/Node.js (Non-blocking)
```javascript
// Node.js - One thread, many requests
readFile("file.txt", function(data) {  // Don't wait, use callback
    processData(data);                 // Executes when ready
});
handleOtherRequests();                 // Runs immediately
```
**Benefits:**
- 1000 users = 1 thread + background workers
- Efficient memory usage
- High concurrency
- Better scalability

## The Restaurant Analogy

### Traditional Approach (Java)
- **Multiple waiters** (threads)
- Each waiter takes one order and **waits** in kitchen until food is ready
- Need 100 waiters for 100 customers

### Node.js Approach
- **One super-efficient waiter** (main thread)
- **Kitchen staff** (background threads) for cooking (I/O)
- **Bell system** (Event Loop) to notify when food is ready
- One waiter handles 100 customers efficiently

## Types of Work

| Type | Who Does It | Blocking? | Example |
|------|-------------|-----------|---------|
| **I/O Operations** | Background threads | No | File reading, DB queries, HTTP requests |
| **CPU Calculations** | Main thread | Yes | Loops, sorting, complex math |
| **JavaScript Execution** | Main thread | Yes | Running your code |

## The Main Thread's Schedule

```javascript
// Main thread's internal logic:
while(true) {
    // 1. Execute current JavaScript code (CPU work)
    executeCurrentCode();
    
    // 2. ONLY when current code finishes, check queues
    if(noMoreCodeToExecute()) {
        checkQueues();        // Event Loop checks queues
        executeCallbacks();   // Execute ready callbacks
    }
}
```

**Key Point**: Main thread does ONE thing at a time - never parallel execution.

## I/O Operations Definition

**I/O (Input/Output)** operations involve external systems:
- **File operations**: Reading/writing files
- **Network requests**: HTTP requests, database queries
- **Server requests**: Incoming API requests to your server
- **Outgoing API calls**: Your server making requests to other services

All I/O operations are handled by **background threads** regardless of main thread status.

## Who Handles I/O?

### When Main Thread is Busy (CPU work or callback execution):
```javascript
// Main thread busy with CPU work
for(let i = 0; i < 1000000; i++) {
    // Background threads still handle I/O independently
    // Completed I/O callbacks wait in queues
}
```

### When Main Thread is Free:
```javascript
// Main thread checks queues and executes callbacks
// Background threads continue handling new I/O operations
```

**Key Point**: Background threads **always** handle I/O operations. Main thread only executes the callbacks when I/O completes.

## Event Loop Phases (Execution Order)

The Event Loop follows **strict phase order**:

```
Event Loop Cycle:
1. Timer Phase      → Execute setTimeout/setInterval callbacks
2. I/O Phase        → Execute I/O callbacks (file, network, etc.)
3. Check Phase      → Execute setImmediate callbacks
4. Close Phase      → Execute close callbacks
5. Repeat...
```

## Real Example - Step by Step

```javascript
console.log('=== START ===');

// Timer Phase
setTimeout(() => console.log('Timer'), 0);

// I/O Phase
fs.readFile('file.txt', function callback1(data) {
    console.log('File1 callback started');
    
    // New I/O operation during callback execution
    fs.readFile('file2.txt', function callback2(data) {
        console.log('File2 callback executed');
    });
    
    // CPU work in callback
    for(let i = 0; i < 1000000; i++) {
        // Processing...
    }
    
    console.log('File1 callback finished');
});

// Check Phase
setImmediate(() => console.log('Immediate'));

console.log('=== END ===');
```

### What happens (timeline):

```
Time 0ms: Main thread starts
Time 1ms: Prints "=== START ==="
Time 2ms: Sets timer (timer callback → Timer Queue immediately)
Time 3ms: Starts file.txt reading (Background Thread A starts)
Time 4ms: Sets setImmediate (immediate callback → Check Queue)
Time 5ms: Prints "=== END ==="
Time 6ms: Main thread waits for queues...
Time 50ms: Background Thread A finishes file.txt (callback1 → I/O Queue)
Time 51ms: Event Loop starts checking phases:

         Phase 1 - Timer Phase:
         - Check Timer Queue: [timer callback] ← Found it!
         - Execute: prints "Timer"
         
         Phase 2 - I/O Phase:
         - Check I/O Queue: [callback1] ← Found it!
         - Execute callback1: prints "File1 callback started"
         - During callback1: fs.readFile('file2.txt') starts
         - Background Thread B starts reading file2.txt
         - callback1 continues with CPU work...
         
Time 100ms: Background Thread B finishes file2.txt (callback2 → I/O Queue)
Time 1051ms: callback1 CPU work finishes
Time 1052ms: callback1 execution complete, prints "File1 callback finished"
Time 1053ms: Event Loop cycle repeats:
             
             Phase 1 - Timer Phase: (empty)
             Phase 2 - I/O Phase:
             - Check I/O Queue: [callback2] ← Found it!
             - Execute callback2: prints "File2 callback executed"
             
             Phase 3 - Check Phase:
             - Check Check Queue: [immediate callback] ← Found it!
             - Execute: prints "Immediate"
```

**Output:**
```
=== START ===
=== END ===
Timer
File1 callback started
File1 callback finished
File2 callback executed
Immediate
```

**Key Reasoning:**
- **Timer executes first** - Timer Phase comes before I/O Phase
- **File1 callback executes second** - I/O Phase processes callback1
- **File2 callback waits** - callback2 queued during callback1 execution
- **Immediate executes last** - Check Phase comes after I/O Phase

## Callbacks

### What are Callbacks?
Functions that run **later** when async operations complete.

```javascript
// You're saying: "When file reading is done, run this function"
fs.readFile('file.txt', function thisIsACallback(data) {
    console.log('File reading complete');
});
```

### Callback Flow
```javascript
// Step 1: Delegate work + provide callback
fs.readFile('huge-file.txt', callback);

// Step 2: Main thread continues
console.log('This runs immediately');

// Step 3: Background thread reads file
// Step 4: When done, callback goes to queue
// Step 5: Event Loop executes callback when main thread is free
```

## Queues

### Why Queues?
Multiple operations can complete simultaneously:
```javascript
fs.readFile('file1.txt', callback1);  // Might complete at same time
fs.readFile('file2.txt', callback2);  // Might complete at same time
setTimeout(callback3, 100);           // Might complete at same time
```

Queues ensure **orderly execution** - one callback at a time.

### Types of Queues
```javascript
// Timer Queue
setTimeout(() => console.log('Timer'), 0);

// I/O Queue  
fs.readFile('file.txt', () => console.log('File done'));

// Check Queue
setImmediate(() => console.log('Immediate'));

// Microtask Queue (Highest Priority)
Promise.resolve().then(() => console.log('Promise'));
process.nextTick(() => console.log('NextTick'));
```

## Event Loop

### The Event Loop Cycle
```javascript
// Event Loop is like a security guard making rounds:
while(true) {
    // 1. Check Timer Queue → Execute ready timers
    checkTimerQueue();
    
    // 2. Check I/O Queue → Execute completed I/O callbacks
    checkIOQueue();
    
    // 3. Check Check Queue → Execute setImmediate callbacks
    checkCheckQueue();
    
    // 4. Repeat...
}
```

### Priority Order
1. **process.nextTick()** - Highest priority
2. **Promises** - Second priority
3. **Timer Queue** - setTimeout/setInterval
4. **I/O Queue** - File operations, network requests
5. **Check Queue** - setImmediate

## Blocking vs Non-Blocking

### Non-Blocking (I/O Operations)
```javascript
// This DOESN'T block main thread
fs.readFile('huge-file.txt', callback);  // Delegates to background thread
console.log('This runs immediately');    // Main thread continues
```

### Blocking (CPU Operations)
```javascript
// This BLOCKS main thread
for(let i = 0; i < 1000000000; i++) {    // CPU calculation on main thread
    // Heavy computation
}
console.log('This waits for loop');       // Blocked!
```

### Why CPU Work Blocks Everything
```javascript
setTimeout(() => console.log('Timer'), 0);  // Timer ready immediately

// Heavy CPU work
for(let i = 0; i < 1000000000; i++) {
    // This blocks main thread for 5 seconds
}

console.log('Done');
// Timer callback waits 5 seconds even though it was ready immediately
```

**Timeline:**
```
0ms: Timer set (callback queued immediately)
1ms: Start CPU loop
...
5000ms: CPU loop finishes
5001ms: Print "Done"
5002ms: Check queues → Execute timer callback (5 seconds late!)
```

## Yielding - The Solution

### Problem: Long-running CPU work
```javascript
// This blocks for seconds
for(let i = 0; i < 1000000000; i++) {
    process(i);
}
```

### Solution: Break into chunks
```javascript
let i = 0;
function processChunk() {
    const end = Math.min(i + 100000, 1000000000);  // Process 100k items
    
    for(; i < end; i++) {
        process(i);
    }
    
    if(i < 1000000000) {
        setImmediate(processChunk);  // Yield control, schedule next chunk
    }
}
processChunk();
```

### Timeline Comparison

**Without Yielding:**
```
Main Thread: [=========== CPU Work (5000ms) ===========][Check Queues]
Timer Queue: [Callback waiting... waiting... waiting...][Execute!]
```

**With Yielding:**
```
Main Thread: [CPU 50ms][Check][CPU 50ms][Check][CPU 50ms][Check]
Timer Queue: [Callback waiting][Execute!]
```

## Worker Threads & Child Processes

### Worker Threads
```javascript
// For CPU-intensive work
const { Worker } = require('worker_threads');

const worker = new Worker('./cpu-intensive-worker.js');
worker.postMessage({ data: largeDataSet });
worker.on('message', (result) => {
    console.log('Work completed:', result);
});
```

### Child Processes
```javascript
// For completely separate processes
const { spawn } = require('child_process');

const child = spawn('node', ['cpu-intensive-script.js']);
child.stdout.on('data', (data) => {
    console.log('Output:', data.toString());
});
```

## Common Interview Questions

### Q: "Why is Node.js faster than Java for I/O-heavy applications?"
**A:** "Node.js uses a single thread with non-blocking I/O, while Java typically uses one thread per request. For I/O-heavy apps, Java threads spend most time waiting, while Node.js handles other requests during I/O operations."

### Q: "What happens when you block the Event Loop?"
**A:** "The entire application becomes unresponsive. No new requests can be processed, timers don't fire, and I/O callbacks can't execute because the main thread is busy."

### Q: "How do you handle CPU-intensive work in Node.js?"
**A:** "Break it into smaller chunks using setImmediate/process.nextTick to yield control, use Worker Threads for parallel processing, or delegate to child processes."

### Q: "Why doesn't setTimeout(0) execute immediately?"
**A:** "setTimeout(0) adds the callback to the Timer Queue, but it only executes during the Timer Phase of the Event Loop. If other phases have pending callbacks, they execute first according to phase order."

### Q: "What determines callback execution order?"
**A:** "The Event Loop phase order: Timer → I/O → Check → Close. Callbacks execute in phase order, not in the order they were added to queues."

### Q: "Who handles I/O when main thread is busy?"
**A:** "Background threads always handle I/O operations independently of main thread status. When main thread is busy, I/O continues but callbacks wait in queues until main thread is free."

### Q: "What happens if new I/O operations start during callback execution?"
**A:** "Background threads handle new I/O operations immediately and independently. However, their callbacks must wait in queues until the main thread finishes executing the current callback."

## Memory Tips

### Core Concepts
- **"One waiter, many cooks, bell system"** - Main thread, background threads, Event Loop
- **"Delegate I/O, handle CPU personally"** - I/O goes to background, CPU stays on main thread
- **"One task at a time"** - Main thread never does parallel execution
- **"Yield to be nice"** - Break CPU work into chunks

### Priority Order
- **"NextTick > Promises > Timer > I/O > Check > Close"** - Complete execution order

### Blocking Rule
- **"CPU blocks, I/O doesn't"** - Remember what runs where

## Key Takeaways

1. **Single main thread** handles all JavaScript execution
2. **Background threads** handle I/O operations
3. **Event Loop** coordinates between main thread and background work
4. **Queues** store callbacks waiting to be executed
5. **CPU work blocks everything** - I/O work doesn't
6. **Yielding** prevents blocking by breaking work into chunks
7. **Worker threads** for CPU-intensive parallel work