# HLD Interview Revision Notes - E-commerce Platform (5+ YOE)

## 📚 **Overview**
These notes cover key architectural concepts for senior-level system design interviews, focusing on technical depth and real-world trade-offs discussed during architecture review.

---

## 🔄 **Service Communication Patterns**

### **Order → Payment Service Flow**
**❓ Question:** How does Payment Service know when to execute an order?

**✅ Answer:** 
- **Synchronous Call**: Order Service → Payment Service (during order creation)
- **Business Logic**: Order creation triggers immediate payment processing
- **Response Flow**: Payment success/failure determines order confirmation
- **Event Publishing**: After payment, both services publish events for notifications

```
Order Creation Flow:
1. User places order → Order Service
2. Order Service → Payment Service (SYNC API call)
3. Payment Service → External Gateway (Stripe/PayPal)
4. Payment response → Order Service
5. Both publish events → Kafka → Notification Service
```

**🎯 Interview Tip:** Always explain the business logic behind service communication patterns.

---

## 🗄️ **Database-per-Service Architecture**

### **Cross-Service Data Access Challenge**
**❓ Question:** If services have separate databases, how do we handle joins?

**✅ Answer:** This is the fundamental microservices trade-off:

#### **Lost Capabilities:**
- ❌ SQL joins across services
- ❌ ACID transactions across services
- ❌ Referential integrity across boundaries

#### **Solutions:**
1. **API Composition**: Service A calls Service B's API
2. **Data Duplication**: Store denormalized data (eventual consistency)
3. **Event Sourcing**: Maintain read models with aggregated data
4. **CQRS**: Separate read/write models

**Example Scenario:**
```sql
-- This won't work in microservices:
SELECT o.order_id, u.username, u.email 
FROM orders o 
JOIN users u ON o.user_id = u.user_id

-- Solution: API composition
1. Order Service gets order data
2. Order Service calls User Service API with user_id
3. Combine responses in application layer
```

**🎯 Interview Key:** "We trade ACID guarantees for service independence and scalability."

---

## 📄 **Flexible Schema - MongoDB vs PostgreSQL**

### **When to Choose Document Database**
**❓ Question:** Why use MongoDB for user preferences instead of PostgreSQL?

**✅ Answer:** Schema evolution and nested data structures.

#### **PostgreSQL Limitation:**
```sql
-- Rigid structure requires schema migrations
CREATE TABLE user_preferences (
    user_id INT,
    email_notifications BOOLEAN,
    sms_notifications BOOLEAN,
    theme VARCHAR(20)
);

-- Every new preference needs schema change:
ALTER TABLE user_preferences ADD COLUMN dark_mode BOOLEAN;
```

#### **MongoDB Flexibility:**
```javascript
// User 1 - Basic preferences
{
  "user_id": "123",
  "notifications": {"email": true, "sms": false},
  "theme": "light"
}

// User 2 - Complex nested preferences (no schema change needed)
{
  "user_id": "456",
  "notifications": {
    "email": true,
    "push": {
      "order_updates": true,
      "promotions": false,
      "price_drops": true
    },
    "quiet_hours": {"start": "22:00", "end": "08:00"}
  },
  "ui": {
    "theme": "dark",
    "dashboard_layout": ["orders", "wishlist"],
    "items_per_page": 50
  }
}
```

**🎯 Interview Key:** "Different users have different preference complexity - document databases handle schema variation naturally."

---

## 🔴 **Redis Cluster Architecture & Failure Modes**

### **3 Masters + 3 Replicas Configuration**
**❓ Question:** What happens to user data when a master+replica pair fails?

**✅ Realistic Answer:** 
```
Data Distribution:
Master 1 (Slots 0-5460) + Replica 1    → 33% of data
Master 2 (Slots 5461-10922) + Replica 2 → 33% of data  
Master 3 (Slots 10923-16383) + Replica 3 → 33% of data

If Master 1 + Replica 1 both fail:
❌ 33% of cached data becomes unavailable
✅ 66% of cached data still accessible
⚠️  Application must handle cache misses gracefully
```

#### **Majority/Quorum Concept:**
```
Why 3 Masters minimum:
- 3 masters: Need 2 votes for decisions (majority possible)
- 2 masters: Split-brain risk (1-1 vote, no majority)
- 1 master: Single point of failure

Network Partition Example:
[Master 1, Master 2] | [Master 3]
Left: 2/3 majority → continues operating
Right: 1/3 minority → stops accepting writes
```

**🎯 Interview Key:** "Redis provides high availability, not high durability. Plan for partial data loss."

---

## 🌍 **Geographic Distribution & DNS Routing**

### **Load Balancer Geographic Strategy**
**❓ Question:** Does a request from Nigeria go to India's load balancer first?

**✅ Correct Flow:**
```
❌ Wrong: Nigeria → India LB → Routes back to Nigeria (high latency)

✅ Correct: 
Nigeria User → DNS Resolution (Route 53) → Returns closest LB IP → Lagos/London LB
```

