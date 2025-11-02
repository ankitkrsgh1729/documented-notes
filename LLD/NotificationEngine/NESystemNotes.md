# Notification Engine - Senior Software Engineer Interview Notes

## 📌 Project Overview

**Notification Engine** is a production-grade, multi-channel notification delivery system built with Spring Boot that manages the entire lifecycle of notifications across Email (Postmark & SendGrid), SMS, WhatsApp, Slack, and In-App channels.

### Core Capabilities
- **Multi-channel delivery**: Email, SMS, WhatsApp, Slack, In-App notifications
- **Template management**: Centralized template management with Handlebars rendering
- **User preference management**: Fine-grained user notification preferences per template and medium
- **Scheduled notifications**: Support for cron-based schedules and reminder cadences
- **Queue-based architecture**: Asynchronous processing using AWS SQS
- **Audit trail**: Complete tracking of delivery status and read receipts
- **Webhook integration**: Callback mechanisms for external system integration

---

## 🏗️ Architecture & System Design

### 1. **Event-Driven Architecture with Queue-Based Processing**

The system follows an event-driven architecture with clear separation of concerns:

```
Client Request → REST API → Event Creation → AWS SQS Queue → Queue Listener → Event Processing → Delivery Services
```

**Key Components:**

- **QueueMessagingService**: Publishes notification events to AWS SQS FIFO queue
- **QueueListener**: Consumes messages from SQS with configurable concurrency (10 parallel consumers)
- **EventProcessingService**: Orchestrates the entire notification delivery workflow
- **DeliveryServiceFactory**: Factory pattern for medium-specific delivery services

**Why this is good:**
- **Decoupling**: API responds immediately; actual delivery happens asynchronously
- **Fault tolerance**: Messages remain in queue until successfully processed
- **Load leveling**: Queue absorbs traffic spikes
- **Scalability**: Multiple consumers can process messages in parallel

### 2. **Multi-Database Strategy (Polyglot Persistence)**

- **MongoDB**: Primary database for events, templates, schedules, preferences, audit logs
  - Ideal for flexible schema (template values, dynamic fields)
  - High write throughput for audit logs
  
- **MySQL**: Used for conversational messaging (WhatsApp chat history)
  - ACID compliance for message ordering
  - Relational integrity for conversation threads

**Design Decision**: Chose the right database for each use case rather than forcing one solution.

### 3. **Strategy Pattern for Multi-Channel Delivery**

```java
interface DeliveryService {
    Medium getMedium();
    DeliverNotificationResponseDto deliverNotification(Event, Template, List<User>);
}
```

**Implementations:**
- `EmailDeliveryService` (Postmark)
- `EmailSendGridService` (SendGrid)
- `SMSDeliveryService` (MSG91, TextLocal)
- `WhatsappDeliveryService` (Facebook Graph API)
- `AppDeliveryService` (In-app notifications)
- `SlackAlertService` (Slack webhooks)

**Why this is good:**
- **Open/Closed Principle**: Easy to add new channels without modifying existing code
- **Single Responsibility**: Each service handles one delivery medium
- **Runtime selection**: `DeliveryServiceFactory` selects appropriate service dynamically

### 4. **Template Engine Integration**

Uses **Handlebars** for template rendering:
- Dynamic template compilation with custom helpers
- Supports email subject, body, SMS, and WhatsApp templates
- Template values injected at runtime from event data

### 5. **User Preference Management**

**Hierarchical Preference System:**
1. **Master Preferences**: User's global medium preferences (email/sms/push enabled)
2. **Template Preferences**: Per-template, per-medium preferences
3. **Custom Preferences**: Override mechanism for specific use cases

**Logic**: Notification sent only if both master AND template preferences are enabled.

### 6. **Scheduled Notifications System**

**Two types of schedules:**

**A. Cron-based Schedules:**
- Recurring notifications based on cron expressions
- Example: Daily reports, weekly digests

**B. Reminder Cadences:**
- Multi-step reminder sequences
- Each cadence item specifies days/hours/minutes offset
- Example: Payment reminders at T+1 day, T+3 days, T+7 days
- Auto-archives after all cadence items are executed

