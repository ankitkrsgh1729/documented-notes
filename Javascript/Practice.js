//// Inheritance

class Animal {
    constructor(name, weight) {
        this.name = name;
        this.weight = weight;
    }

    eat() {
        console.log(`${this.name} is eating`);
    }
}


class Dog extends Animal {
    constructor(name, weight, breed) {
        super(name, weight);
        this.breed = breed;
    }

    bark() {
        console.log(`${this.name} is barking`);
    }

    eat() {
        super.eat();
        console.log(`${this.name} finished eating`);
    }
}

const dog = new Dog("Rex", 10, "German Shepherd");

// dog.eat();


/// Prototype

let user  = {
    name: "John",
    age: 20,
    greet() {
        console.log(`Hello, my name is ${this.name}`);
    }
}

/// WRIONG : Only constructor functions can have prototypes
// user.prototype.sell = function(stuff) {
//     console.log(`${this.name} is selling, ${stuff}`);
// }
// user.sell("Apple");

function User(name, age) {
    this.name = name;
    this.age = age;
}

User.prototype.sell = function(stuff) {
    console.log(`${this.name} is selling, ${stuff}`);
}

User.prototype.greet = function() {
    console.log(`Hello, my name is ${this.name}`);
}

class Ankit extends User {
    constructor(name, age, job) {
        super(name, age);
        this.job = job;
    }

    work() {
        console.log(`${this.name} is working`);
    }
}

let ankit = new Ankit("Ankit", 20, "Software Engineer");

// ankit.greet();
// ankit.sell("Apple");
// ankit.work();



//////////////////////////////////////////// Encapsulation ////////////////////////////////////////////



function User1(name, age) {
    let balance = 1000;


    return {
        greet: function() {
            console.log(`Hello, my name is ${name}`);
        },
        sell: function(stuff, amount) {
            balance += amount;
            console.log(`${name} sold ${stuff} for ${amount}`);
        },
        getBalance: function() {
            return balance;
        }
    }
}

let userBalance = new User1("John", 20);

userBalance.greet();
userBalance.sell("Apple", 100);
console.log(userBalance.getBalance());


// /// WRONG : "this" context inside the return object is not the same as the "this" context of the function
// function User(name, age) {
//     this.name = name;
//     this.age = age;
//     this.balance = 1000;

//     return {
//         greet: function() {
//             console.log(`Hello, my name is ${this.name}`);
//         },
//         sell: function(stuff, amount) {
//             this.balance += amount;
//             console.log(`${this.name} sold ${stuff} for ${amount}`);
//         },
//         getBalance: function() {
//             return this.balance;
//         }
//     }
// }


// More example of closures w.r.t. classes

// Example 1: Private variables using closures in classes
class BankAccount {
    constructor(initialBalance) {
        let balance = initialBalance; // Private variable through closure
        
        this.deposit = function(amount) {
            balance += amount;
            console.log(`Deposited $${amount}. New balance: $${balance}`);
        };
        
        this.withdraw = function(amount) {
            if (amount <= balance) {
                balance -= amount;
                console.log(`Withdrew $${amount}. New balance: $${balance}`);
            } else {
                console.log("Insufficient funds!");
            }
        };
        
        this.getBalance = function() {
            return balance; // Closure access to private variable
        };
    }
}

const account = new BankAccount(1000);
account.deposit(500);
account.withdraw(200);
console.log(`Current balance: $${account.getBalance()}`);
// console.log(account.balance); // undefined - truly private!

// Example 2: Factory methods that create closures
class TaskManager {
    constructor() {
        this.tasks = [];
    }
    
    createTask(name) {
        let completed = false;
        let taskId = Date.now();
        
        const task = {
            getName: () => name,
            getId: () => taskId,
            complete: () => {
                completed = true;
                console.log(`Task "${name}" completed!`);
            },
            isCompleted: () => completed,
            getStatus: () => `Task: ${name}, ID: ${taskId}, Completed: ${completed}`
        };
        
        this.tasks.push(task);
        return task;
    }
    
