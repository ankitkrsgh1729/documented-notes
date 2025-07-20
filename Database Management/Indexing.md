# DBMS Indexing & Query Optimization - Interview Reference

## **INDEX FUNDAMENTALS**

### What is a Database Index?
- **Definition**: Data structure that improves query performance by creating shortcuts to data
- **Analogy**: Like a book's index - points to where information is located without scanning everything
- **Trade-off**: 
  - ✅ Faster SELECT queries (reads)
  - ❌ Slower INSERT/UPDATE/DELETE (writes)
  - ❌ Additional storage space
- **Key Point**: Indexes are **separate structures** that point to actual data

### Index Selectivity
**Most Selective Index** = Index that filters out the most rows
```sql
-- Table: 1 million users
-- user_id (unique) → Very selective (1 row)
-- status ('active'/'inactive') → Not selective (500K rows each)
-- city ('New York', 'LA', etc.) → Moderately selective (10K-50K rows)

-- Query planner chooses user_id index because it's most selective
```

### B-Tree vs Binary Search Tree
**B-Tree** ≠ Binary Search Tree
- **Binary Tree**: Each node has ≤ 2 children
- **B-Tree**: Each node has many children (often 100-1000)
- **Why B-Tree for databases**: 
  - Minimizes disk I/O (fewer levels to traverse)
  - Better for range scans (leaf nodes are linked)
  - Handles large datasets efficiently

---

## **INDEX TYPES**

### Clustered vs Non-Clustered Indexes

**Clustered Index**:
- **Physical Storage**: Data rows stored in index key order on disk
- **Limit**: Only ONE per table (because data can only be stored in one order)
- **Example**: Primary key in most databases
- **Performance**: Faster for range queries (data is physically sequential)

```sql
-- Clustered index on employee_id
-- Data physically stored like: [1][2][3][4][5]...
SELECT * FROM employees WHERE employee_id BETWEEN 100 AND 200;
-- Very fast - reads sequential disk blocks
```

**Non-Clustered Index**:
- **Structure**: Separate structure with pointers to actual data rows
- **Limit**: Multiple allowed per table
- **Process**: Index lookup → Get row pointer → Fetch actual data
- **Performance**: Extra step makes it slightly slower

```sql
-- Non-clustered index on last_name
-- Index: [Adams→Row#47][Brown→Row#12][Smith→Row#203]
-- Two-step process: find in index, then fetch row
```

**Key Interview Point**: "In InnoDB, every table has a clustered index (usually PK). Non-clustered indexes store the primary key value instead of row pointers."

---

## **CORE INTERVIEW QUESTIONS**

### Q1: When would you NOT create an index?

**Bad Scenarios**:
- **Small tables** (< 1000 rows) - full scan faster than index overhead
- **Low selectivity columns** - boolean with 50/50 distribution
- **Heavy write workloads** - index maintenance slows INSERTs
- **Frequently updated columns** - constant index updates

**Real Example**: 
> "In a real-time logging system with 1M inserts/minute, I avoided indexing the 'log_level' column (only 5 values) because write performance was critical and queries could filter other ways."

### Q2: Left-most Prefix Rule (Composite Indexes)

```sql
-- Index: (last_name, first_name, age)
CREATE INDEX idx_name_age ON employees(last_name, first_name, age);
```

**Efficient Queries** (Uses Index):
```sql
WHERE last_name = 'Smith'                                    -- ✅ Uses index
WHERE last_name = 'Smith' AND first_name = 'John'           -- ✅ Uses index  
WHERE last_name = 'Smith' AND first_name = 'John' AND age = 25  -- ✅ Uses index
WHERE last_name = 'Smith' AND age = 25                      -- ✅ Partial use
```

**Inefficient Queries** (Cannot Use Index):
```sql
WHERE first_name = 'John'                    -- ❌ Skips leftmost column
WHERE age = 25                              -- ❌ Skips leftmost columns  
WHERE first_name = 'John' AND age = 25      -- ❌ Skips leftmost column
```

**Why Later Columns Are Inefficient**:
- Index is sorted first by last_name, then first_name, then age
- Without last_name, database can't know where to start looking
- Like trying to find "John" in a phone book without knowing the last name