**Implementation:**
- `@Scheduled` task runs every 30 seconds
- Compares current time with next execution time
- Generates events and sends to queue when schedule matches
- Tracks execution count to prevent duplicates

### 7. **Thread-based Email Conversations**

Implements **email threading** for conversation continuity:
- Maintains `threadId` for related notifications
- Tracks `References` and `In-Reply-To` headers
- Updates `NotificationThread` collection with message IDs
- Enables proper email client threading (Gmail, Outlook)

---

## 🛠️ Technology Stack

### Core Technologies
- **Java 11**: Modern Java features (var, streams, Optional)
- **Spring Boot 2.4.0**: Core framework
- **Spring Data MongoDB**: NoSQL data access
- **Spring Data JPA**: SQL data access (MySQL)
- **Spring Security**: Authentication & Authorization
- **Spring Cloud AWS**: SQS integration

### External Integrations
- **AWS SQS**: Message queue (FIFO queue for ordering)
- **SendGrid API**: Email delivery with webhooks
- **Postmark API**: Transactional email with tracking
- **MSG91 & TextLocal**: SMS delivery
- **Facebook Graph API**: WhatsApp Business messaging
- **Slack API**: Webhook-based alerting

### Utilities & Libraries
- **Handlebars**: Template engine
- **Lombok**: Boilerplate reduction
- **Apache Commons Lang3**: Utility functions
- **Gson**: JSON processing

### DevOps & Observability
- **Docker**: Multi-stage builds (dev, integration, prod)
- **Jenkins**: CI/CD pipeline with shared libraries
- **Prometheus & Micrometer**: Metrics collection
- **Spring Boot Actuator**: Health checks, metrics endpoints
- **Elastic APM**: Application Performance Monitoring
- **Log4j2**: Structured logging with async appenders
- **JaCoCo**: Code coverage (integrated with Sonar)

---

## ✨ Key Features & Technical Highlights

### 1. **Advanced Thread Pool Management**

**AsyncConfig:**
```java
@Configuration
public class AsyncConfig {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(40);
    executor.setMaxPoolSize(120);
    executor.setQueueCapacity(150);
    executor.setKeepAliveSeconds(60);
    executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
    executor.setTaskDecorator(new MDCTaskDecorator());  // Preserves logging context
    executor.setWaitForTasksToCompleteOnShutdown(true);
}
```

**Why this is good:**
- **Graceful degradation**: CallerRunsPolicy prevents task rejection
- **MDC propagation**: Maintains request tracking across async threads
- **Graceful shutdown**: Waits for tasks to complete before shutdown
- **Configurable capacity**: Tuned based on load testing

### 2. **HTTP Connection Pool Optimization**

**RestTemplateConfig:**
```java
PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
connectionManager.setMaxTotal(300);
connectionManager.setDefaultMaxPerRoute(120);
connectionManager.setValidateAfterInactivity(2000);

// Automatic connection cleanup
@Scheduled(fixedDelay = 30000)
public void connectionPoolMaintenance() {
    connectionManager.closeExpiredConnections();
    connectionManager.closeIdleConnections(30000, TimeUnit.MILLISECONDS);
}

// Connection monitoring
@Scheduled(fixedDelay = 60000)
public void logConnectionPoolStats() {
    log.info("Pool Stats - Available: {}, Leased: {}, Pending: {}", ...);
}
```

**Features:**
- **Connection pooling**: Reuses connections to external APIs
- **Keep-alive strategy**: Custom keep-alive (5 minutes)
- **Automatic cleanup**: Scheduled eviction of idle connections
- **Retry handler**: Automatic retry for transient network errors (3 retries)
- **Monitoring**: Real-time pool statistics logging

### 3. **Tomcat Performance Tuning**

```properties
server.tomcat.max-connections=8192
server.tomcat.accept-count=1000
server.tomcat.threads.max=500
server.tomcat.connection-timeout=60000
server.tomcat.max-keep-alive-requests=1000
server.compression.enabled=true
```

