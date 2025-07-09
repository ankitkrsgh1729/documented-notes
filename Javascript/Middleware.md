# Express Middleware Guide

## What is Middleware?

Middleware functions are functions that have access to the **request object (req)**, **response object (res)**, and the **next middleware function** in the application's request-response cycle. They can:

- Execute code
- Make changes to the request and response objects
- End the request-response cycle
- Call the next middleware function in the stack

## Middleware Execution Flow

```
Incoming Request
      ↓
 Middleware 1
      ↓
 Middleware 2
      ↓
 Middleware 3
      ↓
 Route Handler
      ↓
Outgoing Response
```

## Basic Middleware Structure

```javascript
function middlewareName(req, res, next) {
    // Do something with req/res
    console.log('Middleware executed');
    
    // IMPORTANT: Call next() to continue to next middleware
    next();
}
```

## 1. Simple Request Logger Middleware

```javascript
const express = require('express');
const app = express();

// Custom middleware to log request method and URL
function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    
    console.log(`[${timestamp}] ${method} ${url}`);
    
    // Call next() to pass control to the next middleware
    next();
}

// Use the middleware globally (applies to all routes)
app.use(requestLogger);

// Routes
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/users', (req, res) => {
    res.json([{ id: 1, name: 'John' }]);
});

app.post('/users', (req, res) => {
    res.json({ message: 'User created' });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});

// Output when requests are made:
// [2024-01-15T10:30:45.123Z] GET /
// [2024-01-15T10:30:50.456Z] GET /users
// [2024-01-15T10:30:55.789Z] POST /users
```

## 2. Enhanced Request Logger with More Details

```javascript
const express = require('express');
const app = express();

// Advanced request logger middleware
function advancedRequestLogger(req, res, next) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
    console.log(`User-Agent: ${userAgent}`);
    
    // Override res.end to log response time
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        console.log(`[${timestamp}] ${method} ${url} - Completed in ${duration}ms`);
        console.log('---');
        
        // Call the original end method
        originalEnd.apply(res, args);
    };
    
    next();
}

// Use the middleware
app.use(advancedRequestLogger);

// Routes
app.get('/', (req, res) => {
    setTimeout(() => {
        res.send('Hello World!');
    }, 100); // Simulate processing time
});

app.listen(3000);
```

## 3. Types of Middleware

### Application-Level Middleware
```javascript
const express = require('express');
const app = express();

// Applies to all routes
app.use((req, res, next) => {
    console.log('This runs for every request');
    next();
});

// Applies only to specific path
app.use('/api', (req, res, next) => {
    console.log('This runs only for /api/* routes');
    next();
});
```

### Router-Level Middleware
```javascript
const express = require('express');
const router = express.Router();

// Middleware for this router only
router.use((req, res, next) => {
    console.log('Router-level middleware');
    next();
});

router.get('/users', (req, res) => {
    res.json([{ id: 1, name: 'John' }]);
});

// Mount the router
app.use('/api', router);
```

### Route-Specific Middleware
```javascript
// Authentication middleware
function authenticate(req, res, next) {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    // Simulate token validation
    if (token === 'Bearer valid-token') {
        req.user = { id: 1, name: 'John' };
        next();
    } else {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// Use middleware for specific route
app.get('/profile', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// Multiple middlewares for a route
app.get('/admin', authenticate, isAdmin, (req, res) => {
    res.json({ message: 'Admin panel' });
});

function isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
}
```

## 4. Error Handling Middleware

```javascript
// Error handling middleware (must have 4 parameters)
function errorHandler(err, req, res, next) {
    const timestamp = new Date().toISOString();
    
    console.error(`[${timestamp}] Error in ${req.method} ${req.url}:`);
    console.error(err.stack);
    
    // Don't expose internal errors to client
    if (err.status) {
        res.status(err.status).json({ error: err.message });
    } else {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Middleware that might throw an error
app.get('/error-test', (req, res, next) => {
    // Simulate an error
    const error = new Error('Something went wrong!');
    error.status = 400;
    next(error); // Pass error to error handling middleware
});

// Error handling middleware should be last
app.use(errorHandler);
```

## 5. Practical Middleware Examples

### Request Validation Middleware
```javascript
function validateUserInput(req, res, next) {
    const { name, email } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ 
            error: 'Name and email are required' 
        });
    }
    
    if (!email.includes('@')) {
        return res.status(400).json({ 
            error: 'Invalid email format' 
        });
    }
    
    next();
}

// Use validation middleware
app.post('/users', validateUserInput, (req, res) => {
    // This only runs if validation passes
    res.json({ message: 'User created successfully' });
});
```