### Q3: EXPLAIN vs EXPLAIN ANALYZE

**EXPLAIN** (Estimated Plan):
```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- Output:
-- Index Scan using idx_user_id on orders  (cost=0.43..8.45 rows=1 width=84)
--   Index Cond: (user_id = 123)
```
- Shows **estimated** costs and row counts
- **Fast** - doesn't execute the query
- **Use for**: Quick checks, production safety

**EXPLAIN ANALYZE** (Actual Execution):
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- Output:
-- Index Scan using idx_user_id on orders  (cost=0.43..8.45 rows=1 width=84) 
--   (actual time=0.025..0.027 rows=1 loops=1)
--   Index Cond: (user_id = 123)
-- Planning Time: 0.123 ms
-- Execution Time: 0.045 ms
```
- Shows **actual** execution metrics
- **Slower** - actually runs the query
- **Use for**: Performance debugging, optimization verification

**Key Difference**: EXPLAIN shows what planner *thinks* will happen, ANALYZE shows what *actually* happened

### Q4: Design Indexing Strategy (Simple Example)

**Scenario**: E-commerce orders table
```sql
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,      -- Already has clustered index
    user_id BIGINT,
    status VARCHAR(20),               -- 'pending', 'shipped', 'delivered'
    created_date TIMESTAMP,
    total_amount DECIMAL(10,2)
);
```

**Common Query Patterns**:
1. User's recent orders: `WHERE user_id = ? ORDER BY created_date DESC`
2. Pending orders: `WHERE status = 'pending' ORDER BY created_date`
3. Daily sales: `WHERE created_date BETWEEN ? AND ?`

**Optimized Index Strategy**:
```sql
-- 1. For user-specific queries (most frequent)
CREATE INDEX idx_user_date ON orders(user_id, created_date DESC);

-- 2. For status-based queries  
CREATE INDEX idx_status_date ON orders(status, created_date DESC);

-- 3. Partial index for active orders (filtering optimization)
CREATE INDEX idx_active_orders ON orders(created_date DESC) 
WHERE status IN ('pending', 'processing');
```

**Reasoning**: 
- "I prioritized the most frequent access patterns (user queries)"
- "Used partial indexes for filtering commonly excluded data (completed orders)"
- "Avoided over-indexing by combining related columns in composite indexes"

### Q5: Index Bloat and Monitoring

**What is Index Bloat?**
- **Definition**: When indexes become fragmented and contain empty/unused space
- **Causes**: Frequent UPDATEs and DELETEs create fragmented pages
- **Impact**: Larger index size, slower scans, wasted memory

**Detection Methods**:
```sql
-- PostgreSQL: Check index bloat
SELECT 
    schemaname, tablename, indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_size_pretty(pg_total_relation_size(indrelid)) as table_size
FROM pg_stat_user_indexes 
ORDER BY pg_relation_size(indexrelid) DESC;

-- Look for: index_size / table_size ratio > 0.3 (suspicious)
```

**Where to Monitor**:
- **Database dashboards**: Grafana, DataDog, CloudWatch
- **Built-in tools**: pg_stat_statements, MySQL Performance Schema
- **Custom scripts**: Regular bloat detection queries

**Fix Index Bloat**:
```sql
-- PostgreSQL (recommended - no downtime)
REINDEX INDEX CONCURRENTLY idx_name;

-- MySQL  
ALTER TABLE table_name DROP INDEX idx_name, ADD INDEX idx_name(columns);

-- Oracle
ALTER INDEX idx_name REBUILD ONLINE;
```

### Q6: Query Planner Cost Estimation Issues

**How Planner Works**:
- Estimates I/O costs, CPU costs, memory usage
- Uses table statistics (row counts, data distribution)
- Chooses plan with lowest estimated cost

**Common Failures**:

1. **Stale Statistics**:
```sql
-- Problem: Table grew from 1K to 1M rows, but stats not updated
-- Planner still thinks table is small → chooses wrong plan

