# MICROSERVICE DESIGN PATTERNS - COMPLETE GUIDE

A comprehensive guide to essential microservice design patterns with practical Java examples for interview preparation.

## TABLE OF CONTENTS

1. [Core Communication Patterns](#core-communication-patterns)
2. [Resilience & Fault Tolerance Patterns](#resilience--fault-tolerance-patterns)
3. [Data Management Patterns](#data-management-patterns)
4. [Architecture Patterns](#architecture-patterns)
5. [Migration & Deployment Patterns](#migration--deployment-patterns)
6. [Interview Success Tips](#interview-success-tips)

---

## CORE COMMUNICATION PATTERNS

### 1. API GATEWAY PATTERN

**Problem:** Clients need to call multiple services directly, leading to complex client code and security issues.

**Meaning:** Like a hotel concierge who handles all guest requests and directs them to the right departments (restaurant, housekeeping, etc.).

**Java Implementation:**

```java
@RestController
@RequestMapping("/api")
public class APIGatewayController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private OrderService orderService;
    
    @Autowired
    private PaymentService paymentService;
    
    // Single endpoint aggregating multiple services
    @GetMapping("/dashboard/{userId}")
    public DashboardResponse getDashboard(@PathVariable String userId) {
        // Call multiple services
        User user = userService.getUser(userId);
        List<Order> orders = orderService.getRecentOrders(userId);
        PaymentInfo payment = paymentService.getPaymentMethods(userId);
        
        return new DashboardResponse(user, orders, payment);
    }
    
    // Route requests to appropriate services
    @PostMapping("/orders")
    public OrderResponse createOrder(@RequestBody OrderRequest request) {
        // Authentication/authorization logic here
        if (!isAuthenticated(request.getToken())) {
            throw new UnauthorizedException("Invalid token");
        }
        
        // Rate limiting
        if (exceedsRateLimit(request.getUserId())) {
            throw new TooManyRequestsException("Rate limit exceeded");
        }
        
        return orderService.createOrder(request);
    }
}
```

### 2. SERVICE REGISTRY & DISCOVERY

**Problem:** Services need to find each other without hardcoding IP addresses.

**Meaning:** Like a phone directory that automatically updates when people move or change numbers.

**Java Implementation:**

```java
// Service Registration
@Service
public class ServiceRegistry {
    private Map<String, List<ServiceInstance>> services = new ConcurrentHashMap<>();
    
    public void registerService(String serviceName, ServiceInstance instance) {
        services.computeIfAbsent(serviceName, k -> new ArrayList<>())
               .add(instance);
        System.out.println("Registered: " + serviceName + " at " + instance.getAddress());
    }
    
    public ServiceInstance discoverService(String serviceName) {
        List<ServiceInstance> instances = services.get(serviceName);
        if (instances == null || instances.isEmpty()) {
            throw new ServiceNotFoundException("Service not found: " + serviceName);
        }
        
        // Simple load balancing - round robin
        return instances.get(new Random().nextInt(instances.size()));
    }
}

// Service using discovery
@Service
public class OrderService {
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    public void processPayment(PaymentRequest request) {
        // Discover payment service dynamically
        ServiceInstance paymentService = serviceRegistry.discoverService("payment-service");
        
        // Call the discovered service
        String paymentUrl = "http://" + paymentService.getAddress() + "/process";
        // Make HTTP call to payment service
    }
}

// Service Instance class
public class ServiceInstance {
    private String serviceName;
    private String address;
    private int port;
    private boolean healthy;
    
    // constructors, getters, setters
    public String getAddress() {
        return address + ":" + port;
    }
}
```

---

## RESILIENCE & FAULT TOLERANCE PATTERNS

### 3. CIRCUIT BREAKER PATTERN

**Problem:** When a service fails, other services keep trying and waste resources.

**Meaning:** Like a house circuit breaker that cuts power when there's an electrical fault to prevent fire.

**Java Implementation:**

```java
public class CircuitBreaker {
    private enum State { CLOSED, OPEN, HALF_OPEN }
    
    private State state = State.CLOSED;
    private int failureCount = 0;
    private final int failureThreshold = 5;
    private final long timeout = 60000; // 1 minute
    private long lastFailureTime = 0;
    
    public <T> T execute(Supplier<T> operation) throws Exception {
        if (state == State.OPEN) {
            if (System.currentTimeMillis() - lastFailureTime > timeout) {
                state = State.HALF_OPEN;
                System.out.println("Circuit breaker is now HALF_OPEN, testing service...");
            } else {
                throw new CircuitBreakerOpenException("Service is currently unavailable");
            }
        }
        
        try {
            T result = operation.get();
            onSuccess();
            return result;
        } catch (Exception e) {
            onFailure();
            throw e;
        }
    }
    
    private void onSuccess() {
        failureCount = 0;
        state = State.CLOSED;
        System.out.println("Circuit breaker is now CLOSED");
    }
    
    private void onFailure() {
        failureCount++;
        lastFailureTime = System.currentTimeMillis();
        
        if (failureCount >= failureThreshold) {
            state = State.OPEN;
            System.out.println("Circuit breaker is now OPEN - too many failures!");
        }
    }
}

// Usage in a service
@Service
public class PaymentService {
    private CircuitBreaker circuitBreaker = new CircuitBreaker();
    
    public PaymentResult processPayment(PaymentRequest request) {
        try {
            return circuitBreaker.execute(() -> {
                // This might fail
                return callExternalPaymentGateway(request);
            });
        } catch (CircuitBreakerOpenException e) {
            // Fallback mechanism
            return new PaymentResult("FAILED", "Payment service temporarily unavailable");
        }
    }
    
    private PaymentResult callExternalPaymentGateway(PaymentRequest request) {
        // Simulate external call that might fail
        if (Math.random() < 0.3) { // 30% failure rate
            throw new RuntimeException("Payment gateway timeout");
        }
        return new PaymentResult("SUCCESS", "Payment processed");
    }
}
```

### 4. RETRY PATTERN

**Problem:** Temporary failures should be retried, but we need to avoid overwhelming failing services.

**Meaning:** Like knocking on a door multiple times, waiting a bit longer each time, before giving up.

**Java Implementation:**

```java
@Service
public class RetryableService {
    
    public String callExternalService(String data) {
        return retryWithBackoff(() -> {
            return makeExternalCall(data);
        }, 3); // Max 3 retries
    }
    
    private <T> T retryWithBackoff(Supplier<T> operation, int maxRetries) {
        int attempt = 0;
        
        while (attempt <= maxRetries) {
            try {
                return operation.get();
            } catch (Exception e) {
                attempt++;
                if (attempt > maxRetries) {
                    System.out.println("Max retries exceeded, giving up");
                    throw new RuntimeException("Service call failed after " + maxRetries + " retries", e);
                }
                
                // Exponential backoff with jitter
                long waitTime = (long) (Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
                long jitter = (long) (Math.random() * 1000); // Random 0-1s
                
                try {
                    System.out.println("Retry " + attempt + " after " + (waitTime + jitter) + "ms");
                    Thread.sleep(waitTime + jitter);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted during retry", ie);
                }
            }
        }
        return null;
    }
    
    private String makeExternalCall(String data) {
        // Simulate unreliable external service
        if (Math.random() < 0.6) { // 60% failure rate
            throw new RuntimeException("Temporary network issue");
        }
        return "Success: " + data;
    }
}
```

---

## DATA MANAGEMENT PATTERNS

### 5. DATABASE PER SERVICE

**Problem:** Shared databases create tight coupling between services.

**Meaning:** Like each department in a company having its own filing cabinet instead of sharing one big messy cabinet.

**Java Implementation:**

```java
// User Service with its own database
@Entity
@Table(name = "users")
public class User {
    @Id
    private String userId;
    private String name;
    private String email;
    // User-specific fields only
}

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
}

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    public User createUser(String name, String email) {
        User user = new User();
        user.setUserId(UUID.randomUUID().toString());
        user.setName(name);
        user.setEmail(email);
        
        User savedUser = userRepository.save(user);
        
        // Publish event for other services
        publishEvent(new UserCreatedEvent(savedUser.getUserId(), savedUser.getName()));
        
        return savedUser;
    }
}

// Order Service with its own database
@Entity
@Table(name = "orders")
public class Order {
    @Id
    private String orderId;
    private String userId; // Reference, not foreign key
    private BigDecimal amount;
    private LocalDateTime createdAt;
    // Order-specific fields only
}

@Service
public class OrderService {
    @Autowired
    private OrderRepository orderRepository;
    
    @EventListener
    public void handleUserCreated(UserCreatedEvent event) {
        // Update local user cache/denormalized data
        // No direct database access to user service database
        System.out.println("User created: " + event.getUserName());
    }
    
    public Order createOrder(String userId, BigDecimal amount) {
        Order order = new Order();
        order.setOrderId(UUID.randomUUID().toString());
        order.setUserId(userId); // Just store the reference
        order.setAmount(amount);
        order.setCreatedAt(LocalDateTime.now());
        
        return orderRepository.save(order);
    }
}
```

### 6. SAGA PATTERN (ORCHESTRATION)

**Problem:** We need transactions across multiple services but can't use traditional database transactions.

**Meaning:** Like planning a wedding where if the venue cancels, you also need to cancel the caterer, photographer, etc. automatically.

**Java Implementation:**

```java
// Saga Orchestrator for Order Processing
@Service
public class OrderSaga {
    
    @Autowired
    private OrderService orderService;
    
    @Autowired
    private InventoryService inventoryService;
    
    @Autowired
    private PaymentService paymentService;
    
    public void processOrder(OrderRequest request) {
        String sagaId = UUID.randomUUID().toString();
        SagaTransaction saga = new SagaTransaction(sagaId);
        
        try {
            // Step 1: Create Order
            String orderId = orderService.createOrder(request);
            saga.addCompensation(() -> orderService.cancelOrder(orderId));
            
            // Step 2: Reserve Inventory
            String reservationId = inventoryService.reserveItems(request.getItems());
            saga.addCompensation(() -> inventoryService.releaseReservation(reservationId));
            
            // Step 3: Process Payment
            String paymentId = paymentService.processPayment(request.getPaymentInfo());
            saga.addCompensation(() -> paymentService.refundPayment(paymentId));
            
            // Step 4: Confirm Order
            orderService.confirmOrder(orderId);
            System.out.println("Order saga completed successfully: " + sagaId);
            
        } catch (Exception e) {
            System.out.println("Saga failed, executing compensations: " + sagaId);
            saga.executeCompensations();
            throw new SagaFailedException("Order processing failed", e);
        }
    }
}

// Helper class to manage compensations
public class SagaTransaction {
    private String sagaId;
    private List<Runnable> compensations = new ArrayList<>();
    
    public SagaTransaction(String sagaId) {
        this.sagaId = sagaId;
    }
    
    public void addCompensation(Runnable compensation) {
        compensations.add(0, compensation); // Add to beginning for reverse order
    }
    
    public void executeCompensations() {
        for (Runnable compensation : compensations) {
            try {
                compensation.run();
                System.out.println("Executed compensation for saga: " + sagaId);
            } catch (Exception e) {
                System.out.println("Compensation failed for saga: " + sagaId + ", " + e.getMessage());
            }
        }
    }
}

// Example services
@Service
public class InventoryService {
    public String reserveItems(List<String> items) {
        // Check if items are available
        if (Math.random() < 0.1) { // 10% chance of failure
            throw new InsufficientInventoryException("Items not available");
        }
        
        String reservationId = UUID.randomUUID().toString();
        System.out.println("Reserved items: " + items + ", reservation: " + reservationId);
        return reservationId;
    }
    
    public void releaseReservation(String reservationId) {
        System.out.println("Released reservation: " + reservationId);
    }
}
```

### 7. CQRS (COMMAND QUERY RESPONSIBILITY SEGREGATION)

**Problem:** Read and write operations have different requirements and performance characteristics.

**Meaning:** Like having separate express checkout lanes for simple purchases and full-service counters for complex transactions at a store.

**Java Implementation:**

```java
// Command Side (Write Model) - Optimized for consistency
@Entity
public class Product {
    @Id
    private String productId;
    private String name;
    private BigDecimal price;
    private int stockQuantity;
    
    // Business logic methods
    public void updatePrice(BigDecimal newPrice) {
        if (newPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Price must be positive");
        }
        this.price = newPrice;
    }
}

@Service
public class ProductCommandService {
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private ApplicationEventPublisher eventPublisher;
    
    public void updateProduct(String productId, String name, BigDecimal price) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ProductNotFoundException("Product not found"));
        
        product.setName(name);
        product.updatePrice(price);
        
        productRepository.save(product);
        
        // Publish event for read model update
        eventPublisher.publishEvent(
            new ProductUpdatedEvent(productId, name, price)
        );
    }
}

// Query Side (Read Model) - Optimized for fast reads
public class ProductView {
    private String productId;
    private String name;
    private BigDecimal price;
    private String categoryName;        // Denormalized
    private String brandName;           // Denormalized  
    private double avgRating;           // Denormalized
    private int reviewCount;            // Denormalized
    
    // Only getters, no business logic
    // getters and setters...
}

@Service
public class ProductQueryService {
    private Map<String, ProductView> productViews = new ConcurrentHashMap<>();
    
    // Fast read operations
    public ProductView getProduct(String productId) {
        return productViews.get(productId);
    }
    
    public List<ProductView> searchProducts(String keyword) {
        return productViews.values().stream()
            .filter(p -> p.getName().toLowerCase().contains(keyword.toLowerCase()))
            .collect(Collectors.toList());
    }
    
    public List<ProductView> getProductsByCategory(String category) {
        return productViews.values().stream()
            .filter(p -> p.getCategoryName().equals(category))
            .collect(Collectors.toList());
    }
    
    // Event handler to update read model
    @EventListener
    public void handleProductUpdated(ProductUpdatedEvent event) {
        ProductView view = productViews.get(event.getProductId());
        if (view == null) {
            view = new ProductView();
            view.setProductId(event.getProductId());
        }
        
        view.setName(event.getName());
        view.setPrice(event.getPrice());
        // Update other denormalized fields...
        
        productViews.put(event.getProductId(), view);
        System.out.println("Updated product view: " + event.getProductId());
    }
}
```

---

## ARCHITECTURE PATTERNS

### 8. EVENT-DRIVEN ARCHITECTURE

**Problem:** Services are tightly coupled through direct calls.

**Meaning:** Like a town crier announcing news - everyone interested can hear and react, but the crier doesn't need to know who's listening.

**Java Implementation:**

```java
// Event Publisher
@Service
public class OrderService {
    
    @Autowired
    private ApplicationEventPublisher eventPublisher;
    
    public Order createOrder(OrderRequest request) {
        Order order = new Order();
        order.setOrderId(UUID.randomUUID().toString());
        order.setCustomerId(request.getCustomerId());
        order.setAmount(request.getAmount());
        order.setStatus("CREATED");
        
        // Save order
        Order savedOrder = orderRepository.save(order);
        
        // Publish event - fire and forget
        OrderCreatedEvent event = new OrderCreatedEvent(
            savedOrder.getOrderId(),
            savedOrder.getCustomerId(),
            savedOrder.getAmount()
        );
        eventPublisher.publishEvent(event);
        
        return savedOrder;
    }
}

// Event Subscribers
@Service
public class EmailService {
    
    @EventListener
    @Async // Process asynchronously
    public void handleOrderCreated(OrderCreatedEvent event) {
        // Send order confirmation email
        System.out.println("Sending email for order: " + event.getOrderId());
        
        String emailContent = "Order " + event.getOrderId() + 
                              " for amount $" + event.getAmount() + " has been created.";
        
        sendEmail(event.getCustomerId(), "Order Confirmation", emailContent);
    }
    
    private void sendEmail(String customerId, String subject, String content) {
        // Email sending logic
        System.out.println("Email sent to customer: " + customerId);
    }
}

@Service
public class InventoryService {
    
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        System.out.println("Updating inventory for order: " + event.getOrderId());
        // Update inventory levels
        // This service doesn't know about email service
    }
}

@Service
public class AnalyticsService {
    
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        System.out.println("Recording analytics for order: " + event.getOrderId());
        // Record order metrics
        // This service is completely independent
    }
}

// Event class
public class OrderCreatedEvent {
    private String orderId;
    private String customerId;
    private BigDecimal amount;
    private LocalDateTime timestamp;
    
    public OrderCreatedEvent(String orderId, String customerId, BigDecimal amount) {
        this.orderId = orderId;
        this.customerId = customerId;
        this.amount = amount;
        this.timestamp = LocalDateTime.now();
    }
    
    // getters...
}
```

### 9. API COMPOSITION

**Problem:** Clients need data from multiple services and making multiple calls is inefficient.

**Meaning:** Like a personal assistant who gathers information from different departments and gives you a single summary report.

**Java Implementation:**

```java
@RestController
public class CompositeController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private OrderService orderService;
    
    @Autowired
    private ProductService productService;
    
    @GetMapping("/customers/{customerId}/summary")
    public CustomerSummary getCustomerSummary(@PathVariable String customerId) {
        
        // Fetch data from multiple services
        CompletableFuture<User> userFuture = 
            CompletableFuture.supplyAsync(() -> userService.getUser(customerId));
            
        CompletableFuture<List<Order>> ordersFuture = 
            CompletableFuture.supplyAsync(() -> orderService.getRecentOrders(customerId, 5));
            
        CompletableFuture<List<Product>> favoriteProductsFuture = 
            CompletableFuture.supplyAsync(() -> productService.getFavoriteProducts(customerId));
        
        try {
            // Wait for all calls to complete (with timeout)
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                userFuture, ordersFuture, favoriteProductsFuture
            );
            
            allFutures.get(5, TimeUnit.SECONDS); // 5-second timeout
            
            // Compose the response
            CustomerSummary summary = new CustomerSummary();
            summary.setUser(userFuture.get());
            summary.setRecentOrders(ordersFuture.get());
            summary.setFavoriteProducts(favoriteProductsFuture.get());
            
            return summary;
            
        } catch (TimeoutException e) {
            // Handle partial failure gracefully
            return createPartialSummary(customerId, userFuture, ordersFuture, favoriteProductsFuture);
        } catch (Exception e) {
            throw new ServiceCompositionException("Failed to compose customer summary", e);
        }
    }
    
    private CustomerSummary createPartialSummary(String customerId, 
                                               CompletableFuture<User> userFuture,
                                               CompletableFuture<List<Order>> ordersFuture,
                                               CompletableFuture<List<Product>> favoriteProductsFuture) {
        
        CustomerSummary summary = new CustomerSummary();
        
        // Get whatever data is available
        try { summary.setUser(userFuture.getNow(null)); } catch (Exception ignored) {}
        try { summary.setRecentOrders(ordersFuture.getNow(Collections.emptyList())); } catch (Exception ignored) {}
        try { summary.setFavoriteProducts(favoriteProductsFuture.getNow(Collections.emptyList())); } catch (Exception ignored) {}
        
        summary.setPartialData(true);
        
        return summary;
    }
}

public class CustomerSummary {
    private User user;
    private List<Order> recentOrders;
    private List<Product> favoriteProducts;
    private boolean partialData = false;
    
    // getters and setters...
}
```

---

## MIGRATION & DEPLOYMENT PATTERNS

### 10. STRANGLER FIG PATTERN

**Problem:** Need to replace a legacy system gradually without a big-bang migration.

**Meaning:** Like renovating your house room by room while still living in it, instead of moving out completely during renovation.

**Java Implementation:**

```java
// Legacy wrapper - gradually replace functionality
@RestController
public class StranglerFigController {
    
    @Autowired
    private LegacyAccountService legacyAccountService;
    
    @Autowired
    private NewAccountService newAccountService;
    
    private final boolean useNewService = isFeatureEnabled("new-account-service");
    
    @GetMapping("/accounts/{accountId}")
    public Account getAccount(@PathVariable String accountId) {
        
        // Route to new service for certain accounts
        if (shouldUseNewService(accountId)) {
            try {
                return newAccountService.getAccount(accountId);
            } catch (Exception e) {
                // Fallback to legacy system
                System.out.println("New service failed, falling back to legacy");
                return legacyAccountService.getAccount(accountId);
            }
        } else {
            return legacyAccountService.getAccount(accountId);
        }
    }
    
    @PostMapping("/accounts")
    public Account createAccount(@RequestBody CreateAccountRequest request) {
        // Always use new service for new accounts
        if (useNewService) {
            return newAccountService.createAccount(request);
        } else {
            return legacyAccountService.createAccount(request);
        }
    }
    
    private boolean shouldUseNewService(String accountId) {
        // Gradual migration - route 20% of requests to new service
        int hash = accountId.hashCode();
        return Math.abs(hash) % 100 < 20; // 20% of accounts
    }
    
    private boolean isFeatureEnabled(String feature) {
        // Feature flag - can be toggled without deployment
        return configService.getBoolean(feature, false);
    }
}

// New microservice implementation
@Service
public class NewAccountService {
    public Account getAccount(String accountId) {
        // New, improved implementation
        System.out.println("Using new account service for: " + accountId);
        // Modern database, better caching, etc.
        return new Account(accountId, "Modern Implementation");
    }
    
    public Account createAccount(CreateAccountRequest request) {
        // New account creation with better validation
        return new Account(UUID.randomUUID().toString(), request.getName());
    }
}

// Legacy service that will gradually be replaced
@Service
public class LegacyAccountService {
    public Account getAccount(String accountId) {
        System.out.println("Using legacy account service for: " + accountId);
        // Old implementation - will be phased out
        return new Account(accountId, "Legacy Implementation");
    }
    
    public Account createAccount(CreateAccountRequest request) {
        // Legacy account creation
        return new Account("LEGACY-" + System.currentTimeMillis(), request.getName());
    }
}
```

---

## INTERVIEW SUCCESS TIPS

### KEY INTERVIEW POINTS

When asked **"Why use these patterns?"**:

1. **Circuit Breaker**: "Prevents cascade failures - like a fuse protecting your house"
2. **Retry**: "Handles temporary glitches - like redialing a busy phone number"
3. **Service Registry**: "Dynamic discovery - like GPS finding the nearest gas station"
4. **Saga**: "Distributed transactions - like coordinating a multi-step business process"
5. **CQRS**: "Separate read/write optimization - like express lanes vs full checkout"
6. **Event-Driven**: "Loose coupling - like newspaper subscription vs direct mail"

### COMMON PATTERN COMBINATIONS

**Resilient Service Call:**
- Circuit Breaker + Retry + Service Discovery

**Data Consistency:**
- Saga + Event-Driven + Database per Service

**Performance:**
- CQRS + API Composition + Caching

### INTERVIEW QUESTION EXAMPLES

**Q: "Design a resilient order processing system"**

**Answer Structure:**
1. API Gateway for single entry point
2. Service Registry for dynamic service discovery
3. Circuit Breaker on payment service calls
4. Saga Pattern for distributed transaction handling
5. Event-Driven Architecture for loose coupling
6. Database per Service for data independence
7. Retry Pattern with exponential backoff

**Implementation Flow:**
```
Client → API Gateway → Order Service
                           ↓
                      Service Registry (discover Payment Service)
                           ↓  
                      Circuit Breaker → Payment Service
                           ↓
                      Saga Coordinator
                           ↓
                      Event Bus (OrderCompleted)
                           ↓
                      [Inventory, Shipping, Analytics Services]
```

### KEY INTERVIEW POINTS TO REMEMBER

- Always explain the **PROBLEM** each pattern solves
- Give **SPECIFIC EXAMPLES** with real numbers (timeouts, thresholds, etc.)
- Discuss **TRADE-OFFS** and when NOT to use patterns
- Show how patterns **WORK TOGETHER** in real systems
- Mention **SPECIFIC TOOLS** and technologies (Netflix OSS, Spring Cloud, etc.)

---

*This guide provides simple Java examples for each microservice design pattern with clear explanations and meaningful use cases, perfect for high-level design interview preparation.*