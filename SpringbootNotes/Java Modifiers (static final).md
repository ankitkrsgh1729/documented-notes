# Java Keywords & Modifiers - Complete Interview Guide

## 📋 Quick Reference Table

| Modifier | Purpose | Where Used | Example |
|----------|---------|------------|---------|
| `public` | Accessible everywhere | Classes, methods, fields | `public class User` |
| `private` | Accessible only within same class | Methods, fields | `private String password` |
| `protected` | Accessible within package + subclasses | Methods, fields | `protected void validate()` |
| `static` | Belongs to class, not instance | Methods, fields, blocks | `static final String CONSTANT` |
| `final` | Cannot be changed/overridden | Classes, methods, fields | `final class String` |
| `abstract` | Must be implemented by subclass | Classes, methods | `abstract class Animal` |
| `interface` | Contract definition | Type definition | `interface PaymentService` |
| `implements` | Implements interface contract | Class declaration | `class User implements Serializable` |
| `extends` | Inherits from parent class | Class declaration | `class Dog extends Animal` |

---

## 🔐 Access Modifiers

### 1. `public` - Open to Everyone

```java
public class User {
    public String name;           // Anyone can access
    public String getName() {     // Anyone can call
        return name;
    }
}

// Usage from anywhere
User user = new User();
user.name = "John";              // ✅ Allowed
String name = user.getName();    // ✅ Allowed
```

**When to use:**
- ✅ Public APIs that other classes need to access
- ✅ Main methods: `public static void main(String[] args)`
- ✅ Public service methods in Spring: `@RestController` methods
- ✅ Constants meant to be shared: `public static final String API_VERSION`

### 2. `private` - Class Secrets Only

```java
public class BankAccount {
    private double balance;           // Only this class can access
    private String accountNumber;     // Hidden from outside
    
    // Private helper method
    private boolean isValidAmount(double amount) {
        return amount > 0;
    }
    
    // Public interface to interact with private data
    public void deposit(double amount) {
        if (isValidAmount(amount)) {    // ✅ Can call private method
            balance += amount;          // ✅ Can access private field
        }
    }
    
    public double getBalance() {
        return balance;                 // Controlled access to private data
    }
}

// Usage
BankAccount account = new BankAccount();
account.deposit(100);                   // ✅ Allowed
double balance = account.getBalance();  // ✅ Allowed

// account.balance = 1000000;           // ❌ Compile error - private field
// account.isValidAmount(50);           // ❌ Compile error - private method
```

**When to use:**
- ✅ Internal implementation details
- ✅ Helper methods that shouldn't be called from outside
- ✅ Fields that need controlled access (encapsulation)
- ✅ Sensitive data like passwords, tokens

### 3. `protected` - Family + Friends Access

```java
// Parent class
public class Animal {
    protected String species;          // Subclasses can access
    protected void makeSound() {       // Subclasses can override
        System.out.println("Some sound");
    }
    
    private String internalId;         // Only Animal class can access
}

// Subclass
public class Dog extends Animal {
    public void bark() {
        species = "Canine";            // ✅ Can access protected field
        makeSound();                   // ✅ Can call protected method
        // internalId = "123";         // ❌ Can't access private field
    }
}

// Same package class
class AnimalCaretaker {
    public void careFor(Animal animal) {
        animal.species = "Unknown";    // ✅ Can access (same package)
        animal.makeSound();           // ✅ Can call (same package)
    }
}

// Different package
// package com.other;
class Veterinarian {
    public void examine(Animal animal) {
        // animal.species = "Unknown";  // ❌ Can't access (different package)
        // animal.makeSound();          // ❌ Can't call (different package)
    }
}
```

**When to use:**
- ✅ Methods meant to be overridden by subclasses
- ✅ Fields that subclasses need to access
- ✅ Template method pattern implementations
- ✅ Framework extension points

### 4. Package-Private (No modifier) - Package Friends Only

