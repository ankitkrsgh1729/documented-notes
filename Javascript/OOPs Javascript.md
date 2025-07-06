# JavaScript OOP Concepts for Java Developers

## JavaScript vs Java: Key Differences

### Why JavaScript is Used
- **Client-side scripting**: Originally designed for web browsers to make web pages interactive
- **Server-side development**: Node.js allows JavaScript to run on servers
- **Full-stack development**: One language for both frontend and backend
- **Event-driven programming**: Excellent for handling user interactions and asynchronous operations
- **Rapid prototyping**: Dynamic typing allows for faster development cycles

### Core Differences from Java
| Aspect | Java | JavaScript |
|--------|------|------------|
| **Type System** | Static typing | Dynamic typing |
| **Compilation** | Compiled to bytecode | Interpreted (JIT compiled) |
| **Class Definition** | Class-based OOP | Prototype-based OOP |
| **Threading** | Multi-threaded | Single-threaded with event loop |
| **Memory Management** | Automatic (JVM) | Automatic (V8 engine) |

## 1. Objects and Classes

### Java Way (Your Background)
```java
// Java - Class definition
public class Person {
    private String name;
    private int age;
    
    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
```

### JavaScript Way - Multiple Approaches

#### ES6 Classes (Similar to Java)
```javascript
class Person {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }
    
    getName() {
        return this.name;
    }
    
    setName(name) {
        this.name = name;
    }
    
    // Static method
    static createDefault() {
        return new Person("Unknown", 0);
    }
}

const person = new Person("John", 30);
```

#### Constructor Functions (Pre-ES6)
```javascript
function Person(name, age) {
    this.name = name;
    this.age = age;
}

Person.prototype.getName = function() {
    return this.name;
};

Person.prototype.setName = function(name) {
    this.name = name;
};
```

#### Object Literals
```javascript
const person = {
    name: "John",
    age: 30,
    getName() {
        return this.name;
    },
    setName(name) {
        this.name = name;
    }
};
```

## 2. Encapsulation

### Java Encapsulation
```java
public class BankAccount {
    private double balance;
    
    public double getBalance() { return balance; }
    public void deposit(double amount) { balance += amount; }
}
```

### JavaScript Encapsulation

#### Using Private Fields (ES2022)
```javascript
class BankAccount {
    #balance = 0; // Private field
    
    getBalance() {
        return this.#balance;
    }
    
    deposit(amount) {
        this.#balance += amount;
    }
}
```

#### Using Closures (Traditional Way)
```javascript
function createBankAccount() {
    let balance = 0; // Private variable
    
    return {
        getBalance() { return balance; },
        deposit(amount) { balance += amount; },
        withdraw(amount) { 
            if (amount <= balance) balance -= amount; 
        }
    };
}

const account = createBankAccount();
```

#### Using Symbols for Privacy
```javascript
const _balance = Symbol('balance');

class BankAccount {
    constructor() {
        this[_balance] = 0;
    }
    
    getBalance() {
        return this[_balance];
    }
    
    deposit(amount) {
        this[_balance] += amount;
    }
}
```

## 3. Inheritance

### Java Inheritance
```java
public class Animal {
    protected String name;
    
    public void eat() {
        System.out.println(name + " is eating");
    }
}

public class Dog extends Animal {
    public void bark() {
        System.out.println(name + " is barking");
    }
}
```

### JavaScript Inheritance

#### ES6 Class Inheritance
```javascript
class Animal {
    constructor(name) {
        this.name = name;
    }
    
    eat() {
        console.log(`${this.name} is eating`);
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name); // Call parent constructor
        this.breed = breed;
    }
    
    bark() {
        console.log(`${this.name} is barking`);
    }
    
    eat() {
        super.eat(); // Call parent method
        console.log("Dog finished eating");
    }
}
```

#### Prototype Chain Inheritance
```javascript
function Animal(name) {
    this.name = name;
}

Animal.prototype.eat = function() {
    console.log(`${this.name} is eating`);
};

function Dog(name, breed) {
    Animal.call(this, name); // Call parent constructor
    this.breed = breed;
}

// Set up inheritance
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

Dog.prototype.bark = function() {
    console.log(`${this.name} is barking`);
};
```

## 4. Polymorphism

### Java Polymorphism
```java
public abstract class Shape {
    public abstract double calculateArea();
}

public class Circle extends Shape {
    private double radius;
    
    public double calculateArea() {
        return Math.PI * radius * radius;
    }
}
```

### JavaScript Polymorphism

#### Method Overriding
```javascript
class Shape {
    calculateArea() {
        throw new Error("Method must be implemented");
    }
}

class Circle extends Shape {
    constructor(radius) {
        super();
        this.radius = radius;
    }
    
    calculateArea() {
        return Math.PI * this.radius * this.radius;
    }
}

class Rectangle extends Shape {
    constructor(width, height) {
        super();
        this.width = width;
        this.height = height;
    }
    
    calculateArea() {
        return this.width * this.height;
    }
}

// Polymorphic usage
const shapes = [new Circle(5), new Rectangle(4, 6)];
shapes.forEach(shape => {
    console.log(shape.calculateArea()); // Different implementations called
});
```

#### Duck Typing (JavaScript-specific)
```javascript
// No need for inheritance - just implement the interface
const bird = {
    fly() { console.log("Bird flying"); }
};

const airplane = {
    fly() { console.log("Airplane flying"); }
};

const helicopter = {
    fly() { console.log("Helicopter flying"); }
};

function makeItFly(flyable) {
    flyable.fly(); // Works with any object that has a fly method
}

makeItFly(bird);     // Bird flying
makeItFly(airplane); // Airplane flying
```