**Impact:**
- Handles 8192 concurrent connections
- 500 worker threads for request processing
- Response compression reduces bandwidth

### 4. **Callback Mechanism for Dynamic Data**

**Use Case**: External systems can provide notification data at delivery time.

**Flow:**
1. Client creates event with `callbackUrl`
2. At processing time, engine calls the callback URL
3. Callback returns user IDs, template values, delivery status
4. Engine validates and processes the response
5. If callback fails or returns DISABLED status, notification is not sent

**Why this is good:**
- **Just-in-time data**: Fresh data at delivery time, not creation time
- **External control**: Client can disable notifications dynamically
- **Flexibility**: Template values can be computed dynamically

### 5. **Comprehensive Audit Trail**

**Audit Model:**
- EventId, UserId, TemplateId, Medium
- Delivered (boolean), Read (boolean)
- MessageId (from provider)
- Timestamps

**Webhook Integration:**
- Postmark & SendGrid webhooks update delivery status
- Read receipts captured via open tracking
- Status callbacks sent to clients asynchronously

### 6. **Webhook Processing with Error Handling**

```java
@Async
public void sendGridWebhookHandler(List<SendGridWebhook> request) {
    // Group by email to handle multiple events per user
    Map<String, List<SendGridWebhook>> emailGrouped = request.stream()
        .collect(Collectors.groupingBy(SendGridWebhook::getEmail));
    
    // Process each user's events
    for (Map.Entry<String, List<SendGridWebhook>> entry : emailGrouped.entrySet()) {
        // Update audit records
        // Send status callbacks to clients
    }
}
```

### 7. **Schedule Completion Webhooks**

When all items in a reminder cadence are executed:
```java
CompletableFuture.runAsync(() -> {
    ScheduleCompletionWebhook webhook = ScheduleCompletionWebhook.builder()
        .setReferenceId(event.getReferenceId())
        .setTemplateId(event.getTemplateId())
        .setScheduleId(event.getScheduleId())
        .build();
    callbackUtil.scheduleCompletionWebhook(webhook, callbackUrl);
}).exceptionally(ex -> {
    logger.error("Exception occurred", ex);
    return null;
});
```

**Why this is good:**
- **Async**: Doesn't block main processing
- **Exception handling**: Failures don't break the flow
- **External notification**: Clients know when campaigns complete

### 8. **Attachment Support**

Email attachments from:
- Static attachments in template configuration
- Dynamic attachments from event
- External URLs (fetched and encoded in base64)

### 9. **Batch Operations**

- Bulk schedule fetching for multiple reference IDs
- Batch user lookup by email/phone
- Batch audit creation

### 10. **Multi-Environment Configuration**

Separate property files for:
- `application-local.properties`
- `application-dev.properties`
- `application-stage.properties`
- `application-beta.properties`
- `application-prod.properties`
- `application-test.properties`

---

## 🎯 Design Patterns & Best Practices

### Design Patterns Used

1. **Factory Pattern**: `DeliveryServiceFactory` for service selection
2. **Strategy Pattern**: `DeliveryService` interface with multiple implementations
3. **Builder Pattern**: Event, Template, and DTO construction
4. **Dependency Injection**: Constructor-based DI throughout
5. **Template Method Pattern**: Common email delivery logic with specific implementations
6. **Observer Pattern**: Webhook callbacks for delivery status updates

### Code Quality Practices

1. **Constructor Injection**: Immutable dependencies, easier testing
2. **Lombok**: Reduces boilerplate (`@Getter`, `@Setter`, `@Builder`, `@Slf4j`)
3. **Optional Usage**: Null-safe operations
4. **Stream API**: Functional programming for collections
5. **Exception Handling**: Custom exceptions (`NotificationException`, `RecurBusinessException`, `RecurSystemException`)
6. **Logging**: Structured logging with SLF4J/Log4j2
7. **DTOs**: Separate data transfer objects for API contracts
8. **Validation**: `@Valid` annotations with Spring Validation

### Testing

- **Unit Tests**: Service layer tests (11 test files)
- **Integration Tests**: Controller and adapter tests
- **JaCoCo**: Code coverage reporting
- **LogCaptor**: Testing log statements