    getAllTasks() {
        return this.tasks;
    }
}

const manager = new TaskManager();
const task1 = manager.createTask("Learn JavaScript");
const task2 = manager.createTask("Build a project");

console.log(task1.getStatus());
task1.complete();
console.log(task1.getStatus());

// Example 3: Event handlers with closure
class Counter {
    constructor(startValue = 0) {
        this.count = startValue;
    }
    
    // Returns a function that captures the current instance
    getIncrementer() {
        return () => {
            this.count++;
            console.log(`Count: ${this.count}`);
        };
    }
    
    // Returns a function that captures custom increment value
    getCustomIncrementer(increment) {
        return () => {
            this.count += increment;
            console.log(`Count increased by ${increment}: ${this.count}`);
        };
    }
    
    // Simulate event handler
    setupEventHandler() {
        const handler = (eventType) => {
            console.log(`Event "${eventType}" triggered. Current count: ${this.count}`);
            this.count++;
        };
        return handler;
    }
}

const counter = new Counter(10);
const increment = counter.getIncrementer();
const incrementBy5 = counter.getCustomIncrementer(5);

increment(); // Count: 11
increment(); // Count: 12
incrementBy5(); // Count increased by 5: 17


// IMPORTANT: Understanding `this` in Closures - Arrow vs Regular Functions

class ThisContextDemo {
    constructor(name) {
        this.name = name;
        this.counter = 0;
    }
    
    // ✅ WORKS: Arrow functions preserve `this` context
    getArrowFunction() {
        return () => {
            this.counter++;
            console.log(`Arrow function: ${this.name}, count: ${this.counter}`);
        };
    }
    
    // ❌ DOESN'T WORK: Regular functions lose `this` context
    getRegularFunction() {
        return function() {
            this.counter++;  // `this` is undefined or global object
            console.log(`Regular function: ${this.name}, count: ${this.counter}`);
        };
    }
    
    // ✅ WORKS: Using closure variables instead of `this`
    getClosureFunction() {
        let localCounter = 0;
        const name = this.name;  // Capture in closure
        
        return function() {
            localCounter++;
            console.log(`Closure function: ${name}, count: ${localCounter}`);
        };
    }
    
    // ✅ WORKS: Binding `this` explicitly
    getBoundFunction() {
        const regularFunc = function() {
            this.counter++;
            console.log(`Bound function: ${this.name}, count: ${this.counter}`);
        };
        
        return regularFunc.bind(this);  // Explicitly bind `this`
    }
}

const demo = new ThisContextDemo("TestObject");

// Test different approaches
const arrowFunc = demo.getArrowFunction();
const regularFunc = demo.getRegularFunction();
const closureFunc = demo.getClosureFunction();
const boundFunc = demo.getBoundFunction();

console.log("=== Testing Arrow Function (WORKS) ===");
arrowFunc();  // Works fine
arrowFunc();  // Works fine

console.log("\n=== Testing Regular Function (BREAKS) ===");
try {
    regularFunc();  // Will throw error or show undefined
} catch (error) {
    console.log("Error:", error.message);
}

console.log("\n=== Testing Closure Function (WORKS) ===");
closureFunc();  // Works with closure variables
closureFunc();  // Works with closure variables

console.log("\n=== Testing Bound Function (WORKS) ===");
boundFunc();  // Works with explicit binding
boundFunc();  // Works with explicit binding

// Real-world example showing the difference
class EventHandler {
    constructor(elementName) {
        this.elementName = elementName;
        this.clickCount = 0;
    }
    
    // ❌ WRONG WAY: Regular function loses `this`
    getWrongClickHandler() {
        return function(event) {
            this.clickCount++;  // `this` is NOT the EventHandler instance
            console.log(`${this.elementName} clicked ${this.clickCount} times`);
        };
    }
    