#### **How Geographic Routing Works:**
```
Step 1 - DNS Resolution:
User types: www.ecommerce.com
└── Route 53 checks user location (Nigeria)
    └── Returns IP of closest regional LB
        └── Lagos/London datacenter LB IP

Step 2 - Direct Routing:
Nigeria User → London Regional LB → London AZ services
```

#### **Regional Distribution:**
```
Global Infrastructure:
├── North America: us-east-1, us-west-2
├── Europe: eu-west-1, eu-central-1  
├── Asia: ap-southeast-1, ap-northeast-1
└── Africa: af-south-1 (or failover to eu-west-1)

Latency Impact:
- Same region: ~20-50ms
- Cross-region: ~150-300ms
- Geographic routing reduces latency by 40%
```

**🎯 Interview Key:** "DNS is the first layer of geographic optimization, not load balancers."

---

## 🔍 **Elasticsearch Cluster Deep Dive**

### **3-Node Cluster Architecture**
**❓ Question:** What does "3-node cluster" mean in Elasticsearch?

**✅ Answer:** Sharding, replication, and quorum for search.

#### **Data Distribution:**
```
Index: "products" (1TB of data)
├── Primary Shard 0 (Node 1) → Replica Shard 0 (Node 2)
├── Primary Shard 1 (Node 2) → Replica Shard 1 (Node 3)  
└── Primary Shard 2 (Node 3) → Replica Shard 2 (Node 1)

Each shard replicated across nodes:
- Primary handles writes and reads
- Replica provides backup on different node
- If Node 1 fails → Replica on Node 2 becomes primary
```

#### **Search Query Distribution:**
```
User searches "iPhone":
├── Node 1: Searches Shard 0 + Shard 2 (replica)
├── Node 2: Searches Shard 1 + Shard 0 (replica)
└── Node 3: Searches Shard 2 + Shard 1 (replica)

Results merged from all shards → returned to user
```

#### **Quorum Prevention:**
```
3 nodes prevent split-brain:
- Need majority (2/3) for cluster decisions
- 2 nodes risk split-brain (1-1 vote)
- 1 node = single point of failure
```

**🎯 Interview Key:** "Elasticsearch distributes both data (sharding) and compute (search) across nodes."

---

## 📨 **Event-Driven Architecture Patterns**

### **Synchronous vs Asynchronous Communication**
**❓ Question:** When to use sync vs async communication?

**✅ Decision Matrix:**

#### **Synchronous (REST API calls):**
```
Use Cases:
✅ User authentication (immediate response needed)
✅ Payment processing (transaction integrity)
✅ Real-time inventory checks
✅ Order creation (user waits for confirmation)

Characteristics:
- Immediate response required
- Business logic coupling acceptable
- Error handling in request/response cycle
```

#### **Asynchronous (Kafka Events):**
```
Use Cases:
✅ Email notifications (user doesn't wait)
✅ Analytics data collection
✅ Audit trail logging
✅ Cache invalidation
✅ Inventory updates after order

Characteristics:
- Fire-and-forget operations
- Eventual consistency acceptable
- Loose coupling between services
- Higher throughput possible
```

#### **Event Types in E-commerce:**
```
Order Service Events:
- OrderCreated, OrderConfirmed, OrderCancelled

Payment Service Events:  
- PaymentProcessed, PaymentFailed, RefundIssued

Inventory Service Events:
- StockUpdated, LowStockAlert, ProductOutOfStock

User Service Events:
- UserRegistered, UserProfileUpdated
```

**🎯 Interview Key:** "Sync for business-critical flows, async for everything else."

---

## 🌐 **CDN & Traffic Routing Patterns**

### **What Goes Through CDN vs Direct**
**❓ Question:** Do all user requests go through CDN?

**✅ Answer:** Only static and cacheable content.

#### **CDN Traffic:**
```
✅ Goes through CDN:
- Static assets (images, CSS, JS)
- Product images and media
- Cacheable API responses (product catalogs)
- Public documentation/help pages

❌ Bypasses CDN:
- Dynamic API calls (orders, payments)
- User-specific data (cart, profile)
- POST/PUT/DELETE requests
- Real-time data (search suggestions)
```

#### **Routing Logic:**
```
Static Request Flow:
User → CDN → (cache hit) → User
User → CDN → (cache miss) → Origin Server → CDN → User

Dynamic Request Flow:
User → DNS → Regional LB → API Gateway → Services
```

**🎯 Interview Key:** "CDN for static/cacheable content, direct routing for dynamic/personalized content."

---

## 🔐 **Authentication & Authorization Architecture**

### **JWT Validation: API Gateway vs User Service**
**❓ Question:** Who validates JWT tokens?

**✅ Answer:** Layered approach with different responsibilities.

