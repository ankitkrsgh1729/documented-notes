# Node.js Modules & Import/Export Systems - Interview Notes

## Why We Need Modules

### The Problem (Without Modules)
- **Global Scope Pollution**: Everything in global namespace
- **Name Conflicts**: Multiple functions with same name
- **No Code Organization**: All code in one file or global scope
- **Dependency Management**: Hard to track what depends on what

### Java vs JavaScript Original Problem

**Java (Built-in Organization):**
```java
// Java has packages and classes built-in
package com.example.utils;
public class MathUtils {
    public static int add(int a, int b) { return a + b; }
}

// Usage with clear imports
import com.example.utils.MathUtils;
MathUtils.add(5, 3);
```

**JavaScript (Original Problem):**
```javascript
// Everything global - naming conflicts!
function add(a, b) { return a + b; }        // From math.js
function add(x, y) { return x + y + 1; }    // From another file - CONFLICT!
```

### Node.js Solution
- **File-based modules**: Each file = separate module
- **Explicit imports/exports**: Control what's shared
- **Scope isolation**: Variables stay within module
- **Dependency management**: Clear import/export relationships

## CommonJS vs ES6 Modules

### CommonJS (Traditional Node.js)

**Syntax:**
```javascript
// Exporting (math.js)
function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }

module.exports = { add, subtract };
// OR
exports.add = add;
exports.subtract = subtract;

// Importing (app.js)
const math = require('./math');
const { add, subtract } = require('./math'); // Destructuring
```

### ES6 Modules (Modern JavaScript)

**Syntax:**
```javascript
// Exporting (math.mjs)
export function add(a, b) { return a + b; }
export const PI = 3.14159;
export default function subtract(a, b) { return a - b; }

// Importing (app.mjs)
import subtract, { add, PI } from './math.mjs';
import * as math from './math.mjs'; // Import all
```

## Key Concepts Explained

### Runtime Evaluation vs Compile-time vs Static Analysis

#### Runtime Evaluation (CommonJS)
- **When**: Code executes line by line during program execution
- **How**: `require()` is a function call that executes when reached
- **Java Comparison**: Like Java's `Class.forName()` - loads classes at runtime

```javascript
// CommonJS - Runtime evaluation
console.log('Starting app...');
const math = require('./math');  // ← Executes HERE, during runtime
console.log('Math loaded');
math.add(5, 3);
```

```java
// Java equivalent - Runtime loading
System.out.println("Starting app...");
Class<?> mathClass = Class.forName("com.example.Math"); // Runtime loading
System.out.println("Math loaded");
```

#### Compile-time (ES6 Modules)
- **When**: Before code runs, during parsing/compilation phase
- **How**: `import` statements are analyzed before execution
- **Java Comparison**: Like Java's normal imports - resolved at compile time

```javascript
// ES6 - Compile-time (before execution)
import { add } from './math.js';  // ← Analyzed BEFORE code runs
console.log('Starting app...');
add(5, 3);
```

```java
// Java equivalent - Compile-time
import com.example.Math; // Resolved at compile time
public class App {
    public static void main(String[] args) {
        System.out.println("Starting app...");
        Math.add(5, 3);
    }
}
```

#### Static Analysis
- **What**: Analyzing code without executing it
- **Benefit**: Can detect errors, optimize, and understand dependencies before runtime
- **Tools**: Bundlers, linters, IDEs use this

```javascript
// Static analysis can detect:
import { add, multiply } from './math.js';
add(5, 3);        // ✅ Used
multiply(2, 4);   // ✅ Used
// subtract is imported but never used → can be removed (tree shaking)
```

### Bundlers in Node.js

#### What is a Bundler?
A bundler combines multiple JavaScript files into fewer files (bundles) for deployment.

**Java Comparison**: Like creating a JAR file that packages multiple .class files
```java
// Java - Multiple files become one JAR
MyApp.java + Utils.java + Database.java → MyApp.jar
```

```javascript
// Node.js - Multiple files become one bundle
app.js + utils.js + database.js → bundle.js
```

#### Why Use Bundlers?

**Without Bundler (Multiple Files):**
```html
<!-- Browser needs multiple HTTP requests -->
<script src="app.js"></script>
<script src="utils.js"></script>
<script src="database.js"></script>
<script src="math.js"></script>
```

**With Bundler (Single File):**
```html
<!-- Browser needs only one HTTP request -->
<script src="bundle.js"></script>
```

#### Popular Bundlers
- **Webpack**: Most popular, complex configuration
- **Vite**: Modern, fast for development
- **Rollup**: Good for libraries
- **Parcel**: Zero configuration
- **esbuild**: Extremely fast

#### Bundler Example (Webpack)
```javascript
// webpack.config.js
module.exports = {
  entry: './src/app.js',           // Starting point
  output: {
    filename: 'bundle.js',         // Output file
    path: __dirname + '/dist'
  },
  mode: 'production'               // Optimize for production
};
```