    // ✅ RIGHT WAY: Arrow function preserves `this`
    getCorrectClickHandler() {
        return (event) => {
            this.clickCount++;  // `this` IS the EventHandler instance
            console.log(`${this.elementName} clicked ${this.clickCount} times`);
        };
    }
    
    // ✅ ALTERNATIVE WAY: Using closure variables
    getClosureClickHandler() {
        let clickCount = 0;
        const elementName = this.elementName;
        
        return function(event) {
            clickCount++;
            console.log(`${elementName} clicked ${clickCount} times`);
        };
    }
}

console.log("\n=== Real-world Event Handler Example ===");
const handler = new EventHandler("Button");

const wrongHandler = handler.getWrongClickHandler();
const correctHandler = handler.getCorrectClickHandler();
const closureHandler = handler.getClosureClickHandler();

console.log("Wrong handler (will fail):");
try {
    wrongHandler();  // Fails
} catch (error) {
    console.log("Error:", error.message);
}

console.log("Correct handler (arrow function):");
correctHandler();  // Works
correctHandler();  // Works

console.log("Closure handler (captured variables):");
closureHandler();  // Works
closureHandler();  // Works




//////////////////////////////////////////// Polymorphism ////////////////////////////////////////////

// The 3 Key Parts:
// 📋 INTERFACE/CONTRACT - Defines WHAT methods must exist
// 🔧 IMPLEMENTATION - Defines HOW those methods work
// 🔄 POLYMORPHISM - Different objects can be used interchangeably

// Example 1: Basic Polymorphism - Method Overriding
class Animal1 {
    constructor(name) {
        this.name = name;
    }

    makeSound() {
        throw new Error("Method 'makeSound' must be implemented.");
    }
    
    move() {
        console.log(`${this.name} is moving`);
    }
}

class Dog1 extends Animal1 {
    makeSound() {
        console.log(`${this.name} is barking: Woof! Woof!`);
    }
    
    move() {
        console.log(`${this.name} is running on four legs`);
    }
}

class Cat1 extends Animal1 {
    makeSound() {
        console.log(`${this.name} is meowing: Meow! Meow!`);
    }
    
    move() {
        console.log(`${this.name} is prowling silently`);
    }
}

// Polymorphism in action - same method call, different behaviors
const animals = [
    new Dog1("Rex"),
    new Cat1("Whiskers")
];

console.log("=== Polymorphism Example 1: Method Overriding ===");
animals.forEach(animal => {
    animal.makeSound();  // Different implementation for each animal
    animal.move();       // Different movement behavior
    console.log("---");
});

// Example 2: Interface-like Polymorphism - Payment Processing
class PaymentProcessor {
    processPayment(amount) {
        throw new Error("Method 'processPayment' must be implemented.");
    }
    
    validatePayment(amount) {
        if (amount <= 0) {
            throw new Error("Payment amount must be positive");
        }
        return true;
    }
}

class CreditCardProcessor extends PaymentProcessor {
    constructor(cardNumber, expiryDate) {
        super();
        this.cardNumber = cardNumber;
        this.expiryDate = expiryDate;
    }
    
    processPayment(amount) {
        this.validatePayment(amount);
        console.log(`Processing $${amount} via Credit Card ending in ${this.cardNumber.slice(-4)}`);
        console.log("Credit card payment successful!");
        return { success: true, transactionId: `CC_${Date.now()}` };
    }
}

class PayPalProcessor extends PaymentProcessor {
    constructor(email) {
        super();
        this.email = email;
    }
    
    processPayment(amount) {
        this.validatePayment(amount);
        console.log(`Processing $${amount} via PayPal for ${this.email}`);
        console.log("PayPal payment successful!");
        return { success: true, transactionId: `PP_${Date.now()}` };
    }
}


// E-commerce checkout system using polymorphism
class ShoppingCart {
    constructor() {
        this.items = [];
        this.total = 0;
    }
    
    addItem(item, price) {
        this.items.push({ item, price });
        this.total += price;
    }
    