## 5. Abstraction

### Abstract Classes in JavaScript
```javascript
class AbstractRepository {
    constructor() {
        if (new.target === AbstractRepository) {
            throw new Error("Cannot instantiate abstract class");
        }
    }
    
    // Abstract method
    save(entity) {
        throw new Error("Method 'save' must be implemented");
    }
    
    // Concrete method
    validate(entity) {
        return entity && typeof entity === 'object';
    }
}

class UserRepository extends AbstractRepository {
    save(user) {
        // Specific implementation
        console.log(`Saving user: ${user.name}`);
    }
}
```

### Interfaces Using JavaScript
```javascript
// Interface-like pattern using mixins
const Flyable = {
    fly() {
        throw new Error("fly() method must be implemented");
    }
};

const Swimmable = {
    swim() {
        throw new Error("swim() method must be implemented");
    }
};

class Duck {
    constructor(name) {
        this.name = name;
        // Mix in interfaces
        Object.assign(this, Flyable, Swimmable);
    }
    
    fly() {
        console.log(`${this.name} is flying`);
    }
    
    swim() {
        console.log(`${this.name} is swimming`);
    }
}
```

## 6. Design Patterns Common in JavaScript

### Singleton Pattern
```javascript
class DatabaseConnection {
    constructor() {
        if (DatabaseConnection.instance) {
            return DatabaseConnection.instance;
        }
        
        this.connection = null;
        DatabaseConnection.instance = this;
    }
    
    connect() {
        if (!this.connection) {
            this.connection = "Database connected";
        }
        return this.connection;
    }
}

// Usage
const db1 = new DatabaseConnection();
const db2 = new DatabaseConnection();
console.log(db1 === db2); // true
```

### Factory Pattern
```javascript
class ShapeFactory {
    static createShape(type, ...args) {
        switch(type) {
            case 'circle':
                return new Circle(...args);
            case 'rectangle':
                return new Rectangle(...args);
            default:
                throw new Error(`Unknown shape type: ${type}`);
        }
    }
}

const circle = ShapeFactory.createShape('circle', 5);
const rectangle = ShapeFactory.createShape('rectangle', 4, 6);
```

### Observer Pattern
```javascript
class Subject {
    constructor() {
        this.observers = [];
    }
    
    addObserver(observer) {
        this.observers.push(observer);
    }
    
    removeObserver(observer) {
        this.observers = this.observers.filter(obs => obs !== observer);
    }
    
    notifyObservers(data) {
        this.observers.forEach(observer => observer.update(data));
    }
}

class Observer {
    update(data) {
        console.log(`Observer received: ${data}`);
    }
}
```

## 7. Key JavaScript-Specific Concepts

### Prototypes and Prototype Chain
```javascript
function Person(name) {
    this.name = name;
}

Person.prototype.greet = function() {
    return `Hello, I'm ${this.name}`;
};

const john = new Person("John");
console.log(john.greet()); // Hello, I'm John

// Prototype chain
console.log(john.__proto__ === Person.prototype); // true
console.log(Person.prototype.__proto__ === Object.prototype); // true
```

### this Binding
```javascript
class Calculator {
    constructor(value = 0) {
        this.value = value;
    }
    
    add(num) {
        this.value += num;
        return this; // Method chaining
    }
    
    multiply(num) {
        this.value *= num;
        return this;
    }
    
    getValue() {
        return this.value;
    }
}

// Method chaining
const result = new Calculator(5)
    .add(3)
    .multiply(2)
    .getValue(); // 16
```

## 8. Interview Questions & Answers

### Q1: What is the difference between classical inheritance and prototypal inheritance?

**Answer:** Classical inheritance (Java) uses classes as blueprints to create objects with predefined structure. Prototypal inheritance (JavaScript) allows objects to inherit directly from other objects through the prototype chain. JavaScript objects can be extended at runtime, while Java classes are fixed at compile time.

### Q2: How do you implement private variables in JavaScript?

**Answer:** Multiple approaches:
1. **Private fields (ES2022)**: Use `#` prefix
2. **Closures**: Variables in outer function scope
3. **Symbols**: Create unique property keys
4. **WeakMap**: Store private data externally

### Q3: Explain the prototype chain

**Answer:** Every JavaScript object has a prototype (except `Object.prototype`). When accessing a property, JavaScript first checks the object itself, then its prototype, then the prototype's prototype, until it reaches `Object.prototype` or finds the property. This chain enables inheritance.

### Q4: What is method chaining and how do you implement it?

**Answer:** Method chaining allows calling multiple methods on the same object in sequence. Implement by returning `this` from each method.

## 9. Modern JavaScript Features for OOP

### Getters and Setters
```javascript
class Temperature {
    constructor(celsius = 0) {
        this._celsius = celsius;
    }
    
    get fahrenheit() {
        return (this._celsius * 9/5) + 32;
    }
    
    set fahrenheit(value) {
        this._celsius = (value - 32) * 5/9;
    }
    
    get celsius() {
        return this._celsius;
    }
    
    set celsius(value) {
        this._celsius = value;
    }
}
```

### Mixins
```javascript
const Timestamp = {
    setTimestamp() {
        this.timestamp = Date.now();
    }
};

const Loggable = {
    log(message) {
        console.log(`[${this.constructor.name}] ${message}`);
    }
};

class User {
    constructor(name) {
        this.name = name;
    }
}

// Apply mixins
Object.assign(User.prototype, Timestamp, Loggable);
```

This guide bridges your Java Spring Boot knowledge with JavaScript OOP concepts. Focus on understanding the prototype chain, different ways to create objects, and how JavaScript's dynamic nature provides flexibility that Java's static typing doesn't offer.