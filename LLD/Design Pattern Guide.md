# 🚀 Design Patterns: Your Secret Weapons for Backend Mastery

*Making design patterns as addictive as your favorite Netflix series!*

## 🎯 The Cheat Sheet: When Your Code Needs a Hero

| Pattern | Real-Life Analogy | When Your Code Is Crying For Help |
|---------|-------------------|-----------------------------------|
| **Singleton** 🏆 | There's only one President | "I need exactly ONE database connection manager!" |
| **Factory Method** 🏭 | Pizza shop that makes different pizzas | "I need objects, but I don't know which type until runtime!" |
| **Abstract Factory** 🏬 | IKEA (everything matches the theme) | "I need FAMILIES of objects that work together!" |
| **Builder** 🧱 | Subway sandwich maker | "This object has WAY too many parameters!" |
| **Adapter** 🔌 | Universal charging adapter | "These two systems speak different languages!" |
| **Facade** 🎭 | TV remote (hides complex electronics) | "This subsystem is too complicated for my users!" |
| **Proxy** 🚪 | Bouncer at a club | "I need to control who gets in and when!" |
| **Observer** 📢 | YouTube notification system | "When X happens, everyone needs to know!" |
| **Strategy** ⚔️ | GPS route options (fastest, scenic, etc.) | "I have multiple ways to do this task!" |
| **State** 🎮 | Video game character states | "This object acts totally different based on its mood!" |
| **Iterator** 🚶‍♂️ | Walking through a museum | "I need to visit every item, one by one!" |
| **Template Method** 📝 | Recipe with customizable steps | "The process is the same, but the details change!" |

---

## 🎨 Creational Patterns: The Object Birth Control Department

### 1. Singleton 🏆 - "There Can Be Only One!"

**The Story**: Imagine you're running a company and you need exactly one CEO. You can't have 5 CEOs making different decisions, right? That's chaos! Singleton ensures you get exactly one instance, no more, no less.

**Real Talk**: Every Java backend developer has written a Logger. And guess what? You definitely don't want 47 different logger instances writing to the same file!

```java
public class AppLogger {
    private static volatile AppLogger instance;
    private PrintWriter writer;
    
    private AppLogger() {
        try {
            writer = new PrintWriter(new FileWriter("app.log", true));
        } catch (IOException e) {
            throw new RuntimeException("Logger initialization failed!", e);
        }
    }
    
    public static AppLogger getInstance() {
        if (instance == null) {
            synchronized (AppLogger.class) {
                if (instance == null) {
                    instance = new AppLogger();
                }
            }
        }
        return instance;
    }
    
    public void log(String message) {
        writer.println(new Date() + ": " + message);
        writer.flush();
    }
}

// Usage - No matter how many times you call this, you get the SAME logger
AppLogger logger1 = AppLogger.getInstance();
AppLogger logger2 = AppLogger.getInstance();
// logger1 == logger2 is TRUE! 🎉
```

**Why This Rocks**:
- No more "Oops, I created 1000 database connections" moments
- Everyone uses the same instance = consistency
- Memory efficient (one instance to rule them all!)

---

### 2. Factory Method 🏭 - "The Single-Product Specialist"

**The Story**: You walk into a pizza shop and say "One pizza, please!" You don't care if Tony or Maria makes it, you just want a pizza. Factory Method is like that - you ask for ONE type of object, and the factory figures out which specific implementation to give you.

**Key Implementation Insight**: Factory Method creates **ONE TYPE** of product using **inheritance**

```java
// ONE product type
interface PaymentProcessor {
    void processPayment(double amount);
    String getProviderName();
}

// Different implementations of that ONE type
class StripeProcessor implements PaymentProcessor {
    public void processPayment(double amount) {
        System.out.println("💳 Stripe: Processing $" + amount + " with 2.9% fee");
    }
    public String getProviderName() { return "Stripe"; }
}

class PayPalProcessor implements PaymentProcessor {
    public void processPayment(double amount) {
        System.out.println("🅿️ PayPal: Processing $" + amount + " with buyer protection");
    }
    public String getProviderName() { return "PayPal"; }
}

// Factory with ONE factory method for ONE product type
abstract class PaymentFactory {
    // SINGLE factory method - this is the key!
    public abstract PaymentProcessor createProcessor();
    
    public void handlePayment(double amount) {
        PaymentProcessor processor = createProcessor(); // Only creates PaymentProcessor
        processor.processPayment(amount);
    }
}

// Concrete factories - inheritance-based
class StripeFactory extends PaymentFactory {
    public PaymentProcessor createProcessor() {
        return new StripeProcessor();
    }
}

class PayPalFactory extends PaymentFactory {
    public PaymentProcessor createProcessor() {
        return new PayPalProcessor();
    }
}
```

