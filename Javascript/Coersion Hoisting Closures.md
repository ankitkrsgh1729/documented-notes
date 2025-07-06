# JavaScript Fundamentals - Interview Notes

## 1. Type Coercion in JavaScript

### What do we mean when we say JavaScript is an Interpreted Language?

**Interpreted vs Compiled:**

| Aspect | Interpreted (JavaScript) | Compiled (Java) |
|--------|-------------------------|-----------------|
| **Execution** | Code executed line by line at runtime | Code compiled to bytecode first, then executed |
| **Error Detection** | Runtime errors discovered during execution | Compile-time errors caught before execution |
| **Performance** | Slower initial execution, but modern JIT optimizes | Faster execution after compilation |
| **Flexibility** | Dynamic typing, runtime modifications | Static typing, compile-time checks |

```javascript
// JavaScript - Interpreted
// This error is only discovered when the line executes
function test() {
    console.log(undefinedVariable); // ReferenceError at runtime
}
// No error until test() is called

// Type coercion happens at runtime
let result = "5" + 3; // Decided at runtime: string concatenation
```

```java
// Java - Compiled
// This error is caught at compile time
public void test() {
    System.out.println(undefinedVariable); // Compilation error
}
// Won't compile at all

// Type checking at compile time
String result = "5" + 3; // Compiler knows: string concatenation
```

### Why do we need Coercion?

**Purpose:**
- JavaScript is dynamically typed, allowing flexible operations between different types
- Enables seamless mixing of data types without explicit casting
- Reduces boilerplate code for simple operations

### How it helps:

| Scenario | Without Coercion | With Coercion |
|----------|------------------|---------------|
| String concatenation | `"Age: " + String(25)` | `"Age: " + 25` |
| Numeric comparison | `parseInt("5") > 3` | `"5" > 3` |
| Boolean checks | `Boolean(users.length)` | `if (users.length)` |

### Real-life Example:
```javascript
// E-commerce cart calculation
const price = "99.99";     // From form input (string)
const quantity = 2;        // From counter (number)
const discount = "10";     // From coupon code (string)

// Coercion makes this work seamlessly
const total = price * quantity - discount;  // 189.98
// Without coercion: parseFloat(price) * quantity - parseFloat(discount)
```

### Common Coercion Rules:
```javascript
// String + Number = String
"5" + 3        // "53"

// String with other operators = Number
"5" - 3        // 2
"5" * 3        // 15

// Boolean to Number
true + 1       // 2
false + 1      // 1

// Truthy/Falsy checks
if ("hello")   // true
if (0)         // false
if ([])        // true (empty array is truthy)
```

---

## 2. Hoisting in JavaScript

### How does Hoisting work internally?

**Does JavaScript read the code first and then execute it?**

Yes! JavaScript engine works in **two phases**:

| Phase | What Happens | Example |
|-------|-------------|---------|
| **1. Creation Phase** | Scans entire code, allocates memory for variables and functions | `var x = undefined; function foo() {...}` |
| **2. Execution Phase** | Executes code line by line | `console.log(x); x = 5;` |

### Step-by-step Process:

```javascript
// Original Code
console.log(a); // undefined
sayHello();     // "Hello World!"

var a = 5;
function sayHello() {
    console.log("Hello World!");
}
```

**What JavaScript Engine Does:**

**Phase 1 - Creation (Compilation-like step):**
```javascript
// Memory allocation phase
var a = undefined;  // var declarations hoisted with undefined
function sayHello() { // function declarations fully hoisted
    console.log("Hello World!");
}
```

**Phase 2 - Execution:**
```javascript
console.log(a); // undefined (memory allocated but not assigned)
sayHello();     // "Hello World!" (function fully available)
a = 5;          // Now assignment happens
```

### Real-life Analogy:
Think of it like **moving to a new house**:
1. **Creation Phase**: You reserve rooms and label them (memory allocation)
2. **Execution Phase**: You actually move furniture and live in the house (code execution)

### Why do we need Hoisting?

**Purpose:**
- Allows using functions and variables before they're declared in code
- Enables recursive functions and mutual recursion
- Provides flexibility in code organization

### How it helps:

