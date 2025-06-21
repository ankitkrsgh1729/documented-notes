# Utility Class Approaches: Lombok @UtilityClass vs Regular Class vs Spring @Component

## 📋 Quick Comparison Table

| Feature                  | Regular Class                | Lombok @UtilityClass      | Spring @Component                      |
|--------------------------|------------------------------|---------------------------|----------------------------------------|
| **Constructor**          | Manual private constructor   | Auto private constructor  | Public constructor (Spring needs it)   |
| **Method type**          | Must remember `static`       | Auto static               | Instance methods                       |
| **Class modifier**       | Must remember `final`        | Auto final                | Regular class                          |
| **Instantiation**        | Can prevent manually         | Automatically prevented   | Spring creates instance                |
| **Usage**                | Static method calls          | Static method calls       | Instance method calls via DI           |
| **Dependency Injection** | ❌ Not supported              | ❌ Not supported           | ✅ Supports @Autowired                  |
| **State**                | ❌ Stateless only             | ❌ Stateless only          | ✅ Can have state                       |
| **Spring managed**       | ❌ No                         | ❌ No                      | ✅ Yes                                  |
| **Memory**               | No instance created          | No instance created       | Single instance (singleton)            |

---

## 1️⃣ Regular Utility Class (Manual Approach)

### ✅ Correct Implementation
```java
public final class StringUtils {
    
    // Private constructor prevents instantiation
    private StringUtils() {
        throw new UnsupportedOperationException("Utility class");
    }
    
    public static String capitalize(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        return input.substring(0, 1).toUpperCase() + input.substring(1).toLowerCase();
    }
    
    public static boolean isEmpty(String input) {
        return input == null || input.trim().isEmpty();
    }
    
    public static String reverse(String input) {
        if (input == null) {
            return null;
        }
        return new StringBuilder(input).reverse().toString();
    }
}
```

### 🔴 Common Mistakes
```java
// ❌ BAD: No private constructor
public class StringUtils {
    public static String capitalize(String input) {
        return input.substring(0, 1).toUpperCase() + input.substring(1);
    }
}

// ❌ BAD: Forgot 'static' keyword
public final class StringUtils {
    private StringUtils() {}
    
    public String capitalize(String input) { // Missing 'static'
        return input.substring(0, 1).toUpperCase() + input.substring(1);
    }
}

// ❌ BAD: Not final, can be extended
public class StringUtils {
    private StringUtils() {}
    
    public static String capitalize(String input) {
        return input.substring(0, 1).toUpperCase() + input.substring(1);
    }
}
```

### 📝 Usage
```java
@Service
public class UserService {
    
    public void processUser(User user) {
        // Static method calls
        String name = StringUtils.capitalize(user.getName());
        
        if (!StringUtils.isEmpty(user.getEmail())) {
            // Process email
        }
    }
}

// ❌ This won't work (or will cause compile error if done correctly):
// StringUtils utils = new StringUtils();
```

---

## 2️⃣ Lombok @UtilityClass (Automatic Approach)

### ✅ Implementation
```java
import lombok.experimental.UtilityClass;

@UtilityClass
public class StringUtils {
    
    // Lombok automatically:
    // - Makes constructor private
    // - Makes class final
    // - Makes all methods static
    
    public String capitalize(String input) { // Lombok makes this static
        if (input == null || input.isEmpty()) {
            return input;
        }
        return input.substring(0, 1).toUpperCase() + input.substring(1).toLowerCase();
    }
    
    public boolean isEmpty(String input) { // Lombok makes this static
        return input == null || input.trim().isEmpty();
    }
    
    public String reverse(String input) { // Lombok makes this static
        if (input == null) {
            return null;
        }
        return new StringBuilder(input).reverse().toString();
    }
}
```

### 🔍 What Lombok Generates
```java
// This is what Lombok actually creates behind the scenes:
public final class StringUtils {
    
    private StringUtils() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }
    
    public static String capitalize(String input) { // Lombok added 'static'
        if (input == null || input.isEmpty()) {
            return input;
        }
        return input.substring(0, 1).toUpperCase() + input.substring(1).toLowerCase();
    }
    
    public static boolean isEmpty(String input) { // Lombok added 'static'
        return input == null || input.trim().isEmpty();
    }
    
    public static String reverse(String input) { // Lombok added 'static'
        if (input == null) {
            return null;
        }
        return new StringBuilder(input).reverse().toString();
    }
}
```