### Rate Limiting Middleware
```javascript
const requestCounts = new Map();

function rateLimiter(maxRequests = 100, windowMs = 60000) {
    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        
        // Clean old entries
        for (const [key, data] of requestCounts.entries()) {
            if (now - data.timestamp > windowMs) {
                requestCounts.delete(key);
            }
        }
        
        // Check current IP
        const current = requestCounts.get(ip) || { count: 0, timestamp: now };
        
        if (now - current.timestamp > windowMs) {
            // Reset window
            current.count = 1;
            current.timestamp = now;
        } else {
            current.count++;
        }
        
        requestCounts.set(ip, current);
        
        if (current.count > maxRequests) {
            return res.status(429).json({ 
                error: 'Too many requests' 
            });
        }
        
        next();
    };
}

// Use rate limiting
app.use('/api', rateLimiter(10, 60000)); // 10 requests per minute
```

### CORS Middleware
```javascript
function corsMiddleware(req, res, next) {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
}

app.use(corsMiddleware);
```

## 6. Middleware Execution Order

```javascript
const express = require('express');
const app = express();

// Middleware execution order matters!
app.use((req, res, next) => {
    console.log('1. First middleware');
    next();
});

app.use((req, res, next) => {
    console.log('2. Second middleware');
    next();
});

app.get('/', (req, res, next) => {
    console.log('3. Route handler');
    res.send('Hello');
});

app.use((req, res, next) => {
    console.log('4. This runs after route handler');
    next();
});

// Output for GET /:
// 1. First middleware
// 2. Second middleware
// 3. Route handler
// 4. This runs after route handler
```

## 7. Common Middleware Patterns

### Conditional Middleware
```javascript
function conditionalMiddleware(condition) {
    return (req, res, next) => {
        if (condition(req)) {
            console.log('Condition met, executing middleware logic');
            // Do something
        }
        next();
    };
}

// Use conditional middleware
app.use(conditionalMiddleware(req => req.method === 'POST'));
```

### Middleware Factory
```javascript
function createLogger(prefix) {
    return (req, res, next) => {
        console.log(`[${prefix}] ${req.method} ${req.url}`);
        next();
    };
}

// Create different loggers
const apiLogger = createLogger('API');
const adminLogger = createLogger('ADMIN');

app.use('/api', apiLogger);
app.use('/admin', adminLogger);
```

## 8. Best Practices

### 1. Always Call next() or End Response
```javascript
// Good
function goodMiddleware(req, res, next) {
    console.log('Processing...');
    next(); // Continue to next middleware
}

// Good
function authMiddleware(req, res, next) {
    if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized' }); // End response
    }
    next(); // Continue if authorized
}

// Bad - will hang the request
function badMiddleware(req, res, next) {
    console.log('Processing...');
    // Forgot to call next() or end response!
}
```

### 2. Error Handling
```javascript
function safeMiddleware(req, res, next) {
    try {
        // Some operation that might fail
        const result = JSON.parse(req.body.data);
        req.parsedData = result;
        next();
    } catch (error) {
        next(error); // Pass error to error handling middleware
    }
}
```

### 3. Order Matters
```javascript
// Correct order
app.use(express.json()); // Parse JSON first
app.use(corsMiddleware);  // Then handle CORS
app.use(authMiddleware);  // Then authenticate
app.use('/api', apiRoutes); // Then handle routes
app.use(errorHandler);    // Error handler last
```

## Interview Questions & Answers

### Q1: What happens if you don't call next() in middleware?
**Answer:** The request will hang indefinitely. Express won't proceed to the next middleware or route handler. You must either call `next()` to continue the chain or end the response with methods like `res.send()`, `res.json()`, etc.

### Q2: What's the difference between app.use() and app.get()?
**Answer:** `app.use()` applies middleware to all HTTP methods for the specified path, while `app.get()` only applies to GET requests. `app.use()` is for middleware, `app.get()` is for route handlers.

### Q3: How do you handle errors in middleware?
**Answer:** Pass the error to the `next()` function: `next(error)`. This will skip all regular middleware and go directly to error handling middleware (functions with 4 parameters: `err, req, res, next`).

### Q4: Can you modify the request object in middleware?
**Answer:** Yes! You can add properties to `req` that subsequent middleware and route handlers can access. For example: `req.user = userData;`

This comprehensive guide covers the fundamentals of Express middleware that you'll need for your interview!