### API Documentation

- **Swagger/OpenAPI**: Integrated with SpringFox
- Auto-generated API documentation
- Interactive API explorer

---

## 🚀 Performance & Scalability Features

### 1. **Asynchronous Processing**

- **@Async methods**: Webhook handling, callbacks, schedule processing
- **CompletableFuture**: Non-blocking async operations
- **Queue-based**: Main workflow is asynchronous via SQS

### 2. **Concurrency Configuration**

**Queue Processing:**
```properties
queue.core-pool.size=10
queue.max-pool.size=10
queue.max-messages.size=10
```

**Async Execution:**
```properties
thread.pool.core.size=40
thread.pool.max.size=120
thread.pool.queue.capacity=150
```

**Scheduled Tasks:**
```properties
spring.task.scheduling.pool.size=5
```

### 3. **Caching**

- **DeliveryService Cache**: Services cached in memory (`@PostConstruct`)
- Reduces repeated instantiation and lookup overhead

### 4. **Connection Pooling**

- **HTTP Client**: 300 total connections, 120 per route
- **Database**: Spring Boot's default HikariCP connection pool

### 5. **Monitoring & Observability**

**Prometheus Metrics:**
- JVM metrics (heap, threads, GC)
- HTTP request metrics
- Custom business metrics

**Actuator Endpoints:**
- `/actuator/health`: Health check
- `/actuator/metrics`: All metrics
- `/actuator/prometheus`: Prometheus scraping endpoint

**Elastic APM:**
- Distributed tracing
- Performance monitoring
- Error tracking

**Access Logs:**
```properties
server.tomcat.accesslog.enabled=true
server.tomcat.accesslog.pattern=%A %h %t "%r" "%{Referer}i" "%{User-Agent}i" %b %s (%D ms)
```

### 6. **Resource Management**

- Automatic connection cleanup
- Memory management (clearing large attachment lists after use)
- Graceful shutdown with task completion

---

## 🔒 Security & Reliability

### Security Features

1. **Spring Security**: Configured with custom security policies
2. **API Key Authentication**: Headers for service-to-service auth
3. **CORS Configuration**: Controlled cross-origin access
4. **Input Validation**: `@Valid` annotations on request bodies

### Reliability Features

1. **Retry Logic**: HTTP client retries for transient failures
2. **Queue Message Deletion**: `SqsMessageDeletionPolicy.ON_SUCCESS`
3. **Error Handling**: Comprehensive try-catch with logging
4. **Graceful Degradation**: CallerRunsPolicy for thread pool
5. **Event Idempotency**: Checks `isExecuted` flag to prevent duplicate delivery

---

## 📊 Production Readiness

### DevOps

- **Docker**: Multi-stage builds for different environments
- **Jenkins CI/CD**: Automated builds and deployments
- **Health Checks**: `/health/check` endpoint for load balancers
- **JVM Tuning**: `-XX:MaxRAMPercentage=75` for container environments

### Operational Features

- **Scheduled Maintenance**: Connection pool cleanup
- **Status Monitoring**: Connection pool statistics
- **Alerts**: Slack integration for critical notifications
- **Audit Trail**: Complete history of all notification attempts

---

## 🎓 What Makes This Project Stand Out

### 1. **Production-Grade Architecture**
- Not a toy project; handles real production traffic
- Multiple channels (6 delivery mediums)
- Queue-based asynchronous processing
- Comprehensive error handling and retry logic

### 2. **Advanced Concurrency Management**
- Custom thread pool configuration
- MDC propagation for distributed logging
- Graceful shutdown mechanisms
- CallerRunsPolicy for backpressure handling

### 3. **Performance Optimization**
- HTTP connection pooling with automatic maintenance
- Tomcat tuning for high concurrency (8192 connections)
- Async processing for non-blocking operations
- Scheduled cleanup tasks

### 4. **Scalability Considerations**
- Queue-based architecture (horizontal scaling)
- Stateless services (can run multiple instances)
- Connection pooling (efficient resource usage)
- Configurable thread pools per environment