```java
// No access modifier = package-private
class DatabaseConfig {               // Only classes in same package can use
    String connectionUrl;            // Only same package can access
    
    void connect() {                 // Only same package can call
        System.out.println("Connecting...");
    }
}

// Same package - can access
class DatabaseService {
    public void initialize() {
        DatabaseConfig config = new DatabaseConfig();  // ✅ Allowed
        config.connectionUrl = "jdbc:mysql://...";     // ✅ Allowed
        config.connect();                              // ✅ Allowed
    }
}
```

---

## ⚡ Static Modifier - Belongs to Class, Not Instance

### Understanding Static

```java
public class Counter {
    private static int totalCount = 0;    // Shared by ALL instances
    private int instanceCount = 0;        // Each instance has its own
    
    public Counter() {
        totalCount++;                     // Increment shared counter
        instanceCount++;                  // Increment instance counter
    }
    
    // Static method - belongs to class
    public static int getTotalCount() {
        return totalCount;                // ✅ Can access static fields
        // return instanceCount;          // ❌ Can't access instance fields
    }
    
    // Instance method - belongs to object
    public int getInstanceCount() {
        return instanceCount;             // ✅ Can access instance fields
        return totalCount;                // ✅ Can also access static fields
    }
}

// Usage
Counter c1 = new Counter();
Counter c2 = new Counter();
Counter c3 = new Counter();

System.out.println(Counter.getTotalCount());  // 3 (shared count)
System.out.println(c1.getInstanceCount());    // 1 (each instance is 1)
System.out.println(c2.getInstanceCount());    // 1
System.out.println(c3.getInstanceCount());    // 1
```

### Static in Real Applications

#### Utility Classes
```java
public class StringUtils {
    // Static utility method - no instance needed
    public static boolean isEmpty(String str) {
        return str == null || str.trim().isEmpty();
    }
    
    public static String capitalize(String str) {
        if (isEmpty(str)) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }
}

// Usage - no object creation needed
if (StringUtils.isEmpty(userInput)) {
    // handle empty input
}
```

#### Constants
```java
public class ApiConstants {
    public static final String BASE_URL = "https://api.example.com";
    public static final int TIMEOUT_SECONDS = 30;
    public static final List<String> SUPPORTED_FORMATS = 
        Collections.unmodifiableList(Arrays.asList("JSON", "XML"));
}

// Usage
String url = ApiConstants.BASE_URL + "/users";
```

#### Static Blocks - Initialization
```java
public class DatabaseDriver {
    private static Connection connection;
    
    // Static block - runs once when class is loaded
    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            connection = DriverManager.getConnection("jdbc:mysql://...");
            System.out.println("Database connection initialized");
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize database", e);
        }
    }
    
    public static Connection getConnection() {
        return connection;
    }
}
```