---

### 3. Abstract Factory 🏬 - "The Multi-Product Family Creator"

**The Story**: You're designing a theme park. Everything in the Medieval section should look medieval (castles, knights, dragons), and everything in the Sci-Fi section should be futuristic (spaceships, robots, lasers). Abstract Factory ensures everything in one "family" matches perfectly.

**Key Implementation Difference**: Abstract Factory creates **MULTIPLE RELATED PRODUCTS** using **composition**

```java
// MULTIPLE product types (family members)
interface Button { void render(); }
interface Dialog { void show(); }
interface TextField { void display(); }

// Medieval family - all products match the theme
class MedievalButton implements Button {
    public void render() { System.out.println("🗡️ Medieval stone button"); }
}
class MedievalDialog implements Dialog {
    public void show() { System.out.println("🏰 Medieval castle dialog"); }
}
class MedievalTextField implements TextField {
    public void display() { System.out.println("📜 Medieval scroll text field"); }
}

// Sci-Fi family - all products match the theme
class SciFiButton implements Button {
    public void render() { System.out.println("🚀 Sci-Fi holographic button"); }
}
class SciFiDialog implements Dialog {
    public void show() { System.out.println("🛸 Sci-Fi futuristic dialog"); }
}
class SciFiTextField implements TextField {
    public void display() { System.out.println("💻 Sci-Fi neon text field"); }
}

// Factory with MULTIPLE factory methods for MULTIPLE products
interface ThemeFactory {
    Button createButton();     // Creates Button family member
    Dialog createDialog();     // Creates Dialog family member  
    TextField createTextField(); // Creates TextField family member
}

// Concrete factories - composition-based (has-a relationship)
class MedievalFactory implements ThemeFactory {
    public Button createButton() { return new MedievalButton(); }
    public Dialog createDialog() { return new MedievalDialog(); }
    public TextField createTextField() { return new MedievalTextField(); }
}

class SciFiFactory implements ThemeFactory {
    public Button createButton() { return new SciFiButton(); }
    public Dialog createDialog() { return new SciFiDialog(); }
    public TextField createTextField() { return new SciFiTextField(); }
}

// Client creates MULTIPLE related objects
class ThemedApp {
    private ThemeFactory factory;
    
    public ThemedApp(ThemeFactory factory) {
        this.factory = factory;
    }
    
    public void createUI() {
        // Creates family of related objects
        Button btn = factory.createButton();
        Dialog dlg = factory.createDialog();
        TextField txt = factory.createTextField();
        
        btn.render();
        dlg.show();
        txt.display();
    }
}
```

**💡 IMPLEMENTATION COMPARISON:**

| Aspect | Factory Method | Abstract Factory |
|--------|----------------|------------------|
| **Products Created** | ONE type | MULTIPLE related types |
| **Factory Methods** | ONE method | MULTIPLE methods |
| **Relationship** | Inheritance (is-a) | Composition (has-a) |
| **Purpose** | Choose implementation | Ensure consistency across family |
| **Example** | PaymentProcessor | Button + Dialog + TextField |

```java
// Factory Method: ONE product type
abstract class PaymentFactory {
    public abstract PaymentProcessor createProcessor(); // Single method
}

// Abstract Factory: MULTIPLE product types  
interface ThemeFactory {
    Button createButton();        // Multiple methods
    Dialog createDialog();        // for multiple 
    TextField createTextField();  // product types
}
```

---

### 4. Builder 🧱 - "The Subway Sandwich Artist"

**The Story**: Remember ordering at Subway? "I want a footlong, turkey, wheat bread, no cheese, extra pickles, mayo, toasted..." The sandwich artist builds your order step by step. That's Builder pattern - complex objects, built piece by piece, exactly how you want them.

**Why You'll Love This**: Ever seen a constructor with 12 parameters? 🤢 Builder pattern saves you from that nightmare!