### 5. **Observability**
- Prometheus metrics
- Elastic APM integration
- Structured logging with MDC
- Health check endpoints

### 6. **Flexibility & Extensibility**
- Strategy pattern for easy channel addition
- Callback mechanism for dynamic data
- Template engine for customizable content
- Multi-database strategy

### 7. **Enterprise Features**
- User preference management
- Audit trail with delivery tracking
- Email threading for conversations
- Scheduled notifications with cron and cadences
- Webhook integration for status updates

---

## 🔧 Areas for Improvement & Scalability Enhancements

### 1. **Enhanced Scalability Through Distributed Systems**

#### Current Limitation:
- Scheduled tasks run on every instance (potential duplicate execution)
- In-memory caching is per-instance (no shared cache)

#### Proposed Solutions:

**A. Distributed Scheduling:**
```java
// Use ShedLock for distributed task locking
@Scheduled(fixedRate = 30000)
@SchedulerLock(name = "scheduleNotifications", 
    lockAtMostFor = "25s", 
    lockAtLeastFor = "20s")
public void scheduleNotifications() {
    // Only one instance will execute at a time
}
```

**B. Distributed Caching:**
- Implement **Redis** for shared cache across instances
- Cache templates, user preferences, frequently accessed data
- Use Redis as a rate limiter for external API calls
- Potential for Redis-based distributed locks

**C. Database Sharding:**
- MongoDB sharding for audit logs (huge write volume)
- Shard key: `userId` or `templateId`
- Time-based partitioning for historical data

**D. Read Replicas:**
- MySQL read replicas for conversation queries
- MongoDB secondary reads for non-critical data
- Reduces load on primary databases

### 2. **Advanced Rate Limiting & Throttling**

#### Current State:
- No explicit rate limiting implemented
- Relies on external API rate limits

#### Proposed Enhancements:

**A. Distributed Rate Limiter:**
```java
// Token Bucket Algorithm with Redis
@Service
public class RateLimiterService {
    private final RedisTemplate<String, Long> redis;
    
    public boolean allowRequest(String userId, int maxRequests, Duration window) {
        String key = "rate:limit:" + userId;
        Long current = redis.opsForValue().increment(key);
        
        if (current == 1) {
            redis.expire(key, window.toMillis(), TimeUnit.MILLISECONDS);
        }
        
        return current <= maxRequests;
    }
}
```

**B. Per-Provider Rate Limiting:**
- SendGrid: 600 requests/minute
- MSG91: 1000 SMS/minute
- WhatsApp: Tiered limits based on business verification
- Implement sliding window counter in Redis

**C. Adaptive Throttling:**
- Monitor provider response codes (429 Too Many Requests)
- Exponential backoff on rate limit errors
- Circuit breaker pattern for failing providers

**D. Priority Queues:**
```java
// High-priority notifications processed first
public enum Priority {
    CRITICAL,  // Account security, fraud alerts
    HIGH,      // Transactional (OTPs, receipts)
    MEDIUM,    // Reminders, notifications
    LOW        // Marketing, newsletters
}
```
- Separate SQS queues per priority
- Weighted fair queuing algorithm

### 3. **Enhanced Concurrency & Multithreading**

#### A. **Reactive Programming with Spring WebFlux**

**Current**: Traditional blocking I/O with thread pool

**Proposed**: Non-blocking reactive streams
```java
@Service
public class ReactiveEmailService {
    private final WebClient webClient;
    
    public Mono<EmailResponse> sendEmail(EmailRequest request) {
        return webClient.post()
            .uri("/mail/send")
            .bodyValue(request)
            .retrieve()
            .bodyToMono(EmailResponse.class)
            .timeout(Duration.ofSeconds(30))
            .retry(3);
    }
    
    // Process 1000 emails concurrently without 1000 threads
    public Flux<EmailResponse> sendBulkEmails(List<EmailRequest> requests) {
        return Flux.fromIterable(requests)
            .flatMap(this::sendEmail, 100);  // 100 concurrent requests
    }
}
```

**Benefits:**
- Handle 10,000+ concurrent requests with minimal threads
- No thread pool exhaustion
- Better resource utilization
- Natural backpressure handling