-- Solution:
ANALYZE table_name;  -- Update statistics
```

2. **Correlated Columns**:
```sql
-- Problem: Planner assumes independence
SELECT * FROM users WHERE city = 'NYC' AND state = 'NY';
-- Planner: "30% live in NY, 5% in NYC, so 1.5% match both"
-- Reality: "Everyone in NYC lives in NY, so 5% match"
```

3. **Wrong Join Order**:
```sql
-- Bad plan: Large table first
SELECT * FROM orders o JOIN users u ON o.user_id = u.id 
WHERE u.subscription = 'premium';  -- Only 1% of users

-- Good plan: Filter users first, then join
```

### Q7: Debugging Slow Query Performance

**Systematic Investigation**:

1. **Current vs Historical Plans**:
```sql
-- Check if execution plan changed
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
-- Compare with baseline from yesterday
```

2. **Statistics Freshness**:
```sql
-- PostgreSQL: Check when stats were last updated
SELECT schemaname, tablename, last_analyze, last_autoanalyze 
FROM pg_stat_user_tables WHERE tablename = 'your_table';

-- If stale, update:
ANALYZE your_table;
```

3. **Lock Contention**:
```sql
-- PostgreSQL: Check for blocking queries
SELECT blocked_locks.pid, blocked_activity.query as blocked_query,
       blocking_locks.pid as blocking_pid, blocking_activity.query as blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

4. **Resource Monitoring**:
- **I/O Wait**: High disk activity
- **CPU Usage**: Complex calculations
- **Memory**: Large sorts, hash operations

**Real Example**: 
> "Query was fast yesterday but slow today. Found that auto-vacuum hadn't run, causing bloated table. Manual VACUUM ANALYZE fixed it immediately."

### Q8: Search Functionality Indexes

**Full-Text Search Basics**:

**GIN Index** (Generalized Inverted Index):
- **Purpose**: Efficiently searches within complex data types
- **Use cases**: Full-text search, JSON data, arrays
- **Structure**: Maps each word → list of documents containing it

**to_tsvector Function**:
```sql
-- Converts text to searchable tokens
SELECT to_tsvector('english', 'The quick brown fox jumps');
-- Result: 'brown':3 'fox':4 'jump':5 'quick':2
-- (removes stop words like 'the', stems words)
```

**gin_trgm_ops** (Trigram Operator Class):
- **Purpose**: Fuzzy/partial matching using 3-character combinations
- **Example**: "hello" becomes trigrams: "  h", " he", "hel", "ell", "llo", "o  "
- **Use case**: Autocomplete, typo tolerance

**Implementation**:
```sql
-- 1. Full-text search for semantic matching
CREATE INDEX idx_products_search ON products 
USING GIN(to_tsvector('english', name || ' ' || description));

-- Query:
SELECT * FROM products 
WHERE to_tsvector('english', name || ' ' || description) @@ plainto_tsquery('english', 'laptop gaming');

-- 2. Trigram search for partial/fuzzy matching  
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_products_trigram ON products 
USING GIN(name gin_trgm_ops);

-- Query:
SELECT * FROM products WHERE name % 'laptp';  -- Finds "laptop" despite typo
```

### Q9: Microservices Indexing Strategy

**Key Considerations**:

1. **Service Boundaries**:
   - Each service owns its database and indexing strategy
   - No cross-service joins at database level
   - Service-specific optimization

2. **Data Duplication vs API Calls**:
```sql
-- Option 1: Duplicate frequently needed data
CREATE TABLE order_service.orders (
    order_id BIGINT,
    user_id BIGINT,
    user_email VARCHAR(255),  -- Duplicated from user service
    status VARCHAR(20)
);
CREATE INDEX idx_orders_email ON orders(user_email);  -- Can search by email

-- Option 2: Keep normalized, use API calls
CREATE TABLE order_service.orders (
    order_id BIGINT,
    user_id BIGINT,  -- Must call user service to get email
    status VARCHAR(20)
);
```

3. **Event-Driven Index Updates**:
```sql
-- When user updates email in user service:
-- 1. Update user_service.users table
-- 2. Publish event: {"user_id": 123, "new_email": "new@email.com"}
-- 3. Order service consumes event and updates denormalized data
UPDATE order_service.orders SET user_email = 'new@email.com' WHERE user_id = 123;
```

4. **Distributed Monitoring**:
- Service-specific performance dashboards
- Cross-service query tracing (Jaeger, Zipkin)
- Aggregate slow query detection