```java
// The delicious result
public class DatabaseConfig {
    private final String host;
    private final int port;
    private final String database;
    private final String username;
    private final String password;
    private final int maxConnections;
    private final int timeout;
    private final boolean ssl;
    private final boolean autoCommit;
    
    // Private constructor - only builder can create this!
    private DatabaseConfig(ConfigBuilder builder) {
        this.host = builder.host;
        this.port = builder.port;
        this.database = builder.database;
        this.username = builder.username;
        this.password = builder.password;
        this.maxConnections = builder.maxConnections;
        this.timeout = builder.timeout;
        this.ssl = builder.ssl;
        this.autoCommit = builder.autoCommit;
    }
    
    // The sandwich artist
    public static class ConfigBuilder {
        private String host;
        private int port = 3306; // sensible defaults
        private String database;
        private String username;
        private String password;
        private int maxConnections = 10;
        private int timeout = 30;
        private boolean ssl = false;
        private boolean autoCommit = true;
        
        public ConfigBuilder(String host, String database) {
            this.host = host;
            this.database = database;
        }
        
        public ConfigBuilder port(int port) {
            this.port = port;
            return this; // The secret sauce - method chaining!
        }
        
        public ConfigBuilder credentials(String username, String password) {
            this.username = username;
            this.password = password;
            return this;
        }
        
        public ConfigBuilder maxConnections(int max) {
            this.maxConnections = max;
            return this;
        }
        
        public ConfigBuilder timeout(int seconds) {
            this.timeout = seconds;
            return this;
        }
        
        public ConfigBuilder enableSSL() {
            this.ssl = true;
            return this;
        }
        
        public ConfigBuilder disableAutoCommit() {
            this.autoCommit = false;
            return this;
        }
        
        public DatabaseConfig build() {
            return new DatabaseConfig(this);
        }
    }
    
    // Getters...
    public String getHost() { return host; }
    public int getPort() { return port; }
    // ... other getters
}

// Usage - Look how readable this is! 😍
DatabaseConfig config = new DatabaseConfig.ConfigBuilder("localhost", "myapp")
    .port(5432)
    .credentials("admin", "secret123")
    .maxConnections(50)
    .timeout(60)
    .enableSSL()
    .disableAutoCommit()
    .build();

// Compare this nightmare alternative:
// DatabaseConfig config = new DatabaseConfig("localhost", 5432, "myapp", "admin", 
//     "secret123", 50, 60, true, false); // What does true/false even mean?!
```

**Why This Is Awesome**:
- Self-documenting code (you can read what each parameter does!)
- Optional parameters with defaults
- Immutable objects (thread-safe by design)
- No more constructor parameter hell

---

## 🏗️ Structural Patterns: The Relationship Counselors

### 1. Adapter 🔌 - "The Universal Translator"

**The Story**: You're traveling to Japan with your American phone charger. The outlets are different! You need an adapter to make your charger work with Japanese outlets. Same idea in code - making incompatible things work together.

**The "Different Languages" Problem**: 
- Your code speaks: `findById(String id)` and `save(User user)`
- Third-party API speaks: `getUserData(String userId)` and `insertUser(UserData userData)`
- Different method names, different parameter types, different return types!

**The Drama**: Your startup just got acquired by MegaCorp. They use Oracle, you use PostgreSQL. Do you rewrite everything? Heck no! You build an adapter!