#### B. **Parallel Stream Processing**

**Current**: Sequential processing within thread pool

**Proposed**: Parallel streams for batch operations
```java
// Process multiple users in parallel
Map<String, Boolean> deliveryStatus = users.parallelStream()
    .collect(Collectors.toConcurrentMap(
        User::getId,
        user -> deliverToUser(user)
    ));
```

#### C. **Virtual Threads (Java 19+)**

If upgrading to Java 19+:
```java
@Configuration
public class VirtualThreadConfig {
    @Bean
    public Executor virtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
```

**Benefits:**
- Millions of virtual threads (vs thousands of platform threads)
- Simplified concurrent code
- Better for I/O-bound operations

#### D. **Work Stealing Thread Pool**

For CPU-intensive operations (template rendering):
```java
ForkJoinPool customThreadPool = new ForkJoinPool(
    Runtime.getRuntime().availableProcessors()
);

customThreadPool.submit(() -> 
    templates.parallelStream()
        .forEach(template -> renderTemplate(template))
);
```

### 4. **Database Optimization**

#### A. **Indexing Strategy**

**Current Indexes Needed:**
```javascript
// MongoDB indexes
db.events.createIndex({ "isExecuted": 1, "createdAt": -1 })
db.events.createIndex({ "scheduleId": 1, "isExecuted": 1 })
db.audit.createIndex({ "messageId": 1, "userId": 1 })
db.audit.createIndex({ "eventId": 1 })
db.schedules.createIndex({ "type": 1, "isActive": 1, "isArchived": 1 })
db.users.createIndex({ "email": 1 })
db.users.createIndex({ "phone": 1 })
db.preferences.createIndex({ "userId": 1, "templateId": 1 })
```

#### B. **Query Optimization**

**Current**: Multiple database round trips
```java
// Anti-pattern: N+1 queries
for (String userId : userIds) {
    User user = userRepository.findById(userId);
}
```

**Optimized**: Batch queries
```java
// Single query
List<User> users = userRepository.findAllByIdIn(userIds);
```

#### C. **Capped Collections for Logs**

```javascript
// Limit audit log size
db.createCollection("audit", {
    capped: true,
    size: 5368709120,  // 5 GB
    max: 100000000     // 100M documents
})
```

#### D. **Archival Strategy**

- Move old audits to cold storage (S3)
- TTL indexes for automatic deletion
```javascript
db.audit.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 7776000 })  // 90 days
```

### 5. **Improved Queue Management**

#### A. **Dead Letter Queue (DLQ)**

```java
// SQS Configuration
@Bean
public Queue notificationQueue() {
    return QueueBuilder.durable("notification-queue")
        .withArgument("x-dead-letter-exchange", "notification-dlx")
        .withArgument("x-message-ttl", 3600000)  // 1 hour
        .build();
}

// DLQ Processor
@Scheduled(fixedDelay = 300000)  // Every 5 minutes
public void processDLQ() {
    List<String> failedEvents = sqsClient.receiveMessage("notification-dlq");
    for (String eventId : failedEvents) {
        // Log, alert, manual intervention
        slackAlertService.sendAlert("Failed event: " + eventId);
    }
}
```

#### B. **Queue Metrics & Monitoring**

```java
@Scheduled(fixedDelay = 60000)
public void monitorQueueDepth() {
    GetQueueAttributesResult attrs = sqs.getQueueAttributes(queueUrl, 
        Arrays.asList("ApproximateNumberOfMessages", 
                     "ApproximateNumberOfMessagesNotVisible"));
    
    int queueDepth = Integer.parseInt(attrs.getAttributes()
        .get("ApproximateNumberOfMessages"));
    
    if (queueDepth > 1000) {
        // Scale up consumers or alert
        slackAlertService.sendAlert("Queue depth: " + queueDepth);
    }
}
```

#### C. **Dynamic Consumer Scaling**