### 📝 Usage
```java
@Service
public class UserService {
    
    public void processUser(User user) {
        // Static method calls (same as regular utility class)
        String name = StringUtils.capitalize(user.getName());
        
        if (!StringUtils.isEmpty(user.getEmail())) {
            // Process email
        }
    }
}

// ❌ Compile error - Lombok prevents instantiation:
// StringUtils utils = new StringUtils(); // ERROR!
```

---

## 3️⃣ Spring @Component (Dependency Injection Approach)

### ✅ Implementation
```java
@Component
public class StringUtils {
    
    // Instance methods (not static)
    public String capitalize(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        return input.substring(0, 1).toUpperCase() + input.substring(1).toLowerCase();
    }
    
    public boolean isEmpty(String input) {
        return input == null || input.trim().isEmpty();
    }
    
    public String reverse(String input) {
        if (input == null) {
            return null;
        }
        return new StringBuilder(input).reverse().toString();
    }
    
    // Can have dependencies injected
    @Autowired
    private MessageSource messageSource;
    
    public String getLocalizedMessage(String key) {
        return messageSource.getMessage(key, null, Locale.getDefault());
    }
    
    // Can have state (if needed)
    private int usageCount = 0;
    
    public int getUsageCount() {
        return ++usageCount;
    }
}
```

### 📝 Usage
```java
@Service
public class UserService {
    
    // Dependency injection
    @Autowired
    private StringUtils stringUtils;
    
    public void processUser(User user) {
        // Instance method calls
        String name = stringUtils.capitalize(user.getName());
        
        if (!stringUtils.isEmpty(user.getEmail())) {
            // Process email
        }
        
        // Can use injected dependencies
        String message = stringUtils.getLocalizedMessage("welcome.message");
        
        // Can access state
        int count = stringUtils.getUsageCount();
    }
}
```


---

## 🤔 When to Use Each Approach?

### Use Regular Utility Class When:
- ✅ Working in legacy projects without Lombok
- ✅ You want full control over implementation
- ✅ Team doesn't use Lombok
- ✅ Simple utility functions with no dependencies

### Use Lombok @UtilityClass When:
- ✅ Project uses Lombok
- ✅ You want boilerplate-free utility classes
- ✅ Compile-time safety is important
- ✅ Pure utility functions with no dependencies
- ✅ You want to prevent common mistakes

### Use Spring @Component When:
- ✅ You need dependency injection
- ✅ You need access to Spring configuration properties
- ✅ You need to maintain state across calls
- ✅ You want Spring to manage the lifecycle
- ✅ You need to mock the utility for testing

---

## ⚠️ Common Pitfalls

### With Regular Utility Classes:
```java
// ❌ DON'T DO THIS
public class BadUtils {
    // Missing private constructor - can be instantiated
    // Missing final - can be extended
    // Missing static - wrong usage pattern
    
    public String process(String input) { // Should be static
        return input.toUpperCase();
    }
}
```

### With @UtilityClass:
```java
// ❌ DON'T DO THIS
@UtilityClass
public class BadUtils {
    
    @Autowired
    private SomeService service; // Won't work - no DI in utility classes
    
    public String process(String input) {
        return service.process(input); // NullPointerException!
    }
}
```

### With @Component:
```java
// ❌ DON'T DO THIS
@Component
public class BadUtils {
    
    // Static methods in @Component don't get DI
    @Autowired
    private static SomeService service; // Won't work!
    
    public static String process(String input) {
        return service.process(input); // NullPointerException!
    }
}
```

---

---

## 💡 Key Takeaways

1. **Lombok @UtilityClass** = Best for pure utility functions with zero boilerplate
2. **Regular utility class** = When you can't use Lombok or want full control  
3. **Spring @Component** = When you need dependency injection or Spring features

Choose based on your needs:
- **No dependencies needed** → @UtilityClass or regular utility class
- **Need Spring features** → @Component
- **Want zero boilerplate** → @UtilityClass (if Lombok available)

Remember: **Don't use @Component just because you can - use it when you actually need Spring features!**