---

## **ADVANCED CONCEPTS**

### Understanding Index Pages

**What Are Index Pages?**
- **Definition**: Fixed-size storage units (typically 8KB in PostgreSQL, 16KB in MySQL)
- **Structure**: Each page contains multiple index entries plus metadata
- **Analogy**: Like pages in a book - each page holds multiple entries, pages are linked together

**Page Structure Example**:
```
┌─────────── INDEX PAGE (8KB) ───────────┐
│ Header: Page info, free space pointer │
│ ─────────────────────────────────────── │
│ [10] → Row Location                    │
│ [20] → Row Location                    │
│ [30] → Row Location                    │  ← Index entries
│ [40] → Row Location                    │
│ [50] → Row Location                    │
│ ─────────────────────────────────────── │
│ Free Space (for new entries)          │
│ ─────────────────────────────────────── │
│ Footer: Checksum, page version        │
└────────────────────────────────────────┘
```

**Why Pages Matter**:
- **I/O Unit**: Database reads entire pages, not individual records
- **Cache Unit**: Buffer cache stores complete pages
- **Performance**: More entries per page = fewer I/O operations

### Index Fragmentation Deep Dive

**How Fragmentation Happens**:

**1. Initial State (Healthy)**:
```
Page Utilization: 90-95%
┌─────────────────────────────────┐
│ [10] [20] [30] [40] [50] [60]  │ ← 6 entries, almost full
└─────────────────────────────────┘
```

**2. After DELETE Operations**:
```sql
DELETE FROM users WHERE id IN (20, 40);
```
```
Page Utilization: 60%
┌─────────────────────────────────┐
│ [10] [__] [30] [__] [50] [60]  │ ← Empty spaces, but page still allocated
└─────────────────────────────────┘
```

**3. After UPDATE Operations** (Worst Case):
```sql
-- Update that changes index key or value size
UPDATE users SET email = 'very_long_new_email@company.com' WHERE id = 30;
```
```
Page Utilization: 40%
┌─────────────────────────────────┐
│ [10] [__] [__] [__] [50] [60]  │ ← Record moved to different page
└─────────────────────────────────┘
```

**Real-World Bloat Impact**:
- **Before**: 100MB index, 1000 pages, 200 records/page
- **After 6 months**: 200MB index, 2000 pages, 80 records/page
- **Result**: Same data, double I/O operations, worse cache efficiency

### Adding Index on Live Production Table

**Traditional vs CONCURRENTLY Approach**:

**1. Standard Index Creation** (❌ Blocks Production):
```sql
CREATE INDEX idx_name ON large_table(column);
-- Acquires ShareLock - blocks all INSERTs, UPDATEs, DELETEs
-- Can take hours on large tables
```

**2. CONCURRENTLY Process** (✅ Safe for Production):
```sql
CREATE INDEX CONCURRENTLY idx_name ON large_table(column);
```

**CONCURRENTLY Deep Dive - The 3-Phase Process**:

**Phase 1 - Initial Build** (Most Time):
- Scans entire table to build index structure
- Allows all normal operations (SELECT, INSERT, UPDATE, DELETE)
- Creates index but marks it as "not ready for use"
- Duration: 80-90% of total time

**Phase 2 - Catch Up** (Brief Lock):
- Acquires brief ShareUpdateExclusiveLock (allows SELECTs, blocks schema changes)
- Processes all changes that happened during Phase 1
- Updates index to include missed entries
- Duration: Seconds to minutes

**Phase 3 - Activation**:
- Marks index as "ready for use"
- Query planner can now use the index
- No additional locks required

**Why CONCURRENTLY Takes 2-3x Longer**:
- Must track and apply concurrent changes
- More conservative approach with safety checks
- Additional validation phases

**Monitoring CONCURRENTLY Progress**:
```sql
-- PostgreSQL: Check progress
SELECT 
    pid, datname, command, 
    phase, blocks_total, blocks_done,
    ROUND(100.0 * blocks_done / blocks_total, 2) AS percent_done
FROM pg_stat_progress_create_index;
```