| Benefit | Example |
|---------|---------|
| **Function Organization** | Can call functions before defining them |
| **Recursive Functions** | Functions can call themselves |
| **Code Readability** | Main logic at top, helper functions at bottom |

### Real-life Example:
```javascript
// Main application logic at the top
startApp();
initializeDatabase();
setupRoutes();

// Implementation details at the bottom
function startApp() {
    console.log("Starting application...");
    loadConfig();
}

function initializeDatabase() {
    console.log("Connecting to database...");
}

function setupRoutes() {
    console.log("Setting up routes...");
}

function loadConfig() {
    console.log("Loading configuration...");
}
```

### How Hoisting Works (JavaScript vs Java):

| Language | Hoisting Behavior |
|----------|-------------------|
| **JavaScript** | Function declarations and `var` are hoisted |
| **Java** | No hoisting - must declare before use |

```javascript
// JavaScript - This works!
console.log(hoistedVar);  // undefined (not error)
sayHello();               // "Hello World!"

var hoistedVar = "I'm hoisted";

function sayHello() {
    console.log("Hello World!");
}
```

```java
// Java - This would cause compilation error
System.out.println(notDeclared);  // Compilation error
sayHello();                       // Compilation error

String notDeclared = "Java doesn't hoist";
public void sayHello() {
    System.out.println("Hello World!");
}
```

### Hoisting Phases:
1. **Creation Phase**: Memory allocated for variables and functions
2. **Execution Phase**: Code runs line by line

```javascript
// What JavaScript engine does internally:
// Creation Phase:
var hoistedVar = undefined;
function sayHello() { /* function body */ }

// Execution Phase:
console.log(hoistedVar);  // undefined
sayHello();               // "Hello World!"
hoistedVar = "I'm hoisted";
```

---

## 3. Closures in JavaScript

### What is the need for Closures?

**Purpose:**
- Data privacy and encapsulation
- Creating function factories
- Maintaining state between function calls
- Callback functions with preserved scope

### How bad is life without Closures?

| Problem | Without Closures | With Closures |
|---------|------------------|---------------|
| **Data Privacy** | Global variables, naming conflicts | Private variables |
| **State Management** | Complex object-oriented patterns | Simple function-based state |
| **Function Factories** | Repetitive code | Reusable function generators |
| **Event Handling** | Data passed through DOM or globals | Data captured in scope |

### Real-life Examples:

#### 1. Private Variables (like Java private fields):
```javascript
// Without Closures - Everything is public
let bankBalance = 1000;
function deposit(amount) {
    bankBalance += amount;
}
function withdraw(amount) {
    bankBalance -= amount;
}
// Problem: bankBalance can be modified directly
bankBalance = 0; // Oops!

// With Closures - Private data
function createBankAccount(initialBalance) {
    let balance = initialBalance;  // Private variable
    
    return {
        deposit: function(amount) {
            balance += amount;
            return balance;
        },
        withdraw: function(amount) {
            if (amount <= balance) {
                balance -= amount;
                return balance;
            }
            return "Insufficient funds";
        },
        getBalance: function() {
            return balance;
        }
    };
}

const account = createBankAccount(1000);
account.deposit(500);    // 1500
account.withdraw(200);   // 1300
// account.balance = 0;  // Can't access private balance!
```

#### 2. Function Factories:
```javascript
// Creating specialized functions
function createMultiplier(factor) {
    return function(number) {
        return number * factor;
    };
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

console.log(double(5));  // 10
console.log(triple(5));  // 15
```

#### 3. Event Handlers with Context:
```javascript
function setupButton(name) {
    return function() {
        console.log(`Button ${name} clicked!`);
    };
}

document.getElementById('btn1').onclick = setupButton('Save');
document.getElementById('btn2').onclick = setupButton('Cancel');
```

---

## 4. Block vs Function Scoped

### Comparison Table:

| Aspect | Function Scoped (`var`) | Block Scoped (`let`, `const`) |
|--------|-------------------------|-------------------------------|
| **Scope Boundary** | Function boundaries | Block boundaries `{}` |
| **Hoisting** | Hoisted and initialized with `undefined` | Hoisted but not initialized |
| **Re-declaration** | Allowed | Not allowed |
| **Temporal Dead Zone** | No | Yes |