```java
// Auto-scale consumers based on queue depth
@Component
public class DynamicConsumerScaler {
    private SimpleMessageListenerContainer container;
    
    @Scheduled(fixedDelay = 60000)
    public void adjustConsumers() {
        int queueDepth = getQueueDepth();
        int currentConsumers = container.getActiveConsumerCount();
        
        if (queueDepth > 1000 && currentConsumers < 20) {
            container.setMaxConcurrentConsumers(20);
        } else if (queueDepth < 100 && currentConsumers > 10) {
            container.setMaxConcurrentConsumers(10);
        }
    }
}
```

### 6. **Circuit Breaker Pattern**

Implement **Resilience4j** for external service calls:

```java
@Service
public class ResilientEmailService {
    private final CircuitBreaker circuitBreaker;
    private final RateLimiter rateLimiter;
    private final Bulkhead bulkhead;
    
    @PostConstruct
    public void init() {
        circuitBreaker = CircuitBreaker.of("sendgrid", 
            CircuitBreakerConfig.custom()
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .slidingWindowSize(10)
                .build());
    }
    
    public DeliverNotificationResponseDto sendEmail(EmailRequest req) {
        return CircuitBreaker.decorateSupplier(circuitBreaker, 
            () -> sendGridClient.send(req)).get();
    }
}
```

**Benefits:**
- Prevent cascading failures
- Automatic fallback to alternative providers
- System stability during provider outages

### 7. **Bulk Processing Optimizations**

#### A. **Batch Email Sending**

**Current**: One API call per recipient
**Optimized**: Batch API calls

```java
// SendGrid batch send (up to 1000 recipients)
public void sendBulkEmail(Event event, Template template, List<User> users) {
    List<List<User>> batches = Lists.partition(users, 1000);
    
    batches.parallelStream().forEach(batch -> {
        Personalization personalization = new Personalization();
        batch.forEach(user -> personalization.addTo(new Email(user.getEmail())));
        // Single API call for 1000 users
    });
}
```

#### B. **Database Batch Writes**

```java
// Batch insert audits
public void createAuditEvents(List<Audit> audits) {
    Lists.partition(audits, 1000).forEach(batch -> {
        auditRepository.saveAll(batch);  // Bulk insert
    });
}
```

### 8. **Advanced Monitoring & Alerting**

#### A. **Custom Metrics**

```java
@Service
public class NotificationMetrics {
    private final MeterRegistry meterRegistry;
    
    public void recordDelivery(Medium medium, boolean success) {
        Counter.builder("notifications.delivered")
            .tag("medium", medium.toString())
            .tag("status", success ? "success" : "failure")
            .register(meterRegistry)
            .increment();
    }
    
    public void recordLatency(Medium medium, long millis) {
        Timer.builder("notifications.delivery.time")
            .tag("medium", medium.toString())
            .register(meterRegistry)
            .record(millis, TimeUnit.MILLISECONDS);
    }
}
```

#### B. **Distributed Tracing**

With OpenTelemetry or Zipkin:
```java
@Service
public class TracedEmailService {
    private final Tracer tracer;
    
    public void sendEmail(Event event) {
        Span span = tracer.spanBuilder("send-email")
            .setAttribute("event.id", event.getId())
            .setAttribute("template.id", event.getTemplateId())
            .startSpan();
        
        try {
            // Send email
        } finally {
            span.end();
        }
    }
}
```

### 9. **Memory & Resource Optimization**

#### A. **Object Pooling**

For expensive object creation (Handlebars templates):
```java
@Service
public class TemplatePool {
    private final GenericObjectPool<Handlebars> pool;
    
    public TemplatePool() {
        pool = new GenericObjectPool<>(new HandlebarsFactory());
        pool.setMaxTotal(100);
    }
    
    public String render(String template, Map<String, Object> context) {
        Handlebars hbs = pool.borrowObject();
        try {
            return hbs.compileInline(template).apply(context);
        } finally {
            pool.returnObject(hbs);
        }
    }
}
```

#### B. **Streaming for Large Payloads**

```java
// Instead of loading entire attachment in memory
public void sendEmailWithLargeAttachment(String fileUrl) {
    try (InputStream is = new URL(fileUrl).openStream()) {
        // Stream directly to SendGrid without loading in memory
        String base64 = Base64.getEncoder().encodeToString(
            IOUtils.toByteArray(is));
    }
}
```

