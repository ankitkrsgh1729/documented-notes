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
Type coercion is JavaScript's automatic conversion of values from one data type to another during operations or comparisons.
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

Temporal Dead Zone
TDZ = "The variable exists but you can't touch it yet"
Variable is hoisted (JavaScript knows it exists)
But not initialized (can't access it until declaration line)
Accessing it throws an error (instead of returning undefined)
This makes JavaScript more predictable and helps catch bugs early!

Key Differences Summary:
Variable Type	Hoisted?	Initialized?	TDZ?
var	✅ Yes	✅ Yes (undefined)	❌ No
let	✅ Yes	❌ No	✅ Yes
const	✅ Yes	❌ No	✅ Yes

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
    
    return {     // It's mostly because the function is getting returned, that's why it'll return lexical score of this function. that's why balance varibale will be availble during return function execution
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


```
function Person(name) {
    this.name = name;
    let secretCode = "123ABC"; // Private variable
    
    this.revealSecret = function() {
        console.log(secretCode); // TRUE closure - accesses private var
    };
}

const person1 = new Person("John");
person1.revealSecret(); // "123ABC"
console.log(person1.secretCode); // undefined - truly private!
```


'this' keyword for variable is slighthly against closure concept, because it closures is defined for private variables to be accessible in outside score.
But with 'this' keyword provides context of variable to child objects. //Ankit theory//
```
function Person(name) {
    this.name = name;
    this.age = 12;
    
    this.greet = function() {
        console.log(`Hi, I'm ${this.name} and I'm ${this.age}`);
    };
}

const person1 = new Person("John");

// These all work outside the constructor:
console.log(person1.name);  // "John"
console.log(person1.age);   // 12
person1.greet();            // "Hi, I'm John and I'm 12"

// You can even modify them:
person1.age = 25;
console.log(person1.age);   // 25

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

Type error in case of variable assigned a function and called before impl;
```
// Function declarations - fully hoisted
console.log(test());      // Works! Prints "hello"
function test() {
    return "hello";
}

// var - hoisted but undefined
console.log(x);           // undefined (not error)
var x = 5;

// let/const - hoisted but in TDZ
console.log(y);           // ReferenceError
let y = 10;

// Function expressions - not hoisted
console.log(fn());        // TypeError: fn is not a function
var fn = function() {
    return "hi";
};
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
    // Each iteration creates NEW variable 'i'
}

var creates one variable for entire function, let creates new variable per block iteration.
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

---

## 6. Objects and Prototypes

### Objects in JavaScript vs Java

| Aspect | JavaScript Objects | Java Objects |
|--------|-------------------|--------------|
| **Creation** | Object literals `{}` or `new Object()` | Must use `new ClassName()` |
| **Properties** | Dynamic - can add/remove at runtime | Fixed - defined in class |
| **Methods** | Functions as properties | Methods defined in class |
| **Inheritance** | Prototype-based | Class-based |
| **Type Checking** | Duck typing | Static typing |

### Object Creation Methods:

```javascript
// 1. Object Literal (most common)
const user = {
    name: "John",
    age: 30,
    greet: function() {
        return `Hello, I'm ${this.name}`;
    }
};

// 2. Constructor Function
function User(name, age) {
    this.name = name;
    this.age = age;
    this.greet = function() {
        return `Hello, I'm ${this.name}`;
    };
}
const user2 = new User("Jane", 25);

// 3. Object.create()
const userPrototype = {
    greet: function() {
        return `Hello, I'm ${this.name}`;
    }
};
const user3 = Object.create(userPrototype);
user3.name = "Bob";
user3.age = 35;

// 4. ES6 Classes (syntactic sugar over prototypes)
class User {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }
    
    greet() {
        return `Hello, I'm ${this.name}`;
    }
}
const user4 = new User("Alice", 28);
```

### What is Prototype Chain?

**Prototype Chain**: When you access a property on an object, JavaScript first looks on the object itself, then on its prototype, then on the prototype's prototype, and so on.

```javascript
// Every object has a prototype
const animal = {
    speak: function() {
        return "Some sound";
    }
};

const dog = Object.create(animal);
dog.breed = "Labrador";
dog.bark = function() {
    return "Woof!";
};

console.log(dog.breed);  // "Labrador" (own property)
console.log(dog.speak()); // "Some sound" (inherited from animal)
console.log(dog.bark());  // "Woof!" (own method)
```

### Prototype Chain Visualization:

```
dog object
├── breed: "Labrador"
├── bark: function
└── __proto__ → animal object
                 ├── speak: function
                 └── __proto__ → Object.prototype
                                 ├── toString: function
                                 ├── valueOf: function
                                 └── __proto__ → null
```

### Real-life Example - E-commerce System:

```javascript
// Base Product prototype
const Product = {
    calculateDiscount: function(percentage) {
        return this.price * (percentage / 100);
    },
    
    getInfo: function() {
        return `${this.name} - ${this.price}`;
    }
};