### Real-life Example:
```javascript
// Function Scoped Problem
function processUsers() {
    for (var i = 0; i < 3; i++) {
        setTimeout(function() {
            console.log("Processing user " + i);  // Always prints 3!
        }, 100);
    }
}

// Block Scoped Solution
function processUsersFixed() {
    for (let i = 0; i < 3; i++) {
        setTimeout(function() {
            console.log("Processing user " + i);  // Prints 0, 1, 2
        }, 100);
    }
}
```

### Practical Use Cases:

#### Loop Variables:
```javascript
// Problem with var
for (var i = 0; i < 3; i++) {
    // i is function-scoped, shared across iterations
}
console.log(i); // 3 (accessible outside loop)

// Solution with let
for (let j = 0; j < 3; j++) {
    // j is block-scoped, new binding each iteration
}
console.log(j); // ReferenceError: j is not defined
```

#### Conditional Blocks:
```javascript
function authenticate(user) {
    if (user.isValid) {
        var token = generateToken();  // Function scoped
        let sessionId = createSession(); // Block scoped
        const permissions = getPermissions(); // Block scoped
    }
    
    console.log(token);       // undefined (but accessible)
    console.log(sessionId);   // ReferenceError
    console.log(permissions); // ReferenceError
}
```

### Why is `token` undefined but accessible?

**The Mystery Explained:**

When JavaScript engine processes this function during the **Creation Phase**:

```javascript
function authenticate(user) {
    // Creation Phase: var token is hoisted to function scope
    var token = undefined;  // Hoisted declaration
    
    if (user.isValid) {
        // Execution Phase: Only runs if condition is true
        token = generateToken();  // Assignment happens here
        let sessionId = createSession(); // Block scoped - only exists here
        const permissions = getPermissions(); // Block scoped - only exists here
    }
    
    // token is accessible because it's function-scoped and hoisted
    console.log(token);       // undefined if condition was false
                             // actual value if condition was true
    console.log(sessionId);   // ReferenceError - doesn't exist outside block
    console.log(permissions); // ReferenceError - doesn't exist outside block
}
```

### Step-by-step Execution:

| Step | What Happens | `token` Value |
|------|-------------|---------------|
| **1. Creation** | `var token` hoisted to function scope | `undefined` |
| **2. Condition Check** | `if (user.isValid)` evaluated | Still `undefined` |
| **3a. If True** | `token = generateToken()` executes | Actual generated value |
| **3b. If False** | Assignment never happens | Remains `undefined` |
| **4. Console.log** | `token` is accessible due to function scope | `undefined` or actual value |

### Real-life Example:
```javascript
function processOrder(order) {
    // token is hoisted here (Creation Phase)
    var token = undefined;
    
    if (order.isPaid) {
        token = generatePaymentToken(); // Assignment only if paid
        let tempOrderId = createTempOrder(); // Block scoped
    }
    
    // token exists but might be undefined
    console.log(token); // undefined if not paid, actual token if paid
    
    // This would cause error
    console.log(tempOrderId); // ReferenceError
}

// Usage:
processOrder({ isPaid: false }); // token: undefined
processOrder({ isPaid: true });  // token: actual token value
```

### Can we use hoisted `var` outside the function?

**No! `var` is function-scoped, not globally accessible from inside functions.**

| Scope Type | Accessibility | Example |
|------------|---------------|---------|
| **Global `var`** | Accessible everywhere | `var globalVar = "global"` |
| **Function `var`** | Only within that function | `function test() { var localVar = "local"; }` |
| **Block `var`** | Within the entire function (not just block) | `if (true) { var blockVar = "block"; }` |

### Detailed Examples:

#### 1. Function-scoped `var` - NOT accessible outside:
```javascript
function myFunction() {
    var functionVar = "I'm trapped in function";
    console.log(functionVar); // Works fine
}

myFunction();
console.log(functionVar); // ReferenceError: functionVar is not defined
```

#### 2. Global `var` - Accessible everywhere:
```javascript
var globalVar = "I'm global";

function myFunction() {
    console.log(globalVar); // Works - accessing global var
    var localVar = "I'm local";
}

myFunction();
console.log(globalVar); // Works - global var accessible
console.log(localVar);  // ReferenceError - local var not accessible
```

