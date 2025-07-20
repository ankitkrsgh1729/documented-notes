# Database Fundamentals - Interview Reference Notes

## ACID Properties

### Atomicity
**Definition**: All operations in a transaction succeed or fail together - no partial transactions.

**Real-world significance**: 
- Prevents corrupted data states (e.g., money transfer where debit happens but credit fails)
- Critical for financial systems, e-commerce checkout, inventory management
- Example: Bank transfer must either complete fully or not at all

**Detailed Example - Money Transfer**:
```sql
BEGIN TRANSACTION;
  UPDATE accounts SET balance = balance - 100 WHERE account_id = 'A123'; -- Debit
  UPDATE accounts SET balance = balance + 100 WHERE account_id = 'B456'; -- Credit
COMMIT; -- Both succeed
-- OR
ROLLBACK; -- Both fail if any error occurs
```

**How it's handled**:
- Database maintains transaction log before making changes
- If credit fails after debit succeeds, database automatically rolls back the debit
- Application sees either complete success or complete failure
- No intermediate state where money disappears or gets duplicated

**Implementation**: Database uses transaction logs and rollback mechanisms

---

### Consistency
**Definition**: Database remains in a valid state before and after transactions, following all defined rules.

**Real-world significance**:
- Enforces business rules and data integrity constraints
- Prevents invalid data entry (e.g., negative account balance, duplicate email addresses)
- Essential for maintaining data quality across large systems

**Detailed Examples**:

**Preventing Negative Balance**:
```sql
ALTER TABLE accounts 
ADD CONSTRAINT check_positive_balance 
CHECK (balance >= 0);

-- This transaction will fail:
UPDATE accounts SET balance = balance - 1000 
WHERE account_id = 'A123' AND balance = 500;
-- Error: violates check constraint
```

**Enforcing Unique Email**:
```sql
ALTER TABLE users 
ADD CONSTRAINT unique_email UNIQUE (email);

-- Second user with same email fails:
INSERT INTO users (name, email) VALUES ('John', 'john@email.com'); -- Success
INSERT INTO users (name, email) VALUES ('Jane', 'john@email.com'); -- Fails
```

**Foreign Key Integrity**:
```sql
-- Cannot create order for non-existent customer
INSERT INTO orders (customer_id, product) 
VALUES (99999, 'Laptop'); -- Fails if customer 99999 doesn't exist
```

**Implementation**: Foreign key constraints, check constraints, triggers

---

### Isolation
**Definition**: Concurrent transactions don't interfere with each other.

**Real-world significance**:
- Prevents race conditions in multi-user applications
- Critical for systems with high concurrent usage (social media, booking systems)
- Example: Two users booking the last available seat shouldn't both succeed

**Detailed Example - Concert Ticket Booking**:

**Without Proper Isolation** (Race Condition):
```
Time    User A                          User B
T1      SELECT seats WHERE available=1  
T2                                      SELECT seats WHERE available=1
T3      Both see 1 available seat
T4      UPDATE seats SET available=0    
T5                                      UPDATE seats SET available=0
T6      Both think they got the seat!
```

**With Proper Isolation**:
```sql
-- User A's transaction
BEGIN TRANSACTION;
SELECT seats FROM concert_seats 
WHERE seat_number = 'A1' AND available = 1 
FOR UPDATE; -- Locks the row

UPDATE concert_seats 
SET available = 0, customer_id = 123 
WHERE seat_number = 'A1';
COMMIT;

-- User B's transaction waits until A completes, then sees seat as unavailable
```

**Implementation**: Locking mechanisms, isolation levels, MVCC (Multi-Version Concurrency Control)

---

### Durability
**Definition**: Committed transactions persist even after system failures.

**Real-world significance**:
- Guarantees data survival through crashes, power failures, hardware issues
- Essential for mission-critical applications (medical records, financial transactions)
- Builds user trust - once confirmed, data won't disappear

**Detailed Example - E-commerce Order**:

**Scenario**: Customer places order, pays, server crashes immediately after COMMIT