    // Polymorphic method - works with any PaymentProcessor
    checkout(paymentProcessor) {
        console.log(`\nChecking out ${this.items.length} items totaling $${this.total}`);
        
        try {
            const result = paymentProcessor.processPayment(this.total);
            console.log(`Transaction ID: ${result.transactionId}`);
            this.items = [];
            this.total = 0;
            return result;
        } catch (error) {
            console.log(`Payment failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// console.log("\n=== Polymorphism Example 2: Payment Processing ===");
// const cart = new ShoppingCart();
// cart.addItem("Laptop", 999.99);
// cart.addItem("Mouse", 29.99);

// // Same checkout method, different payment processors
// const creditCard = new CreditCardProcessor("1234567890123456", "12/25");
// const paypal = new PayPalProcessor("user@example.com");
// const bitcoin = new CryptoProcessor("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "Bitcoin");

// // Polymorphism: same method call, different implementations
// cart.checkout(creditCard);
// cart.addItem("Keyboard", 79.99);
// cart.checkout(paypal);
// cart.addItem("Monitor", 299.99);
// cart.checkout(bitcoin);







//////////////////////////////////////////// Abstract Class ////////////////////////////////////////////

// What is an Abstract Class?
// An Abstract Class is a class that:
// Cannot be instantiated directly (you can't create objects from it)
// Serves as a TEMPLATE for other classes
// Contains both ABSTRACT methods (must be implemented) and CONCRETE methods (already implemented)
// Forces child classes to implement certain methods
// Think of it as a BLUEPRINT that says:
// "Here's what ALL child classes must have"
// "Here's some common functionality they can share"
// "But you can't use me directly - you must create a specific implementation"
// Why Do We Need Abstract Classes?
// 1. 🔒 ENFORCE CONTRACTS
// Force child classes to implement required methods
// 2. 🔄 SHARE CODE
// Provide common functionality to all child classes
// 3. 🛡️ PREVENT MISUSE
// Can't accidentally create instances of incomplete classes
// 4. 📋 DESIGN CLARITY
// Makes the inheritance hierarchy clear and intentional
// 5. 🔄 ENABLE POLYMORPHISM
// Treat different objects the same way



// Abstract class - cannot be instantiated
class AbstractVehicle {
    constructor(brand, model) {
        // Prevent direct instantiation
        if (this.constructor === AbstractVehicle) {
            throw new Error("Cannot instantiate abstract class");
        }
        
        this.brand = brand;
        this.model = model;
    }
    
    // ABSTRACT METHODS - must be implemented by children
    start() {
        throw new Error("Abstract method 'start' must be implemented");
    }
    
    stop() {
        throw new Error("Abstract method 'stop' must be implemented");
    }
    
    // CONCRETE METHODS - shared by all children
    getInfo() {
        return `${this.brand} ${this.model}`;
    }
    
    honk() {
        console.log(`${this.getInfo()} is honking!`);
    }
}

// Concrete implementations
class Car extends AbstractVehicle {
    start() {
        console.log(`${this.getInfo()} engine started with key`);
    }
    
    stop() {
        console.log(`${this.getInfo()} engine stopped`);
    }
}

class Motorcycle extends AbstractVehicle {
    start() {
        console.log(`${this.getInfo()} started with kick/button`);
    }
    
    stop() {
        console.log(`${this.getInfo()} engine stopped`);
    }
}


// ❌ This will throw an error
const vehicle = new AbstractVehicle("Generic", "Vehicle");

// ✅ This works fine
const car = new Car("Toyota", "Camry");
const motorcycle = new Motorcycle("Harley", "Davidson");

// // Polymorphism in action
// const vehicles = [car, motorcycle];
// vehicles.forEach(vehicle => {
//     vehicle.start();    // Different implementation for each
//     vehicle.honk();     // Shared method from abstract class
//     vehicle.stop();     // Different implementation for each
// });