**Handling CONCURRENTLY Failures**:
```sql
-- If CONCURRENTLY fails, it leaves an invalid index
SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_name';
-- Shows index but marked as INVALID

-- Must drop and retry:
DROP INDEX CONCURRENTLY idx_name;  -- Clean up
CREATE INDEX CONCURRENTLY idx_name ON table(column);  -- Retry
```

### ASC vs DESC Index Creation

**Physical Storage Impact**:

**ASC Index (Default)**:
```sql
CREATE INDEX idx_salary_asc ON employees(salary ASC);
```
```
Index Pages (Left to Right):
[30K] [35K] [40K] [45K] [50K] [55K] [60K] [65K] [70K]
  ↑                                              ↑
Low values                                 High values
```

**DESC Index**:
```sql
CREATE INDEX idx_salary_desc ON employees(salary DESC);
```
```
Index Pages (Left to Right):  
[70K] [65K] [60K] [55K] [50K] [45K] [40K] [35K] [30K]
  ↑                                              ↑
High values                                Low values
```

**Performance Impact Examples**:

**Query: Top 10 Highest Salaries**:
```sql
SELECT * FROM employees ORDER BY salary DESC LIMIT 10;
```
- **With DESC Index**: Read first page, get 10 entries ✅ (Optimal)
- **With ASC Index**: Scan to rightmost page, read backwards ❌ (Suboptimal)

**Query: Salary Range**:
```sql
SELECT * FROM employees WHERE salary BETWEEN 50000 AND 60000;
```
- **Both ASC/DESC**: Similar performance (range scan)

**Composite Index Sort Orders**:
```sql
-- Most recent orders first, but within same date, lowest amount first
CREATE INDEX idx_orders ON orders(created_date DESC, amount ASC);
```
**Storage Pattern**:
```
[2024-03-15, $10] [2024-03-15, $25] [2024-03-15, $50]  ← Same date, amount ASC
[2024-03-14, $15] [2024-03-14, $30] [2024-03-14, $75]  ← Previous date
[2024-03-13, $20] [2024-03-13, $40] [2024-03-13, $60]  ← Even older
```

**Perfect Match Query**:
```sql
SELECT * FROM orders ORDER BY created_date DESC, amount ASC LIMIT 20;
-- Uses index scan efficiently - matches exact storage order
```

**Practical Decision Guide**:
- **Use ASC** when most queries need oldest/lowest values first
- **Use DESC** when most queries need newest/highest values first  
- **Consider both** if you have mixed access patterns (trade storage for performance)

### Relational vs Non-Relational Database Indexing

| Aspect | Relational (SQL) | Non-Relational (NoSQL) |
|--------|------------------|------------------------|
| **Index Types** | B-tree, Hash, GIN, GiST, Bitmap | Varies by DB: B-tree (MongoDB), Inverted (Elasticsearch), LSM-tree (Cassandra) |
| **Consistency** | Strong consistency, ACID compliance | Eventual consistency, indexes may lag |
| **Query Optimization** | Sophisticated cost-based planners | Simpler, often rule-based |
| **Index Structure** | Normalized schema, multiple indexes | Denormalized, fewer indexes needed |
| **Distribution** | Single-node optimization | Distributed across multiple nodes |
| **Specialized Features** | SQL standard compliance | Database-specific: Full-text (ES), Geospatial (MongoDB) |
| **Maintenance** | Manual/automatic statistics updates | Often self-managing, background compaction |

---

## **QUICK REFERENCE**

### Index Decision Tree
```
Query Pattern Analysis:
├── Single column, equality? → B-tree index
├── Single column, range? → B-tree index  
├── Multiple columns, used together? → Composite index
├── Full-text search? → GIN/full-text index
├── Geospatial data? → GiST/spatial index
└── Low selectivity? → Consider not indexing

Write vs Read Trade-off:
├── Heavy reads, light writes? → More indexes
├── Heavy writes, light reads? → Fewer indexes
└── Mixed workload? → Focus on most critical queries
```

### Performance Red Flags
- Sequential scans on large tables
- High buffer cache misses
- Long lock wait times
- Unused indexes taking up space
- Frequent index rebuilds needed

### Before Production Deployment
1. Test index on production-sized data
2. Measure write performance impact
3. Plan rollback strategy
4. Monitor query performance changes
5. Update application query patterns if needed