```java
// Your beautiful existing interface (Language A)
interface UserRepository {
    User findById(String id);
    void save(User user);
    List<User> findByEmail(String email);
}

// Your current implementation
class PostgreSQLUserRepository implements UserRepository {
    public User findById(String id) {
        System.out.println("🐘 PostgreSQL: SELECT * FROM users WHERE id = " + id);
        return new User(id, "John Doe", "john@example.com");
    }
    
    public void save(User user) {
        System.out.println("🐘 PostgreSQL: INSERT INTO users...");
    }
    
    public List<User> findByEmail(String email) {
        System.out.println("🐘 PostgreSQL: SELECT * FROM users WHERE email = " + email);
        return Arrays.asList(new User("1", "John", email));
    }
}

// MegaCorp's legacy system (Language B - you can't change this!)
class LegacyOracleDB {
    // Different method name, different parameter type!
    public UserData getUserData(String userId) {
        System.out.println("🏛️ Oracle: EXEC sp_get_user_by_id " + userId);
        return new UserData(userId, "Jane Smith", "jane@corp.com");
    }
    
    // Different method name, different parameter type!
    public void insertUser(UserData userData) {
        System.out.println("🏛️ Oracle: EXEC sp_insert_user_data");
    }
    
    // Completely different approach - uses SQL LIKE operator
    public List<UserData> searchUsersByEmailPattern(String emailPattern) {
        System.out.println("🏛️ Oracle: SELECT * FROM user_table WHERE email_address LIKE '" + emailPattern + "%'");
        return Arrays.asList(new UserData("2", "Jane", emailPattern));
    }
}

// Different data structures (incompatible!)
class User {
    private String id, name, email;
    public User(String id, String name, String email) { 
        this.id = id; this.name = name; this.email = email; 
    }
    // getters...
}

class UserData {
    private String userId, fullName, emailAddress; // Different field names!
    public UserData(String userId, String fullName, String emailAddress) { 
        this.userId = userId; this.fullName = fullName; this.emailAddress = emailAddress; 
    }
    // getters...
}

// THE MAGIC TRANSLATOR - makes Oracle speak PostgreSQL language!
class OracleUserRepositoryAdapter implements UserRepository {
    private LegacyOracleDB oracleDB;
    
    public OracleUserRepositoryAdapter(LegacyOracleDB oracleDB) {
        this.oracleDB = oracleDB;
    }
    
    public User findById(String id) {
        // Translate the call and convert the response!
        UserData oracleData = oracleDB.getUserData(id);
        return convertToUser(oracleData);
    }
    
    public void save(User user) {
        // Convert User to UserData format that Oracle expects
        UserData oracleData = convertToUserData(user);
        oracleDB.insertUser(oracleData);
    }
    
    public List<User> findByEmail(String email) {
        // Oracle uses LIKE search, we adapt it to exact match behavior
        List<UserData> oracleResults = oracleDB.searchUsersByEmailPattern(email);
        return oracleResults.stream()
                .map(this::convertToUser)
                .filter(user -> user.getEmail().equals(email)) // Filter to exact match
                .collect(Collectors.toList());
    }
    
    // Translation helpers
    private User convertToUser(UserData oracleData) {
        return new User(
            oracleData.getUserId(),        // userId -> id
            oracleData.getFullName(),      // fullName -> name  
            oracleData.getEmailAddress()   // emailAddress -> email
        );
    }
    
    private UserData convertToUserData(User user) {
        return new UserData(
            user.getId(),     // id -> userId
            user.getName(),   // name -> fullName
            user.getEmail()   // email -> emailAddress
        );
    }
}

// Usage - Your service layer has NO IDEA it's talking to Oracle! 🤯
UserRepository repo = new OracleUserRepositoryAdapter(new LegacyOracleDB());
User user = repo.findById("123");        // Calls Oracle's getUserData() behind the scenes
repo.save(user);                         // Calls Oracle's insertUser() behind the scenes
List<User> users = repo.findByEmail("john@example.com"); // Uses Oracle's searchUsersByEmailPattern()

// Your business logic works with BOTH implementations!
public class UserService {
    private UserRepository userRepo; // Could be PostgreSQL or Oracle!
    
    public void processUser(String id) {
        User user = userRepo.findById(id); // Same call, different implementation!
        // Business logic here...
    }
}
```

**Why This Is Mind-Blowing**:
- **Translation Layer**: Converts method calls, parameter types, and return types
- **Data Mapping**: Transforms between incompatible data structures  
- **Behavior Adaptation**: Makes different behaviors look the same (LIKE search → exact match)
- **Zero Business Logic Changes**: Your existing code works with the new system!

**Real-World Examples**:
- **Payment Gateways**: PayPal's API vs Stripe's API have completely different interfaces
- **Database Migration**: MySQL to MongoDB (relational vs document)
- **External APIs**: Your code expects REST, but legacy system only has SOAP
- **File Formats**: Reading CSV with your JSON parser interface

---

### 2. Facade 🎭 - "The Helpful Concierge"

**The Story**: You walk into a 5-star hotel and tell the concierge "I want a romantic evening." Instead of you calling restaurants, booking tickets, arranging flowers, and hiring a photographer, the concierge handles ALL of it with one simple request. That's Facade!

**Backend Reality**: Your microservices architecture has 15 different services. Your frontend shouldn't need to call all 15 to complete a user registration!