#### Tree Shaking (Why ES6 Modules Matter)
```javascript
// math.js
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
export function multiply(a, b) { return a * b; }
export function divide(a, b) { return a / b; }

// app.js
import { add } from './math.js';  // Only using add
console.log(add(5, 3));

// Bundler can remove unused functions (subtract, multiply, divide)
// Final bundle only contains 'add' function
```

**CommonJS Problem:**
```javascript
// math.js
module.exports = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b
};

// app.js
const { add } = require('./math');
// Bundler CANNOT remove unused functions - entire object is included
```

## Benefits Comparison

| Feature | CommonJS | ES6 Modules |
|---------|----------|-------------|
| **Loading** | Synchronous (runtime) | Static analysis (compile-time) |
| **Conditional Loading** | ✅ `if(condition) require()` | ❌ Must use dynamic imports |
| **Dynamic Module Names** | ✅ `require(variableName)` | ❌ Must use `import()` |
| **File Extension** | Optional for .js | Required |
| **Tree Shaking** | ❌ Not supported | ✅ Bundlers can remove unused code |
| **Error Detection** | Runtime errors | Compile-time errors |
| **Circular Dependencies** | Handles partially | Better detection |
| **Browser Support** | ❌ Node.js only | ✅ Modern browsers |
| **Caching** | ✅ Cached after first load | ✅ Cached |
| **Top-level await** | ❌ Not supported | ✅ Supported |
| **Bundler Optimization** | ❌ Limited | ✅ Excellent |

## Examples

### CommonJS Examples

**Basic Export/Import:**
```javascript
// utils.js
const config = { apiUrl: 'https://api.example.com' };
const helper = (data) => data.toUpperCase();

module.exports = { config, helper };

// app.js
const { config, helper } = require('./utils');
console.log(helper('hello')); // HELLO
```

**Conditional Loading (CommonJS Advantage):**
```javascript
// app.js
let logger;
if (process.env.NODE_ENV === 'development') {
    logger = require('./dev-logger');
} else {
    logger = require('./prod-logger');
}
```

### ES6 Module Examples

**Named and Default Exports:**
```javascript
// database.mjs
export class Database {
    connect() { /* connect logic */ }
}

export const config = { host: 'localhost' };

export default function createConnection() {
    return new Database();
}

// app.mjs
import createConnection, { Database, config } from './database.mjs';
```

**Dynamic Imports (ES6 Solution for Conditional Loading):**
```javascript
// app.mjs
const loadModule = async () => {
    if (condition) {
        const module = await import('./conditional-module.mjs');
        return module.default;
    }
};
```

## Built-in Modules

### Node.js Built-in Modules (Like Java's Standard Library)

```javascript
// CommonJS
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

// ES6
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
```

### Java Comparison
```java
// Java standard library
import java.io.File;
import java.nio.file.Path;
import java.net.http.HttpClient;
import java.security.MessageDigest;
```

## Module Resolution (Like Java Classpath)

### Node.js Resolution Order:
1. **Core modules** (fs, http, etc.) - Like Java's standard library
2. **File/directory** (./math, ../utils) - Like relative imports
3. **node_modules** - Like Maven dependencies

### Java Comparison:
```java
// Java classpath resolution
import java.util.List;           // Standard library
import com.example.utils.Helper; // Your package
import org.apache.commons.lang3.StringUtils; // External dependency
```

## Common Interview Questions & Answers

**Q: What's the difference between require and import?**
- `require`: CommonJS, synchronous, runtime evaluation, can be conditional
- `import`: ES6, static analysis, compile-time, must be top-level

**Q: Why would you choose CommonJS over ES6 modules?**
- Conditional loading needs
- Dynamic module names
- Existing codebase compatibility
- Simpler mental model

**Q: What's the benefit of ES6 modules?**
- Tree shaking (unused code removal)
- Better bundler optimization
- Compile-time error detection
- Browser compatibility

**Q: What's the difference between runtime evaluation and static analysis?**
- Runtime evaluation: Code executes when reached (like `require()`)
- Static analysis: Code analyzed before execution (like `import`)
- Static analysis enables bundler optimizations and early error detection

**Q: What is a bundler and why do we need it?**
- Combines multiple files into fewer files for deployment
- Reduces HTTP requests, enables tree shaking, optimizes code
- Like Java's JAR files - packages multiple files into one

**Q: How does Node.js module system compare to Java?**
- Node.js: File-based modules, runtime loading
- Java: Package-based, compile-time classpath
- Both solve code organization and namespace problems

## Quick Reference

### When to Use What:
- **CommonJS**: Legacy code, conditional loading, simple Node.js apps
- **ES6 Modules**: Modern apps, bundlers, browser compatibility needed

### File Extensions:
- CommonJS: `.js` (default)
- ES6: `.mjs` or `.js` with `"type": "module"` in package.json