### 10. **Graceful Shutdown & Zero-Downtime Deployments**

#### A. **Enhanced Graceful Shutdown**

```java
@Configuration
public class GracefulShutdownConfig {
    
    @PreDestroy
    public void onShutdown() {
        // 1. Stop accepting new messages from queue
        listenerContainer.stop();
        
        // 2. Wait for in-flight tasks to complete
        threadPoolExecutor.shutdown();
        threadPoolExecutor.awaitTermination(30, TimeUnit.SECONDS);
        
        // 3. Close all connections
        connectionManager.shutdown();
    }
}
```

#### B. **Health Check with Readiness Probe**

```java
@Component
public class CustomHealthIndicator implements HealthIndicator {
    
    @Override
    public Health health() {
        // Check database connectivity
        // Check queue connectivity
        // Check memory pressure
        
        if (isShuttingDown) {
            return Health.down().withDetail("reason", "shutting down").build();
        }
        
        return Health.up().build();
    }
}
```

---

## 🎤 Interview Talking Points

### When discussing scalability:

1. **Current Architecture**: 
   - "We use a queue-based architecture which naturally allows horizontal scaling"
   - "Our stateless services can scale horizontally behind a load balancer"

2. **Thread Management**: 
   - "We have separate thread pools for API requests, queue processing, and scheduled tasks"
   - "Using CallerRunsPolicy provides backpressure handling"

3. **Connection Management**: 
   - "HTTP connection pooling with 300 max connections and automatic cleanup"
   - "Prevents connection exhaustion and improves latency"

4. **Database Strategy**: 
   - "Using MongoDB for flexible schema and high write throughput"
   - "MySQL for ACID compliance where needed (conversations)"

5. **Async Processing**: 
   - "Heavy operations like webhooks and callbacks are @Async"
   - "CompletableFuture for non-blocking async operations"

### When discussing improvements:

1. **Rate Limiting**: 
   - "Currently rely on provider limits, but would implement Redis-based distributed rate limiter"
   - "Token bucket algorithm for smooth rate limiting"

2. **Reactive Programming**: 
   - "Would migrate to Spring WebFlux for non-blocking I/O"
   - "Handle 10x more concurrent connections with same resources"

3. **Circuit Breaker**: 
   - "Resilience4j for fault tolerance"
   - "Fallback to alternative email provider if primary fails"

4. **Monitoring**: 
   - "Already have Prometheus, would add custom business metrics"
   - "Distributed tracing for end-to-end request flow"

5. **Distributed Locking**: 
   - "ShedLock for distributed scheduled tasks"
   - "Prevents duplicate execution in multi-instance deployment"

### Discussing concurrency:

1. **Current State**:
   - "40 core threads, 120 max, 150 queue capacity"
   - "Queue consumers: 10 parallel consumers"
   - "Tomcat: 500 threads, 8192 max connections"

2. **Advanced Techniques**:
   - "Virtual threads for massive concurrency with minimal resources"
   - "Work stealing pools for CPU-intensive operations"
   - "Parallel streams for batch processing"

3. **Trade-offs**:
   - "Thread pools vs reactive: threads easier to debug, reactive better scalability"
   - "Connection pool size: balance between resource usage and latency"

---

## 📝 Summary

This Notification Engine demonstrates:
- **Production-grade architecture** with real-world complexity
- **Multi-channel integration** with external providers
- **Advanced concurrency** through thread pools and async processing
- **Scalability** via queue-based architecture and connection pooling
- **Observability** with metrics, logging, and APM
- **Extensibility** through design patterns and clean architecture

The proposed improvements show **deep understanding** of:
- Distributed systems (Redis, sharding, replication)
- Concurrency patterns (reactive, virtual threads, parallel streams)
- Reliability patterns (circuit breakers, rate limiting, retries)
- Performance optimization (caching, batching, pooling)

This positions you as a **senior engineer** who not only builds systems but also thinks about scalability, reliability, and operational excellence.