```java
// The complex subsystem - your microservices nightmare
class UserValidationService {
    public boolean validateEmail(String email) {
        System.out.println("📧 Validating email format and domain...");
        return email.contains("@");
    }
}

class PasswordService {
    public String hashPassword(String password) {
        System.out.println("🔒 Hashing password with bcrypt...");
        return "hashed_" + password;
    }
}

class EmailService {
    public void sendWelcomeEmail(String email) {
        System.out.println("📬 Sending welcome email to " + email);
    }
}

class UserDatabase {
    public void createUser(String email, String hashedPassword) {
        System.out.println("💾 Creating user in database...");
    }
}

class AuditService {
    public void logUserCreation(String email) {
        System.out.println("📋 Logging user creation for compliance...");
    }
}

// The hero - UserRegistrationFacade
class UserRegistrationFacade {
    private UserValidationService validator;
    private PasswordService passwordService;
    private EmailService emailService;
    private UserDatabase database;
    private AuditService auditService;
    
    public UserRegistrationFacade() {
        this.validator = new UserValidationService();
        this.passwordService = new PasswordService();
        this.emailService = new EmailService();
        this.database = new UserDatabase();
        this.auditService = new AuditService();
    }
    
    // One method to rule them all!
    public boolean registerUser(String email, String password) {
        System.out.println("🚀 Starting user registration for " + email);
        
        if (!validator.validateEmail(email)) {
            System.out.println("❌ Invalid email!");
            return false;
        }
        
        String hashedPassword = passwordService.hashPassword(password);
        database.createUser(email, hashedPassword);
        emailService.sendWelcomeEmail(email);
        auditService.logUserCreation(email);
        
        System.out.println("✅ User registration completed!\n");
        return true;
    }
}

// Usage - Frontend developers will love you for this simplicity!
UserRegistrationFacade registration = new UserRegistrationFacade();
registration.registerUser("john@example.com", "mySecretPassword");

// Instead of:
// validator.validateEmail(...)
// passwordService.hashPassword(...)
// database.createUser(...)
// emailService.sendWelcomeEmail(...)
// auditService.logUserCreation(...)
// ... 20 more lines of coordination code
```

**Why This Is Beautiful**:
- Your API consumers deal with ONE simple interface
- All the complex orchestration is hidden
- Easy to maintain (change internal services without affecting clients)
- Makes your APIs feel magical ✨

---

### 3. Proxy 🚪 - "The Smart Bouncer"

**The Story**: You're at an exclusive club. The bouncer checks your ID, decides if you're cool enough to enter, maybe charges a cover fee, and only then lets you talk to the actual bartender. Proxy works the same way - it's a smart intermediary that controls access.

**The Plot Twist**: Sometimes the "real" object is expensive to create, so Proxy delays creating it until absolutely necessary. Lazy loading FTW!

```java
// The expensive VIP - takes forever to load
interface VideoStream {
    void play(String filename);
}

class RealVideoStream implements VideoStream {
    private String filename;
    
    public RealVideoStream(String filename) {
        this.filename = filename;
        loadVideoFromDisk(); // This takes 5 seconds! 😱
    }
    
    private void loadVideoFromDisk() {
        System.out.println("🎬 Loading MASSIVE video file: " + filename);
        try {
            Thread.sleep(2000); // Simulate loading time
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println("✅ Video loaded successfully!");
    }
    
    public void play(String filename) {
        System.out.println("▶️ Playing video: " + filename);
    }
}

// The smart bouncer proxy
class VideoStreamProxy implements VideoStream {
    private RealVideoStream realStream;
    private String filename;
    private boolean hasAccess;
    
    public VideoStreamProxy(String filename, boolean hasAccess) {
        this.filename = filename;
        this.hasAccess = hasAccess;
    }
    
    public void play(String filename) {
        // Security check first!
        if (!hasAccess) {
            System.out.println("🚫 Access denied! Premium subscription required.");
            return;
        }
        
        // Lazy loading - only create the expensive object when needed!
        if (realStream == null) {
            System.out.println("🎯 First time playing, loading video...");
            realStream = new RealVideoStream(filename);
        } else {
            System.out.println("⚡ Video already loaded, playing immediately!");
        }
        
        realStream.play(filename);
    }
}

// Usage - Look at this performance optimization!
VideoStream video1 = new VideoStreamProxy("avengers.mp4", true);
VideoStream video2 = new VideoStreamProxy("secret_movie.mp4", false);

video2.play("secret_movie.mp4"); // Blocked instantly, no expensive loading!
video1.play("avengers.mp4");     // Loads now (when actually needed)
video1.play("avengers.mp4");     // Instant replay - already loaded!
```