#### 3. Block-level `var` - Function scoped, not block scoped:
```javascript
function testBlocks() {
    if (true) {
        var blockVar = "I'm in a block";
    }
    
    // blockVar is accessible here because var is function-scoped
    console.log(blockVar); // "I'm in a block"
}

testBlocks();
console.log(blockVar); // ReferenceError - not accessible outside function
```

### Real-life Use Cases:

#### 1. Sharing Variables Across Multiple Blocks (within same function):
```javascript
function processUserData(user) {
    var userData; // Hoisted to function scope
    
    if (user.isValid) {
        userData = sanitizeUser(user);
    }
    
    if (user.hasPermissions) {
        userData.permissions = getPermissions(user);
    }
    
    // userData is accessible here from both blocks
    return userData;
}
```

#### 2. Loop Variables (classic problem):
```javascript
// Problem: var is function-scoped, shared across iterations
function createButtons() {
    for (var i = 0; i < 3; i++) {
        setTimeout(function() {
            console.log("Button " + i); // Always prints "Button 3"
        }, 100);
    }
    // i is accessible here: console.log(i); // 3
}

// Solution: Use let for block scope
function createButtonsFixed() {
    for (let i = 0; i < 3; i++) {
        setTimeout(function() {
            console.log("Button " + i); // Prints "Button 0", "Button 1", "Button 2"
        }, 100);
    }
    // i is NOT accessible here: console.log(i); // ReferenceError
}
```

### Summary Table:

| Declaration Location | Scope | Accessible Outside Function? |
|---------------------|-------|------------------------------|
| **Inside function** | Function scope | ❌ No |
| **Inside block (within function)** | Function scope | ❌ No (but accessible within function) |
| **Global scope** | Global scope | ✅ Yes, everywhere |

### Key Takeaway:
- `var` declared inside a function is **never accessible outside that function**
- `var` declared in a block is accessible **throughout the entire function** (not just the block)
- Only **global `var`** is accessible everywhere

---

## 5. Function Declaration vs Expression

### Why do we need both?

| Aspect | Function Declaration | Function Expression |
|--------|---------------------|---------------------|
| **Hoisting** | Fully hoisted | Not hoisted |
| **Conditional Creation** | Not recommended | Perfectly fine |
| **Naming** | Must be named | Can be anonymous |
| **Usage** | Called before definition | Called after definition |

### Benefits and Use Cases:

#### Function Declaration Benefits:
```javascript
// 1. Can be called before definition
startApplication();

function startApplication() {
    console.log("App started");
}

// 2. Great for main program flow
function main() {
    initializeDatabase();
    setupRoutes();
    startServer();
}

// Helper functions can be defined after main
function initializeDatabase() { /* ... */ }
function setupRoutes() { /* ... */ }
function startServer() { /* ... */ }
```

#### Function Expression Benefits:
```javascript
// 1. Conditional function creation
const isProduction = process.env.NODE_ENV === 'production';

const logger = isProduction 
    ? function(msg) { /* production logging */ }
    : function(msg) { console.log(msg); };

// 2. Callbacks and higher-order functions
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(function(num) {
    return num * 2;
});

// 3. Immediately Invoked Function Expressions (IIFE)
(function() {
    // Private scope
    const privateVar = "Can't access me outside";
    // Initialization code
})();

// 4. Methods in objects
const calculator = {
    add: function(a, b) {
        return a + b;
    },
    multiply: function(a, b) {
        return a * b;
    }
};
```

### Real-life Example - Express.js Route Handler:
```javascript
// Function expressions are perfect for route handlers
app.get('/users', function(req, res) {
    // Handle GET request
});

app.post('/users', function(req, res) {
    // Handle POST request
});

// vs Function declarations would be less flexible
function getUsersHandler(req, res) {
    // Handle GET request
}
app.get('/users', getUsersHandler);
```

### Summary Table:

| Use Case | Recommended Approach |
|----------|---------------------|
| **Main program flow** | Function Declaration |
| **Utility functions** | Function Declaration |
| **Conditional logic** | Function Expression |
| **Callbacks** | Function Expression |
| **Event handlers** | Function Expression |
| **Object methods** | Function Expression |
| **IIFE patterns** | Function Expression |