// Electronics inherits from Product
const Electronics = Object.create(Product);
Electronics.calculateWarranty = function(years) {
    return `${years} year warranty included`;
};

// Specific phone inherits from Electronics
const phone = Object.create(Electronics);
phone.name = "iPhone 15";
phone.price = 999;
phone.storage = "128GB";

// Usage
console.log(phone.getInfo());           // "iPhone 15 - $999" (from Product)
console.log(phone.calculateDiscount(10)); // 99.9 (from Product)
console.log(phone.calculateWarranty(2));   // "2 year warranty included" (from Electronics)
```

### Why Prototypes over Classes?

| Benefit | Explanation |
|---------|-------------|
| **Memory Efficiency** | Methods shared across instances |
| **Dynamic Inheritance** | Can modify prototypes at runtime |
| **Flexibility** | Mix and match behaviors |
| **JavaScript Native** | How JavaScript actually works internally |

---

## 7. Arrays and Array Methods

### Arrays in JavaScript vs Java

| Aspect | JavaScript Arrays | Java Arrays |
|--------|------------------|-------------|
| **Type** | Dynamic, can hold mixed types | Static, single type |
| **Size** | Dynamic resizing | Fixed size |
| **Methods** | Rich set of built-in methods | Limited built-in methods |
| **Declaration** | `let arr = [1, "hello", true]` | `int[] arr = new int[5]` |

### Essential Array Methods:

#### 1. Mutating Methods (modify original array):

```javascript
let fruits = ["apple", "banana"];

// Adding elements
fruits.push("orange");        // ["apple", "banana", "orange"]
fruits.unshift("mango");      // ["mango", "apple", "banana", "orange"]

// Removing elements
fruits.pop();                 // ["mango", "apple", "banana"]
fruits.shift();               // ["apple", "banana"]

// Modifying elements
fruits.splice(1, 1, "grape"); // ["apple", "grape"] (remove 1 at index 1, add "grape")
```

#### 2. Non-mutating Methods (return new array):

```javascript
const numbers = [1, 2, 3, 4, 5];

// Transform each element
const doubled = numbers.map(n => n * 2);           // [2, 4, 6, 8, 10]

// Filter elements
const evenNumbers = numbers.filter(n => n % 2 === 0); // [2, 4]

// Reduce to single value
const sum = numbers.reduce((acc, n) => acc + n, 0);    // 15

// Find elements
const found = numbers.find(n => n > 3);               // 4
const foundIndex = numbers.findIndex(n => n > 3);     // 3

// Check conditions
const hasEven = numbers.some(n => n % 2 === 0);       // true
const allPositive = numbers.every(n => n > 0);        // true
```

### Real-life Example - User Management:

```javascript
const users = [
    { id: 1, name: "John", age: 30, role: "admin", active: true },
    { id: 2, name: "Jane", age: 25, role: "user", active: false },
    { id: 3, name: "Bob", age: 35, role: "user", active: true },
    { id: 4, name: "Alice", age: 28, role: "admin", active: true }
];

// Get all active users
const activeUsers = users.filter(user => user.active);

// Get user names only
const userNames = users.map(user => user.name);

// Find admin users
const adminUsers = users.filter(user => user.role === "admin");

// Calculate average age
const averageAge = users.reduce((sum, user) => sum + user.age, 0) / users.length;

// Check if any user is inactive
const hasInactiveUsers = users.some(user => !user.active);

// Transform for display
const userDisplay = users
    .filter(user => user.active)
    .map(user => ({
        displayName: `${user.name} (${user.role})`,
        canEdit: user.role === "admin"
    }));