**When to use static:**
- ✅ Utility methods that don't need object state
- ✅ Constants that should be shared
- ✅ Factory methods
- ✅ Main method
- ❌ When you need different behavior per instance
- ❌ When you need to override the method (static methods can't be overridden)

---

## 🔒 Final Modifier - No Changes Allowed

### Final Variables - Constants

```java
public class User {
    private final String id;              // Must be initialized
    private final List<String> roles;     // Reference is final, not content
    
    public User(String id) {
        this.id = id;                     // ✅ Can initialize in constructor
        this.roles = new ArrayList<>();   // ✅ Initialize final field
    }
    
    public void addRole(String role) {
        roles.add(role);                  // ✅ Can modify content
        // roles = new ArrayList<>();     // ❌ Can't reassign final field
        // id = "new-id";                 // ❌ Can't reassign final field
    }
}
```

### Final Methods - Cannot Be Overridden

```java
public class Animal {
    // Final method - subclasses cannot override
    public final void breathe() {
        System.out.println("Inhale... Exhale...");
    }
    
    // Regular method - can be overridden
    public void makeSound() {
        System.out.println("Generic animal sound");
    }
}

public class Dog extends Animal {
    // ❌ Cannot override final method
    // public void breathe() { }  // Compile error
    
    // ✅ Can override regular method
    @Override
    public void makeSound() {
        System.out.println("Woof!");
    }
}
```

### Final Classes - Cannot Be Extended

```java
// Final class - cannot be subclassed
public final class ImmutableUser {
    private final String name;
    private final String email;
    
    public ImmutableUser(String name, String email) {
        this.name = name;
        this.email = email;
    }
    
    public String getName() { return name; }
    public String getEmail() { return email; }
}

// ❌ Cannot extend final class
// public class ExtendedUser extends ImmutableUser { }  // Compile error
```

**Real-world final classes:**
- `String` - Immutable and final
- `Integer`, `Double` - Wrapper classes are final
- `UUID` - Immutable identifier class

---

## 🎭 Interface - Contracts and Behavior

### Basic Interface Definition

```java
public interface PaymentService {
    // All methods are implicitly public abstract
    void processPayment(Payment payment);
    boolean refund(String transactionId);
    PaymentStatus getStatus(String transactionId);
    
    // Constants are implicitly public static final
    String API_VERSION = "v1.0";
    int MAX_RETRY_ATTEMPTS = 3;
    
    // Default methods (Java 8+) - provide default implementation
    default void logTransaction(String transactionId) {
        System.out.println("Transaction logged: " + transactionId);
    }
    
    // Static methods (Java 8+) - utility methods
    static boolean isValidAmount(double amount) {
        return amount > 0;
    }
}
```

### Multiple Interface Implementation

```java
public interface Drawable {
    void draw();
}

public interface Clickable {
    void onClick();
    default void onDoubleClick() {
        System.out.println("Double clicked");
    }
}

// Class implementing multiple interfaces
public class Button implements Drawable, Clickable {
    
    @Override
    public void draw() {
        System.out.println("Drawing button");
    }
    
    @Override
    public void onClick() {
        System.out.println("Button clicked");
    }
    
    // Can optionally override default method
    @Override
    public void onDoubleClick() {
        System.out.println("Button double clicked");
    }
}
```

### Interface Inheritance

```java
public interface Vehicle {
    void start();
    void stop();
}

public interface Car extends Vehicle {
    void openTrunk();
    int getNumberOfDoors();
}

public interface ElectricCar extends Car {
    void charge();
    int getBatteryLevel();
}

// Must implement all interface methods
public class Tesla implements ElectricCar {
    @Override
    public void start() { /* implementation */ }
    
    @Override
    public void stop() { /* implementation */ }
    
    @Override
    public void openTrunk() { /* implementation */ }
    
    @Override
    public int getNumberOfDoors() { return 4; }
    
    @Override
    public void charge() { /* implementation */ }
    
    @Override
    public int getBatteryLevel() { return 85; }
}
```

---

## 🔗 Extends - Inheritance Hierarchy

### Class Inheritance

```java
// Base class
public class Animal {
    protected String name;
    protected int age;
    
    public Animal(String name, int age) {
        this.name = name;
        this.age = age;
    }
    
    public void eat() {
        System.out.println(name + " is eating");
    }
    
    public void sleep() {
        System.out.println(name + " is sleeping");
    }
    
    // Virtual method - can be overridden
    public void makeSound() {
        System.out.println(name + " makes a sound");
    }
}

// Derived class
public class Dog extends Animal {
    private String breed;
    
    public Dog(String name, int age, String breed) {
        super(name, age);           // Call parent constructor
        this.breed = breed;
    }
    
    // Override parent method
    @Override
    public void makeSound() {
        System.out.println(name + " barks: Woof!");
    }
    
    // Add new behavior
    public void wagTail() {
        System.out.println(name + " is wagging tail");
    }
    
    // Method overloading (different parameters)
    public void eat(String food) {
        System.out.println(name + " is eating " + food);
    }
}
```

### Method Overriding Rules

```java
public class Parent {
    // Protected method in parent
    protected void display() {
        System.out.println("Parent display");
    }
    
    // Private method - not inherited
    private void helper() {
        System.out.println("Parent helper");
    }
    
    // Final method - cannot be overridden
    public final void finalMethod() {
        System.out.println("Cannot override this");
    }
}

public class Child extends Parent {
    // ✅ Can override with same or more accessible modifier
    @Override
    public void display() {          // protected -> public (OK)
        super.display();             // Call parent implementation
        System.out.println("Child display");
    }
    
    // ✅ Can have same method name (not overriding, new method)
    private void helper() {
        System.out.println("Child helper");
    }
    
    // ❌ Cannot override final method
    // public void finalMethod() { }  // Compile error
    
    // ❌ Cannot reduce accessibility
    // private void display() { }     // Compile error if trying to override
}
```

---

## 🏗️ Abstract - Template for Implementation

### Abstract Classes

```java
// Abstract class - cannot be instantiated
public abstract class Shape {
    protected String color;
    
    public Shape(String color) {
        this.color = color;
    }
    
    // Concrete method - all subclasses inherit
    public void setColor(String color) {
        this.color = color;
    }
    
    // Abstract method - subclasses MUST implement
    public abstract double calculateArea();
    public abstract void draw();
    
    // Template method pattern
    public final void display() {
        draw();                          // Call abstract method
        System.out.println("Area: " + calculateArea());
        System.out.println("Color: " + color);
    }
}

// Concrete implementation
public class Circle extends Shape {
    private double radius;
    
    public Circle(String color, double radius) {
        super(color);                    // Call parent constructor
        this.radius = radius;
    }
    
    @Override
    public double calculateArea() {
        return Math.PI * radius * radius;
    }
    
    @Override
    public void draw() {
        System.out.println("Drawing a circle");
    }
}

// Usage
// Shape shape = new Shape("red");      // ❌ Cannot instantiate abstract class
Shape circle = new Circle("red", 5.0);  // ✅ Can instantiate concrete subclass
circle.display();                       // Uses template method
```

---

## 🔄 Interface vs Abstract Class vs Concrete Class

| Feature | Interface | Abstract Class | Concrete Class |
|---------|-----------|----------------|----------------|
| **Instantiation** | ❌ Cannot instantiate | ❌ Cannot instantiate | ✅ Can instantiate |
| **Method implementation** | Default methods only (Java 8+) | Can have both abstract and concrete | All methods implemented |
| **Multiple inheritance** | ✅ Can implement multiple | ❌ Single inheritance only | ❌ Single inheritance only |
| **Constructors** | ❌ No constructors | ✅ Can have constructors | ✅ Can have constructors |
| **Fields** | Only constants (static final) | Any type of fields | Any type of fields |
| **Access modifiers** | Methods are public | Any access modifier | Any access modifier |
| **When to use** | Define contract/behavior | Partial implementation + template | Complete implementation |

### Choosing the Right Approach

```java
// Use Interface when: Defining a contract
public interface PaymentProcessor {
    PaymentResult process(Payment payment);
    void refund(String transactionId);
}

// Use Abstract Class when: Sharing common code + defining template
public abstract class BasePaymentProcessor implements PaymentProcessor {
    protected Logger logger = LoggerFactory.getLogger(getClass());
    
    // Template method
    public final PaymentResult process(Payment payment) {
        logger.info("Processing payment: " + payment.getId());
        validatePayment(payment);            // Common validation
        PaymentResult result = doProcess(payment);  // Abstract - subclass implements
        logger.info("Payment processed: " + result.getStatus());
        return result;
    }
    
    protected void validatePayment(Payment payment) {
        if (payment.getAmount() <= 0) {
            throw new IllegalArgumentException("Invalid amount");
        }
    }
    
    // Abstract method - each processor implements differently
    protected abstract PaymentResult doProcess(Payment payment);
}

// Use Concrete Class when: Complete implementation
public class StripePaymentProcessor extends BasePaymentProcessor {
    @Override
    protected PaymentResult doProcess(Payment payment) {
        // Stripe-specific implementation
        return stripeClient.charge(payment);
    }
    
    @Override
    public void refund(String transactionId) {
        // Stripe-specific refund
        stripeClient.refund(transactionId);
    }
}
```

---

## 🎯 Real-World Spring Examples

### Spring Service with All Concepts

```java
// Interface defining service contract
public interface UserService {
    User createUser(User user);
    User findById(Long id);
    List<User> findAll();
    void deleteUser(Long id);
}

// Abstract base class with common functionality
public abstract class BaseService<T, ID> {
    protected final Logger logger = LoggerFactory.getLogger(getClass());
    
    // Template method
    public final T save(T entity) {
        logger.info("Saving entity: " + entity);
        validate(entity);                    // Common validation
        T saved = doSave(entity);           // Abstract - subclass implements
        logger.info("Entity saved: " + saved);
        return saved;
    }
    
    protected abstract void validate(T entity);
    protected abstract T doSave(T entity);
}

// Concrete implementation
@Service
@Transactional
public class UserServiceImpl extends BaseService<User, Long> implements UserService {
    
    private final UserRepository userRepository;
    private static final int MAX_USERS = 10000;        // Static constant
    
    // Constructor injection (final fields)
    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @Override
    public User createUser(User user) {
        return save(user);                   // Uses template method from parent
    }
    
    @Override
    protected void validate(User user) {     // Implement abstract method
        if (user.getEmail() == null) {
            throw new IllegalArgumentException("Email is required");
        }
    }
    
    @Override
    protected User doSave(User user) {       // Implement abstract method
        return userRepository.save(user);
    }
    
    @Override
    public User findById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found: " + id));
    }
    
    @Override
    public List<User> findAll() {
        return userRepository.findAll();
    }
    
    @Override
    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }
    
    // Private helper method
    private boolean isValidEmail(String email) {
        return email != null && email.contains("@");
    }
    
    // Static utility method
    public static boolean isSystemUser(User user) {
        return "system".equals(user.getUsername());
    }
}
```

## 🚗 Composition vs Inheritance, Scenario: Vehicle System (Car, ElectricCar, Bicycle)

---

## ❌ BAD: Inheritance Approach

```java
// All vehicles forced to inherit ALL methods
public class Vehicle {
    public void start() { System.out.println("Engine started"); }
    public void refuel() { System.out.println("Refueled"); }
    public void charge() { throw new UnsupportedOperationException("Can't charge!"); }
    public void pedal() { throw new UnsupportedOperationException("Can't pedal!"); }
}

public class Car extends Vehicle {
    // Inherits: start() ✅, refuel() ✅, charge() ❌, pedal() ❌
}

public class ElectricCar extends Vehicle {
    @Override
    public void charge() { System.out.println("Charging..."); }
    @Override
    public void refuel() { throw new UnsupportedOperationException("Electric cars don't use fuel!"); }
    // Inherits: start() ✅, charge() ✅, refuel() ❌, pedal() ❌
}

public class Bicycle extends Vehicle {
    @Override
    public void pedal() { System.out.println("Pedaling..."); }
    @Override
    public void start() { throw new UnsupportedOperationException("No engine!"); }
    // Inherits: pedal() ✅, start() ❌, refuel() ❌, charge() ❌
}
```

### Problem: Runtime Exceptions
```java
Car car = new Car();
ElectricCar tesla = new ElectricCar();
Bicycle bike = new Bicycle();

// These compile but crash at runtime! 💥
car.charge();       // RuntimeException: "Can't charge!"
tesla.refuel();     // RuntimeException: "Electric cars don't use fuel!"
bike.start();       // RuntimeException: "No engine!"
```

---

## ✅ GOOD: Composition Approach

```java
// Separate interfaces for different capabilities
public interface Startable { void start(); }
public interface Refuelable { void refuel(); }
public interface Chargeable { void charge(); }
public interface Pedalable { void pedal(); }

// Each vehicle only implements what it CAN do
public class Car implements Startable, Refuelable {
    @Override public void start() { System.out.println("Engine started"); }
    @Override public void refuel() { System.out.println("Refueled"); }
    // No charge() or pedal() methods - doesn't implement those interfaces
}

public class ElectricCar implements Startable, Chargeable {
    @Override public void start() { System.out.println("Engine started"); }
    @Override public void charge() { System.out.println("Charging..."); }
    // No refuel() or pedal() methods - doesn't implement those interfaces
}

public class Bicycle implements Pedalable {
    @Override public void pedal() { System.out.println("Pedaling..."); }
    // No start(), refuel(), or charge() methods - doesn't implement those interfaces
}

// Easy to create hybrid vehicles
public class HybridCar implements Startable, Refuelable, Chargeable {
    @Override public void start() { System.out.println("Engine started"); }
    @Override public void refuel() { System.out.println("Refueled"); }
    @Override public void charge() { System.out.println("Charging..."); }
}
```

### Solution: Compile-Time Safety
```java
Car car = new Car();
ElectricCar tesla = new ElectricCar();
Bicycle bike = new Bicycle();

// These work perfectly
car.start();        // ✅ Works
tesla.charge();     // ✅ Works
bike.pedal();       // ✅ Works

// These won't even compile! 🎉
// car.charge();    // ❌ Compile error - method doesn't exist
// tesla.refuel();  // ❌ Compile error - method doesn't exist
// bike.start();    // ❌ Compile error - method doesn't exist
```

---

## 📊 Key Differences

| Aspect | Inheritance | Composition |
|--------|-------------|-------------|
| **Safety** | ❌ Runtime exceptions | ✅ Compile-time errors |
| **Relevant methods** | ❌ Inherits irrelevant methods | ✅ Only has relevant methods |
| **Extensibility** | ❌ Hard to add new combinations | ✅ Easy to mix behaviors |
| **Code** | `bike.refuel()` compiles but crashes | `bike.refuel()` won't compile |

---

## 💡 Rule of Thumb

**Inheritance (IS-A):** Use when subclass IS truly A specialized version of parent
- ✅ `Dog extends Animal` - Dog IS-A Animal
- ❌ `Robot extends Employee` - Robot IS-NOT Employee

**Composition (HAS-A/CAN-DO):** Use when object HAS capabilities or CAN-DO actions
- ✅ `Car implements Startable` - Car CAN-DO starting
- ✅ `ElectricCar implements Chargeable` - ElectricCar CAN-DO charging

**Bottom Line:** Favor composition over inheritance for safer, more flexible code.



---

## 🎯 Interview Questions & Best Practices

### Common Interview Questions

**Q1: "Can a static method be overridden?"**
**Answer:** No, static methods belong to the class, not the instance. They can be hidden (not overridden) in subclasses.

```java
class Parent {
    static void display() { System.out.println("Parent"); }
}
class Child extends Parent {
    static void display() { System.out.println("Child"); }  // This hides, not overrides
}

Parent p = new Child();
p.display();           // Prints "Parent" - calls based on reference type
Child.display();       // Prints "Child"
```

**Q2: "What's the difference between final, finally, and finalize?"**
**Answer:** 
- `final`: Keyword for constants, preventing override/extension
- `finally`: Block that always executes after try-catch
- `finalize()`: Method called by garbage collector (deprecated)

**Q3: "Can an interface extend another interface?"**
**Answer:** Yes, interfaces can extend multiple interfaces using `extends`.

**Q4: "Why use composition over inheritance?"**
**Answer:** Composition is more flexible, avoids tight coupling, and follows "has-a" rather than "is-a" relationship.

### Best Practices

**✅ DO:**
- Use `private` for internal implementation details
- Use `final` for constants and immutable classes
- Use interfaces to define contracts
- Use `static` for utility methods that don't need instance state
- Use composition when possible instead of inheritance

**❌ DON'T:**
- Make fields public unless they're constants
- Use inheritance just for code reuse (prefer composition)
- Create deep inheritance hierarchies
- Use static for methods that need different behavior per instance

---

## 💡 Key Takeaways for Interviews

1. **Encapsulation**: Use `private` fields with `public` getters/setters
2. **Inheritance**: Use `extends` for "is-a" relationships, `implements` for contracts
3. **Polymorphism**: Interfaces enable multiple implementations
4. **Static**: Belongs to class, shared across all instances
5. **Final**: Prevents modification/overriding, use for constants and immutable classes
6. **Abstract**: Use when you want to share code but force implementation of certain methods

Remember: These modifiers work together to create clean, maintainable, and secure code!