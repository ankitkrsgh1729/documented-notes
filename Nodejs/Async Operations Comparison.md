# Node.js Async Operations - Complete Comparison

## Execution Flow Table

| Operation Type | Where It Runs | Output Example | Explanation |
|---------------|---------------|----------------|-------------|
| **Synchronous** | Main Thread (Blocking) | [See Example 1] | Main thread waits, nothing else can run |
| **Promise Constructor** | Main Thread (Immediate) | [See Example 2] | Runs immediately when Promise created |
| **setTimeout/setInterval** | Event Loop Timers | [See Example 3] | Scheduled for later execution |
| **File I/O (async)** | Thread Pool | [See Example 4] | Background thread reads file |
| **Network I/O (async)** | OS Async I/O | [See Example 5] | OS handles network operations |
| **Promise Resolution** | Microtask Queue | [See Example 6] | High priority, runs before macrotasks |

---

## Example 1: Synchronous Operation (BLOCKS Main Thread)

```javascript
const fs = require('fs');

console.log('1: Start');
console.log('2: About to read file synchronously');

// This BLOCKS the main thread
const data = fs.readFileSync('package.json', 'utf8');

console.log('3: File read complete');
console.log('4: End');
```

**Output:**
```
1: Start
2: About to read file synchronously
3: File read complete
4: End
```

**What Happens:**
- Main thread waits for file read to complete
- Nothing else can execute during file read
- Thread is idle/blocked

---

## Example 2: Promise Constructor (Runs Immediately)

```javascript
console.log('1: Before Promise');

const promise = new Promise((resolve, reject) => {
  console.log('2: Promise executor starts');
  console.log('3: Promise executor continues');
  
  setTimeout(() => {
    console.log('5: Timer callback');
    resolve('done');
  }, 0);
  
  console.log('4: Promise executor ends');
});

console.log('6: After Promise');
```

**Output:**
```
1: Before Promise
2: Promise executor starts
3: Promise executor continues
4: Promise executor ends
6: After Promise
5: Timer callback
```

**What Happens:**
- Promise executor runs completely and immediately
- setTimeout registers callback for later
- Main thread continues after Promise creation

---

## Example 3: setTimeout (Event Loop Timers)

```javascript
console.log('1: Start');

setTimeout(() => {
  console.log('3: Timer 1 (0ms)');
}, 0);

setTimeout(() => {
  console.log('4: Timer 2 (10ms)');
}, 10);

console.log('2: End');
```

**Output:**
```
1: Start
2: End
3: Timer 1 (0ms)
4: Timer 2 (10ms)
```

**What Happens:**
- Timers registered with event loop
- Main thread continues immediately
- Event loop executes timers when ready

---

## Example 4: File I/O (Thread Pool)

```javascript
const fs = require('fs').promises;

async function readFile() {
  console.log('1: Start file read');
  
  // Goes to thread pool
  const data = await fs.readFile('package.json', 'utf8');
  
  console.log('3: File read complete');
  console.log('4: Data length:', data.length);
}

console.log('0: Before function call');
readFile();
console.log('2: After function call');
```

**Output:**
```
0: Before function call
1: Start file read
2: After function call
3: File read complete
4: Data length: 1234
```

**What Happens:**
- `fs.readFile()` creates work item for thread pool
- Function suspends at `await`
- Background thread reads file
- Function resumes when file read complete

---

## Example 5: Network I/O (OS Async I/O)

```javascript
const https = require('https');

async function fetchData() {
  console.log('1: Start HTTP request');
  
  // Uses OS-level async I/O
  const response = await new Promise((resolve, reject) => {
    https.get('https://jsonplaceholder.typicode.com/posts/1', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  
  console.log('3: Response received');
  console.log('4: Response length:', response.length);
}

console.log('0: Before function call');
fetchData();
console.log('2: After function call');
```

**Output:**
```
0: Before function call
1: Start HTTP request
2: After function call
3: Response received
4: Response length: 292
```

**What Happens:**
- HTTP request initiated using OS async mechanisms
- Function suspends at `await`
- OS handles network I/O (no thread pool needed)
- Function resumes when response arrives

---

## Example 6: Promise Resolution (Microtask Queue)

```javascript
console.log('1: Start');

Promise.resolve().then(() => {
  console.log('3: Promise microtask');
});

setTimeout(() => {
  console.log('4: setTimeout macrotask');
}, 0);

console.log('2: End');
```

**Output:**
```
1: Start
2: End
3: Promise microtask
4: setTimeout macrotask
```

**What Happens:**
- Promise `.then()` goes to microtask queue
- `setTimeout` goes to macrotask queue
- Microtasks run before macrotasks

---

## Complex Example: Mixed Operations

```javascript
const fs = require('fs').promises;

async function complexExample() {
  console.log('A: Function starts');
  
  // Promise executor runs immediately
  const result = await new Promise(resolve => {
    console.log('B: Promise executor');
    
    // This goes to timer queue
    setTimeout(() => {
      console.log('E: Timer fires');
      resolve('timer done');
    }, 0);
    
    console.log('C: Promise executor ends');
  });
  
  console.log('F: Promise resolved with:', result);
  
  // This goes to thread pool
  const fileData = await fs.readFile('package.json', 'utf8');
  console.log('H: File read complete');
}

console.log('1: Before');
complexExample();
console.log('2: After');

// Microtask
Promise.resolve().then(() => console.log('G: Microtask'));

console.log('3: End');
```

**Output:**
```
1: Before
A: Function starts
B: Promise executor
C: Promise executor ends
2: After
3: End
G: Microtask
E: Timer fires
F: Promise resolved with: timer done
H: File read complete
```

**Execution Order:**
1. Synchronous code runs first
2. Microtasks run next
3. Timer callbacks run
4. I/O callbacks run when complete

---

## Key Takeaways

1. **Promise executors always run immediately and completely**
2. **setTimeout only schedules callbacks, doesn't execute them**
3. **File I/O uses thread pool, network I/O uses OS async**
4. **Microtasks (Promises) have higher priority than macrotasks (timers)**
5. **Main thread never blocks for async operations**