#### **API Gateway Validation:**
```
Responsibilities:
✅ JWT signature validation (is token valid?)
✅ Token expiration check
✅ Basic claims extraction (user_id, roles)
✅ Rate limiting per user
✅ Request routing based on roles

Fast Operations:
- Cryptographic signature verification
- Timestamp validation
- Header parsing
```

#### **User Service Validation:**
```
Responsibilities:
✅ User existence check (is user still active?)
✅ Fine-grained permissions
✅ User profile data enrichment
✅ Account status validation

Database Operations:
- User account status lookup
- Permission matrix evaluation
- Profile data retrieval
```

#### **Typical Flow:**
```
1. API Gateway: Validates JWT signature/expiration
2. API Gateway: Extracts user_id from token
3. User Service: Validates user is active
4. User Service: Returns user context
5. Business Service: Processes request with user context
```

**🎯 Interview Key:** "API Gateway for token validation, User Service for user validation."

---

## 📊 **Performance & Scalability Patterns**

### **Auto-scaling Triggers & Metrics**
```
CPU-based Scaling:
- Scale out when CPU > 70%
- Scale in when CPU < 30%

Memory-based Scaling:
- Scale out when memory > 80%
- Scale in when memory < 40%

Application-level Metrics:
- Request queue length > 100
- Error rate > 5%
- Response time P95 > 500ms

Predictive Scaling:
- Historical traffic patterns
- Scheduled events (Black Friday)
- Time-based scaling (lunch hour traffic)
```

### **Database Scaling Strategies**
```
Read Scaling:
Primary DB (writes) → Read Replicas (reads)
- Route read queries to replicas
- Distribute read load across multiple replicas

Write Scaling:
Horizontal Sharding:
- User Shard 1: user_id % 3 = 0
- User Shard 2: user_id % 3 = 1  
- User Shard 3: user_id % 3 = 2

Geographic Sharding:
- US Shard: North American users
- EU Shard: European users
- APAC Shard: Asia-Pacific users
```

**🎯 Interview Key:** "Scale reads with replicas, scale writes with sharding."

---

## ⚖️ **System Design Trade-offs**

### **Key Architectural Decisions**

#### **Microservices vs Monolith:**
```
Microservices (Chosen):
✅ Independent scaling
✅ Technology diversity
✅ Team autonomy
✅ Fault isolation
❌ Network latency
❌ Distributed complexity
❌ Data consistency challenges

When to choose: Large teams, different scaling needs, mature DevOps
```

#### **SQL vs NoSQL:**
```
PostgreSQL (Orders, Users, Payments):
✅ ACID transactions
✅ Complex queries and joins
✅ Mature ecosystem
❌ Horizontal scaling complexity
❌ Schema rigidity

MongoDB (User Preferences):
✅ Flexible schema
✅ Horizontal scaling
✅ Document queries
❌ Limited ACID guarantees
❌ Eventual consistency
```

#### **Consistency Models:**
```
Strong Consistency (ACID):
- Financial transactions
- Inventory management
- User authentication

Eventual Consistency (BASE):
- User preferences
- Analytics data
- Product catalogs
- Notification logs
```

---

## 🎯 **Interview Success Tips**

### **How to Present These Concepts:**

1. **Start Simple**: Begin with basic architecture, add complexity gradually
2. **Justify Decisions**: Always explain "why" behind each choice
3. **Show Trade-offs**: Acknowledge what you're giving up for what you gain
4. **Use Numbers**: Provide specific metrics (latency, throughput, storage)
5. **Handle Scale**: Discuss how system evolves with 10x, 100x growth
6. **Consider Operations**: Address monitoring, debugging, deployment

### **Common Interview Flows:**
```
1. Requirements Gathering (15 mins)
2. High-level Architecture (20 mins) 
3. Deep Dive on 2-3 Components (30 mins)
4. Scale & Performance Discussion (10 mins)
5. Q&A and Edge Cases (10 mins)
```

### **Key Phrases for Interviews:**
- "Let me start with the simplest approach and then optimize..."
- "There's a trade-off here between X and Y..."
- "At this scale, we need to consider..."
- "For a 5+ year experienced team, I'd recommend..."
- "The failure mode here would be..."

---

## 📚 **Additional Study Areas**

### **For Deeper Preparation:**
1. **Consistency Patterns**: CAP theorem, ACID vs BASE
2. **Caching Strategies**: Write-through, write-behind, cache-aside
3. **Message Queue Patterns**: Pub/sub, fan-out, dead letter queues
4. **Security Patterns**: OAuth 2.0, API gateway security, encryption
5. **Monitoring**: Distributed tracing, metrics collection, alerting

### **System Design Interview Books:**
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "System Design Interview" by Alex Xu
- "Building Microservices" by Sam Newman

---

**🚀 Good luck with your HLD interview! These concepts demonstrate senior-level understanding of distributed systems architecture.**