**The Genius**:
- Lazy loading (don't load until needed)
- Access control (bouncer functionality)
- Caching (load once, use many times)
- Performance optimization without changing the interface

---

## 🎭 Behavioral Patterns: The Communication Specialists

### 1. Observer 📢 - "The Gossip Network"

**The Story**: Remember high school? When drama happened, news spread instantly through the gossip network. Sarah tells Emma, Emma tells Jake, Jake tells everyone. One event, multiple notifications. That's Observer pattern!

**Backend Magic**: User updates their profile → notification service alerts them, analytics tracks it, recommendation engine recalculates, cache gets invalidated. One action, multiple reactions!

```java
import java.util.*;

// The gossip interface
interface Subscriber {
    void update(String news, String source);
}

// The news source
interface NewsPublisher {
    void subscribe(Subscriber subscriber);
    void unsubscribe(Subscriber subscriber);
    void notifySubscribers(String news);
}

// The main gossip hub
class SocialMediaFeed implements NewsPublisher {
    private List<Subscriber> subscribers = new ArrayList<>();
    private String latestPost;
    
    public void subscribe(Subscriber subscriber) {
        subscribers.add(subscriber);
        System.out.println("🔔 New subscriber joined the gossip network!");
    }
    
    public void unsubscribe(Subscriber subscriber) {
        subscribers.remove(subscriber);
        System.out.println("👋 Subscriber left the gossip network");
    }
    
    public void notifySubscribers(String news) {
        System.out.println("📢 Broadcasting to " + subscribers.size() + " subscribers...");
        for (Subscriber subscriber : subscribers) {
            subscriber.update(news, "SocialMediaFeed");
        }
    }
    
    public void postUpdate(String post) {
        this.latestPost = post;
        System.out.println("📝 New post created: " + post);
        notifySubscribers(post);
    }
}

// Different types of gossip lovers
class NotificationService implements Subscriber {
    public void update(String news, String source) {
        System.out.println("🔔 NOTIFICATION: Push alert sent - " + news);
    }
}

class AnalyticsService implements Subscriber {
    public void update(String news, String source) {
        System.out.println("📊 ANALYTICS: Recording engagement data for: " + news);
    }
}

class EmailDigest implements Subscriber {
    public void update(String news, String source) {
        System.out.println("📧 EMAIL: Adding to weekly digest - " + news);
    }
}

// Usage - Watch the magic happen!
SocialMediaFeed feed = new SocialMediaFeed();

NotificationService notifications = new NotificationService();
AnalyticsService analytics = new AnalyticsService();
EmailDigest emailDigest = new EmailDigest();

feed.subscribe(notifications);
feed.subscribe(analytics);
feed.subscribe(emailDigest);

feed.postUpdate("Just launched our awesome new feature! 🚀");
// Watch all subscribers react automatically!
```

**The Magic**: When you post something, you don't manually call each service. The Observer pattern handles the chain reaction automatically. Add new subscribers? No problem - zero changes to the publisher!

---

### 2. Strategy ⚔️ - "The Swiss Army Knife"

**The Story**: You're playing a video game boss fight. You can attack with sword (high damage, slow), bow (medium damage, fast), or magic (area damage, mana cost). Same goal (defeat boss), different strategies. You pick based on the situation!

**Backend Wisdom**: You need to sort data. Sometimes you want speed (QuickSort), sometimes you want stability (MergeSort), sometimes you want memory efficiency (HeapSort). Strategy lets you swap algorithms like changing weapons!

```java
// The weapon interface
interface SortingStrategy {
    void sort(int[] array);
    String getStrategyName();
}

// Different weapons in your arsenal
class QuickSortStrategy implements SortingStrategy {
    public void sort(int[] array) {
        System.out.println("⚡ QuickSort: Fast and furious!");
        Arrays.sort(array); // Using built-in quicksort
    }
    
    public String getStrategyName() { return "QuickSort"; }
}

class BubbleSortStrategy implements SortingStrategy {
    public void sort(int[] array) {
        System.out.println("🐌 BubbleSort: Slow but steady!");
        // Simple bubble sort implementation
        for (int i = 0; i < array.length - 1; i++) {
            for (int j = 0; j < array.length - i - 1; j++) {
                if (array[j] > array[j + 1]) {
                    int temp = array[j];
                    array[j] = array[j + 1];
                    array[j + 1] = temp;
                }
            }
        }
    }
    
    public String getStrategyName() { return "BubbleSort"; }
}

class MergeSortStrategy implements SortingStrategy {
    public void sort(int[] array) {
        System.out.println("🔄 MergeSort: Divide and conquer!");
        mergeSort(array, 0, array.length - 1);
    }
    
    public String getStrategyName() { return "MergeSort"; }
    
    private void mergeSort(int[] arr, int left, int right) {
        if (left < right) {
            int mid = (left + right) / 2;
            mergeSort(arr, left, mid);
            mergeSort(arr, mid + 1, right);
            merge(arr, left, mid, right);
        }
    }
    
    private void merge(int[] arr, int left, int mid, int right) {
        // Merge implementation...
    }
}

// The game character who chooses weapons
class DataSorter {
    private SortingStrategy strategy;
    
    public void setStrategy(SortingStrategy strategy) {
        this.strategy = strategy;
        System.out.println("🎯 Switched to " + strategy.getStrategyName() + " strategy");
    }
    
    public void sortData(int[] data) {
        if (strategy == null) {
            System.out.println("❌ No strategy selected!");
            return;
        }
        
        System.out.println("📊 Original data: " + Arrays.toString(data));
        long startTime = System.currentTimeMillis();
        
        strategy.sort(data);
        
        long endTime = System.currentTimeMillis();
        System.out.println("✅ Sorted data: " + Arrays.toString(data));
        System.out.println("⏱️ Time taken: " + (endTime - startTime) + "ms\n");
    }
}

// Usage - Change strategies like a pro gamer!
DataSorter sorter = new DataSorter();
int[] smallData = {64, 34, 25, 12, 22, 11, 90};
int[] copyData = smallData.clone();

sorter.setStrategy(new QuickSortStrategy());
sorter.sortData(Arrays.copyOf(smallData, smallData.length));

sorter.setStrategy(new BubbleSortStrategy());
sorter.sortData(Arrays.copyOf(smallData, smallData.length));

// Need a new algorithm? Just add it - no changes to existing code!
```

**Why This Rocks**:
- Swap algorithms at runtime
- No messy if-else chains
- Easy A/B testing (try different strategies and measure performance)
- Adding new strategies doesn't break existing code

---

### 3. State 🎮 - "The Mood Ring Object"
**One-liner**: Object changes behavior based on internal state - same object, different personalities. Perfect for order processing (new→paid→shipped→delivered), user sessions, or any workflow with distinct phases.

---

### 4. Iterator 🚶‍♂️ - "The Museum Tour Guide"

**The Story**: You're at a museum with a tour guide. They know the best path through the exhibits, handle the timing, and you just follow along enjoying the art. You don't need to know the museum layout or which room comes next - that's the guide's job!

**Java Connection**: Ever used `for (String item : list)`? That's Iterator pattern! Java Collections Framework is built on it.

```java
// The art piece
class Book {
    private String title;
    private String author;
    
    public Book(String title, String author) {
        this.title = title;
        this.author = author;
    }
    
    public String toString() {
        return "📚 " + title + " by " + author;
    }
}

// The museum
class Library implements Iterable<Book> {
    private List<Book> books = new ArrayList<>();
    
    public void addBook(Book book) {
        books.add(book);
        System.out.println("➕ Added: " + book);
    }
    
    // This is where the magic happens - custom iterator!
    public Iterator<Book> iterator() {
        return new LibraryIterator();
    }
    
    // The tour guide knows the best path
    private class LibraryIterator implements Iterator<Book> {
        private int currentIndex = 0;
        
        public boolean hasNext() {
            return currentIndex < books.size();
        }
        
        public Book next() {
            if (!hasNext()) {
                throw new NoSuchElementException("📚 End of library reached!");
            }
            
            Book currentBook = books.get(currentIndex);
            currentIndex++;
            System.out.println("👣 Visiting book #" + currentIndex + ": " + currentBook);
            return currentBook;
        }
    }
}

// Custom iterator for different traversal (reverse order)
class ReverseLibraryIterator implements Iterator<Book> {
    private List<Book> books;
    private int currentIndex;
    
    public ReverseLibraryIterator(List<Book> books) {
        this.books = books;
        this.currentIndex = books.size() - 1;
    }
    
    public boolean hasNext() {
        return currentIndex >= 0;
    }
    
    public Book next() {
        if (!hasNext()) {
            throw new NoSuchElementException();
        }
        return books.get(currentIndex--);
    }
}

// Usage - Multiple ways to tour the same museum!
Library library = new Library();
library.addBook(new Book("Design Patterns", "Gang of Four"));
library.addBook(new Book("Clean Code", "Robert Martin"));
library.addBook(new Book("Spring in Action", "Craig Walls"));

System.out.println("\n🚶‍♂️ Forward tour:");
for (Book book : library) { // Uses our custom iterator!
    // Just enjoying the tour, don't care about implementation
}

System.out.println("\n🚶‍♀️ Reverse tour:");
Iterator<Book> reverseIterator = new ReverseLibraryIterator(
    library.books // In real code, you'd provide a getter
);
while (reverseIterator.hasNext()) {
    Book book = reverseIterator.next();
    System.out.println("👣 Reverse visiting: " + book);
}
```

**The Power**:
- Hide complex traversal logic
- Multiple ways to iterate same collection
- Client code stays simple and clean
- Works seamlessly with enhanced for-loops

---

### 5. Template Method 📝 - "The Recipe Framework"
**One-liner**: Define the skeleton of an algorithm, let subclasses customize specific steps. Think Spring's `JdbcTemplate` or data processing pipelines where the workflow is fixed but implementations vary.

---

## 🎤 Interview Power Moves

### The "Aha!" Moments That Impress Interviewers:

**When they ask about Singleton:**
> "Singleton is great for resources like database connection pools, but I'd be careful about overusing it. In Spring, I'd prefer `@Component` with singleton scope because it's more testable and IoC-friendly. Also, enum-based Singleton is thread-safe by default!"

**When they ask Factory vs Abstract Factory:**
> "Factory Method is like a pizza place - one type of food, many variations. Abstract Factory is like a food court - multiple types of food, but everything in the 'Italian section' goes together, everything in the 'Chinese section' goes together."

**When they mention Observer:**
> "Observer is everywhere in backend! Spring Events, JMS message listeners, reactive streams with RxJava. It's the foundation of event-driven architecture. The key insight is decoupling - publishers don't know who's listening!"

**Strategy Pattern Pro Tip:**
> "Strategy is perfect for things like payment processing, tax calculation, or pricing algorithms. In e-commerce, you might have different pricing strategies for B2B vs B2C customers. The beauty is you can A/B test strategies in production!"

### 🧠 Memory Palace Technique:

**Creational = Birth Control**: 
- Singleton = One baby policy
- Factory = Baby factory (you order, they deliver)
- Abstract Factory = Baby factory chain (consistent themes)
- Builder = Custom baby designer (choose every feature)

**Structural = Relationship Status**:
- Adapter = Translator for international relationships  
- Facade = Relationship manager (handles all the drama)
- Proxy = Overprotective parent (controls access)

**Behavioral = Social Dynamics**:
- Observer = Gossip network
- Strategy = Choosing your fighting style
- State = Mood swings
- Iterator = Following a tour guide
- Template Method = Family recipe (same steps, different ingredients)

### 🚀 Spring Framework Easter Eggs:

```java
// Singleton
@Component // Singleton by default!
@Scope("singleton") // Explicit if you want

// Factory  
@Bean
public PaymentProcessor paymentProcessor(@Value("${payment.provider}") String provider) {
    return PaymentProcessorFactory.create(provider);
}

// Observer
@EventListener
public void handleUserRegistration(UserRegisteredEvent event) {
    // Spring's Observer pattern in action!
}

// Strategy
@Autowired
private List<PaymentStrategy> paymentStrategies; // Inject all strategies!

// Template Method
@Transactional // Spring's template for transaction management!
public void businessMethod() {
    // Your code here, Spring handles begin/commit/rollback
}
```

---

## 🎯 Final Boss Battle Tips:

1. **Don't just memorize - understand the problems they solve**
2. **Connect patterns to real frameworks you've used**
3. **Know when NOT to use them** (over-engineering is real!)
4. **Practice explaining with analogies** (shows deep understanding)
5. **Relate to your actual project experience** when possible

Remember: Design patterns are tools, not rules. A master craftsman knows when to use a hammer and when to use a screwdriver. You got this! 💪