**How Durability Ensures Data Safety**:
```sql
BEGIN TRANSACTION;
INSERT INTO orders (customer_id, total, status) VALUES (123, 299.99, 'paid');
INSERT INTO order_items (order_id, product_id, quantity) VALUES (1001, 456, 2);
UPDATE inventory SET quantity = quantity - 2 WHERE product_id = 456;
COMMIT; -- At this point, changes are guaranteed to survive crashes
-- Server crashes here
-- On restart: order data is still there, payment is recorded
```

**How it works**:
- Before COMMIT returns success, data is written to disk (not just memory)
- Write-Ahead Logging (WAL): Changes logged to disk before data pages updated
- On restart after crash, database replays logs to restore committed transactions
- Customer's order and payment are intact even though server crashed

**Implementation**: Write-ahead logging, disk-based storage, replication

---

## Relational vs NoSQL Databases

### Relational Databases (RDBMS)
**Characteristics**:
- Structured data in tables with predefined schema
- ACID compliance
- SQL query language
- Strong consistency

**When to use**:
- Complex relationships between data entities
- Need for strong consistency and data integrity
- Complex queries and reporting requirements
- Financial systems, ERP, CRM applications

**Examples**: PostgreSQL, MySQL, Oracle, SQL Server

**Trade-offs**:
- ✅ Data integrity, mature ecosystem, standardized SQL
- ❌ Limited horizontal scaling, rigid schema changes

---

### NoSQL Databases

#### Document Stores
**Characteristics**: Store data as documents (JSON/BSON format)
**When to use**: Content management, catalogs, user profiles
**Example**: MongoDB
**Significance**: Flexible schema for rapidly evolving applications

#### Key-Value Stores  
**Characteristics**: Simple key-value pairs, extremely fast
**When to use**: Caching, session storage, real-time recommendations
**Example**: Redis, DynamoDB
**Significance**: Ultra-low latency for simple operations

#### Column-Family
**Characteristics**: Data stored in column families, optimized for writes
**When to use**: Time-series data, IoT applications, logging
**Example**: Cassandra, HBase
**Significance**: Handles massive write volumes and horizontal scaling

#### Graph Databases
**Characteristics**: Data stored as nodes and relationships
**When to use**: Social networks, recommendation engines, fraud detection
**Example**: Neo4j
**Significance**: Optimized for relationship queries and pattern matching

---

## Data Modeling Principles

### Entity-Relationship (ER) Modeling
**Purpose**: Visual representation of data structure and relationships

**Key Components**:
- **Entities**: Objects or concepts (Customer, Order, Product)
- **Attributes**: Properties of entities (name, email, price)
- **Relationships**: Connections between entities (Customer places Order)

**Real-world significance**: 
- Helps stakeholders understand data structure
- Prevents design flaws before implementation
- Serves as documentation for development teams

---

### Relationship Types

#### One-to-One (1:1)
**Example**: User ↔ User Profile
**When to use**: Sensitive data separation, optional attributes
**Significance**: Improves security and performance by splitting large tables

#### One-to-Many (1:N)
**Example**: Customer → Orders (one customer, many orders)
**When to use**: Most common relationship type
**Significance**: Represents hierarchical data structures efficiently

#### Many-to-Many (M:N)
**Example**: Students ↔ Courses (students take multiple courses, courses have multiple students)
**Implementation**: Requires junction/bridge table
**Significance**: Handles complex business relationships

---

### Data Modeling Best Practices

#### Choose Appropriate Data Types
**Significance**: 
- Optimizes storage space and query performance
- Prevents data type conversion overhead
- Ensures data validation at database level

#### Establish Clear Naming Conventions
**Significance**:
- Improves code maintainability
- Reduces developer confusion
- Enables better collaboration across teams

#### Define Primary and Foreign Keys
**Significance**:
- Ensures data uniqueness and referential integrity
- Enables efficient joins and queries
- Prevents orphaned records

#### Consider Future Growth
**Significance**:
- Design for scalability from the beginning
- Avoid costly refactoring later
- Plan for performance as data volume grows

---

## Interview Tips

### Common Questions:
1. "Explain ACID properties with real-world examples"
2. "When would you choose NoSQL over SQL?"
3. "How do you handle many-to-many relationships?"
4. "What's the difference between isolation levels?"

### Key Points to Remember:
- Always connect technical concepts to business value
- Use concrete examples from real applications
- Understand trade-offs between different approaches
- Know when to break rules (denormalization for performance)