```

### Method Chaining Pattern:

```javascript
const result = users
    .filter(user => user.active)           // Get active users
    .filter(user => user.age > 25)         // Age filter
    .map(user => ({                        // Transform data
        name: user.name,
        role: user.role.toUpperCase()
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
```

### Array Methods Comparison Table:

| Method | Returns | Mutates Original | Use Case |
|--------|---------|------------------|----------|
| `push/pop` | Length/Element | ✅ Yes | Add/remove from end |
| `unshift/shift` | Length/Element | ✅ Yes | Add/remove from start |
| `splice` | Removed elements | ✅ Yes | Insert/remove at position |
| `map` | New array | ❌ No | Transform elements |
| `filter` | New array | ❌ No | Select elements |
| `reduce` | Single value | ❌ No | Aggregate data |
| `find` | First match | ❌ No | Find element |
| `some/every` | Boolean | ❌ No | Test conditions |

---

## 8. Template Literals and Destructuring

### Template Literals - Beyond String Concatenation

#### Before Template Literals:
```javascript
const name = "John";
const age = 30;
const role = "developer";

// Old way - messy concatenation
const message = "Hello, my name is " + name + ". I'm " + age + " years old and I work as a " + role + ".";

// With newlines - even messier
const html = "<div class=\"user-card\">\n" +
             "  <h3>" + name + "</h3>\n" +
             "  <p>Age: " + age + "</p>\n" +
             "</div>";
```

#### With Template Literals:
```javascript
const name = "John";
const age = 30;
const role = "developer";

// Clean and readable
const message = `Hello, my name is ${name}. I'm ${age} years old and I work as a ${role}.`;

// Multi-line strings
const html = `
    <div class="user-card">
        <h3>${name}</h3>
        <p>Age: ${age}</p>
        <p>Role: ${role}</p>
    </div>
`;

// Expressions inside templates
const greeting = `Hello ${name.toUpperCase()}! You are ${age >= 18 ? 'an adult' : 'a minor'}.`;
```

### Advanced Template Literal Features:

#### 1. Tagged Template Literals:
```javascript
function highlight(strings, ...values) {
    return strings.reduce((result, string, i) => {
        const value = values[i] ? `<mark>${values[i]}</mark>` : '';
        return result + string + value;
    }, '');
}

const searchTerm = "JavaScript";
const text = highlight`Learn ${searchTerm} programming with ${name}`;
// "Learn <mark>JavaScript</mark> programming with <mark>John</mark>"
```

#### 2. Real-life Example - SQL Query Builder:
```javascript
function buildUserQuery(filters) {
    const { name, minAge, role } = filters;
    
    return `
        SELECT * FROM users 
        WHERE 1=1
        ${name ? `AND name LIKE '%${name}%'` : ''}
        ${minAge ? `AND age >= ${minAge}` : ''}
        ${role ? `AND role = '${role}'` : ''}
        ORDER BY created_at DESC
    `;
}

const query = buildUserQuery({ name: "John", minAge: 25 });
```

### Destructuring - Unpacking Values

#### Array Destructuring:
```javascript
const coordinates = [10, 20, 30];

// Old way
const x = coordinates[0];
const y = coordinates[1];
const z = coordinates[2];

// Destructuring way
const [x, y, z] = coordinates;

// Advanced patterns
const [first, second, ...rest] = [1, 2, 3, 4, 5];
// first: 1, second: 2, rest: [3, 4, 5]

// Skipping elements
const [, , third] = [1, 2, 3, 4, 5];
// third: 3

// Default values
const [a = 0, b = 0] = [1];
// a: 1, b: 0
```

#### Object Destructuring:
```javascript
const user = {
    id: 1,
    name: "John",
    email: "john@example.com",
    address: {
        street: "123 Main St",
        city: "New York"
    }
};

// Basic destructuring
const { name, email } = user;

// Renaming variables
const { name: userName, email: userEmail } = user;

// Default values
const { role = "user" } = user;

// Nested destructuring
const { address: { city, street } } = user;

// Rest operator
const { id, ...userInfo } = user;
```

### Real-life Examples:

#### 1. Function Parameters:
```javascript
// Instead of accessing props.name, props.age, etc.
function createUser(props) {
    return {
        displayName: props.name,
        isAdult: props.age >= 18,
        contact: props.email
    };
}

// Use destructuring in parameters
function createUser({ name, age, email, role = "user" }) {
    return {
        displayName: name,
        isAdult: age >= 18,
        contact: email,
        role
    };
}

// Usage
const userData = createUser({ name: "John", age: 30, email: "john@example.com" });
```

#### 2. API Response Handling:
```javascript
// Typical API response
const apiResponse = {
    data: {
        users: [
            { id: 1, name: "John" },
            { id: 2, name: "Jane" }
        ]
    },
    status: 200,
    message: "Success"
};

// Clean destructuring
const { 
    data: { users }, 
    status, 
    message 
} = apiResponse;

// Use the destructured data
users.forEach(({ id, name }) => {
    console.log(`User ${id}: ${name}`);
});
```

#### 3. React Component Props (common pattern):
```javascript
// Instead of props.title, props.content, etc.
function Card(props) {
    return `
        <div class="card">
            <h3>${props.title}</h3>
            <p>${props.content}</p>
        </div>
    `;
}

// Destructure props
function Card({ title, content, className = "card" }) {
    return `
        <div class="${className}">
            <h3>${title}</h3>
            <p>${content}</p>
        </div>
    `;
}
```

### Why These Features Matter:

| Feature | Problem Solved | Benefit |
|---------|----------------|---------|
| **Template Literals** | String concatenation mess | Clean, readable string building |
| **Array Destructuring** | Verbose array access | Concise value extraction |
| **Object Destructuring** | Repetitive property access | Clean parameter handling |
| **Default Values** | Undefined checks | Safe fallback values |
| **Rest/Spread** | Manual array/object operations | Flexible data manipulation |