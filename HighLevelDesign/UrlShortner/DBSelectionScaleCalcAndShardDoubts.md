# URL Shortener System Design - Scaling & Database Notes

## 1. Database Choice Analysis

### Relational Database (PostgreSQL/MySQL) - Primary Choice

**Why RDBMS for URL Shortener?**
- **ACID Compliance**: Must prevent duplicate short codes
- **Structured Data**: Simple schema (short_code, original_url, user_id, created_at)
- **Strong Consistency**: URL mappings cannot be eventually consistent
- **Query Flexibility**: Need complex queries (by user, date ranges, analytics)
- **Mature Ecosystem**: Well-understood sharding, replication, backup strategies

**Schema Design:**
```sql
urls {
  id: BIGINT PRIMARY KEY
  short_code: VARCHAR(10) UNIQUE
  original_url: TEXT
  user_id: BIGINT
  created_at: TIMESTAMP
  expires_at: TIMESTAMP
  is_custom: BOOLEAN
}
```

### DynamoDB Alternative Analysis

**Why Some Choose DynamoDB:**
- **Managed Service**: No database administration overhead
- **Auto-scaling**: Handles traffic spikes automatically
- **Global Tables**: Multi-region replication built-in
- **Performance**: Consistent single-digit millisecond latency
- **Cost**: Pay-per-request pricing model

**DynamoDB Schema Design:**
```yaml
Table: urls
Partition Key: short_code (String)
Sort Key: None (single item per partition)

Attributes:
- short_code: "abc123"
- original_url: "https://example.com/very/long/url"
- user_id: "user_456"
- created_at: "2024-01-15T10:30:00Z"
- expires_at: "2024-02-15T10:30:00Z"
- is_custom: true
```

**DynamoDB Partition Key Strategy:**
- **Partition Key**: `short_code` ensures even distribution
- **Why this works**: Short codes are randomly generated → uniform distribution across partitions
- **Scaling**: DynamoDB automatically splits partitions when they exceed 10GB or 3000 RCU/1000 WCU

**DynamoDB vs RDBMS Trade-offs:**

| Factor | RDBMS | DynamoDB |
|--------|-------|----------|
| **Consistency** | ACID, Strong | Eventually Consistent (default) |
| **Complex Queries** | SQL, Joins, Aggregations | Limited, No joins |
| **Scaling** | Manual sharding | Auto-scaling |
| **Cost** | Fixed (servers) | Variable (usage-based) |
| **Operations** | High maintenance | Fully managed |
| **Analytics** | Native support | Requires additional services |

**Recommendation**: 
- **RDBMS**: If you need complex analytics, strong consistency, and have database expertise
- **DynamoDB**: If you want managed service, predictable performance, and simple access patterns

## 2. Connection Pool Calculations Clarification

### Database Connections vs Concurrent Users

**Common Misconception**: Concurrent users ≠ Database connections

**Reality**: Connection pooling reduces database connections significantly

**Calculation Breakdown:**
```yaml
Concurrent Users: 100M (people using the service simultaneously)
Active Requests: ~1M (users actively making requests at any moment)
Database Connections per Server: 50-100 connections
Total Servers: 500 servers
Total DB Connections: 500 servers × 50 connections = 25,000 connections

Database Connection Limits:
- MySQL: ~5,000 max connections per instance
- PostgreSQL: ~8,000 max connections per instance

Sharding Solution:
- 10 database shards
- Connections per shard: 25,000 ÷ 10 = 2,500 connections per shard ✓
```

**Why Connection Pooling Works:**
- HTTP requests are short-lived (50-200ms)
- Database connections are reused across requests
- 1 connection can serve 100+ requests per second
- Connection pools maintain 20-100 persistent connections per server

## 3. Redis: Single Instance vs Cluster

### Single Redis Instance
```yaml
Configuration:
- One Redis server
- Single point of failure
- Memory limit: ~100GB per instance
- Max QPS: ~100,000 operations/sec
- Use case: Small to medium applications
```

**Limitations:**
- **Memory**: Cannot exceed single server memory
- **Performance**: Single thread for commands
- **Availability**: Server failure = total cache loss
- **Network**: Single network interface bottleneck

### Redis Cluster
```yaml
Configuration:
- Multiple Redis nodes (typically 6+ nodes)
- Data sharded across nodes
- No single point of failure
- Memory: 100GB × 6 nodes = 600GB total
- Max QPS: 100,000 × 6 nodes = 600,000 operations/sec
```

**Redis Cluster Benefits:**
- **Horizontal Scaling**: Add nodes to increase capacity
- **High Availability**: Master-replica setup per shard
- **Data Sharding**: Automatic key distribution using hash slots
- **Fault Tolerance**: Cluster continues operating if few nodes fail

**Hash Slot Distribution:**
- Redis Cluster uses 16,384 hash slots
- Each key mapped to slot: `CRC16(key) % 16384`
- Slots distributed evenly across master nodes
- Example: 3 masters → ~5,461 slots per master

## 4. Route 53 Geographic Detection

### How Route 53 Determines User Location

**Method 1: EDNS Client Subnet (ECS)**
- User's DNS resolver includes subnet information in query
- Route 53 sees approximate geographic location
- Routes to nearest healthy endpoint

**Method 2: Resolver IP Geolocation**
- Route 53 identifies the DNS resolver's IP address
- Maps resolver IP to geographic region
- Assumes user is near their DNS resolver

**Example Flow:**
```yaml
User in Tokyo → Uses ISP DNS (203.0.113.0) 
→ Route 53 detects Japanese IP range 
→ Returns ap-northeast-1 load balancer IP
→ User connects to Tokyo data center
```

**Route 53 Routing Policies for URL Shortener:**

1. **Geolocation Routing**: Send users to nearest region
2. **Weighted Routing**: Distribute load across regions
3. **Health Checks**: Failover to healthy regions only
4. **Latency-based Routing**: Route to lowest latency endpoint

## 5. Database Partitioning: Physical Data Structure

### How Partitioned Data Looks

**Single Table (Before Partitioning):**
```yaml
Table: urls (10 billion rows)
├── Row 1: {id: 1, short_code: "abc123", created_at: "2024-01-15"}
├── Row 2: {id: 2, short_code: "def456", created_at: "2024-01-20"}
├── Row 3: {id: 3, short_code: "ghi789", created_at: "2024-02-01"}
├── ...
└── Row 10B: {id: 10000000000, created_at: "2024-12-31"}
```

**After Partitioning (Logical Single Table, Physical Multiple Tables):**
```yaml
Logical Table: urls (same SQL interface)

Physical Storage:
├── urls_p_2024_01 (500M rows - January data)
├── urls_p_2024_02 (520M rows - February data)  
├── urls_p_2024_03 (480M rows - March data)
├── ...
└── urls_p_2024_12 (510M rows - December data)
```

**Query Behavior:**
- **Query**: `SELECT * FROM urls WHERE created_at >= '2024-03-01'`
- **Database Engine**: Automatically queries only `urls_p_2024_03` onwards
- **Performance**: Scans 3-4 partitions instead of entire 10B row table

**Partition Pruning Example:**
```yaml
Query: "Show URLs created in February 2024"

Without Partitioning:
- Scans: 10 billion rows
- Time: 45 seconds
- I/O: Reads entire table from disk

With Partitioning:
- Scans: Only urls_p_2024_02 partition (520M rows)
- Time: 2.3 seconds  
- I/O: Reads only February partition from disk
```

## 6. Cache Strategy Theory

### L1 Cache (Application Memory) - 1GB per instance

**What Goes Here:**
- Ultra-hot URLs (>1,000 requests/hour)
- Recently accessed content (last 10 minutes)
- Small payloads only (<2KB)
- Content accessed multiple times per second

**Why L1 Cache:**
- **Speed**: Memory access ~1ns (fastest possible)
- **No Network**: No Redis network calls
- **Cost**: Uses existing application server memory
- **Reliability**: Survives Redis outages

**Examples:**
- Viral social media posts
- Breaking news links  
- Live event URLs
- Popular product launches

### L2 Cache (Redis) - 100GB cluster

**What Goes Here:**
- Popular URLs (>10 requests/hour)
- URLs accessed in last 24 hours
- Larger content that doesn't fit L1
- Session data and rate limiting counters

**Why L2 Cache:**
- **Capacity**: 100x larger than L1
- **Persistence**: Survives application restarts
- **Shared**: Multiple application instances share cache
- **Features**: TTL, atomic operations, pub/sub

**Examples:**
- Popular blog articles
- Trending social media content
- Company landing pages
- Marketing campaign URLs

### L3 Cache (SSD-based) - 1TB capacity

**What Goes Here:**
- Warm data (accessed in last week)
- Historical popular content
- Seasonal content (holiday links)
- Backup cache for Redis failures

**Why L3 Cache:**
- **Cost**: SSD cheaper than RAM
- **Capacity**: 10x larger than L2
- **Durability**: Persistent across server reboots
- **Failover**: Backup when higher caches fail

## 7. Why Do We Need Database Shards?

### The Fundamental Problem: Single Database Limitations

**Physical Constraints of Single Database:**
```yaml
MySQL/PostgreSQL Limits:
- Max connections: ~5,000 concurrent connections
- Max QPS: ~10,000 QPS (for complex queries)
- Max storage: ~10TB (before performance degrades)
- Max memory: ~1TB RAM (physical server limit)
- Single CPU bottleneck for write operations
```

**Our URL Shortener Requirements:**
```yaml
System Needs:
- Total QPS: 234,000 (23x database limit)
- Storage: 90TB over 5 years (9x storage limit) 
- Concurrent connections: 25,000 (5x connection limit)
- Write throughput: 2,315 writes/sec (manageable, but combined with reads = problem)
```

**Mathematical Reality:**
- **Single DB can handle**: 10,000 QPS maximum
- **We need**: 234,000 QPS 
- **Minimum shards required**: 234,000 ÷ 10,000 = 24 shards
- **Practical with safety margin**: 30-50 shards

### Horizontal Sharding Solution

**Load Distribution with 10 Shards:**
```yaml
Before Sharding (Single DB):
- Total load: 234,000 QPS → Database crashes
- Storage: 90TB → Exceeds single server capacity
- Connections: 25,000 → Exceeds connection limit

After Sharding (10 Database Shards):
- Per shard load: 234,000 ÷ 10 = 23,400 QPS ✓ (within limits)
- Per shard storage: 90TB ÷ 10 = 9TB ✓ (manageable)
- Per shard connections: 25,000 ÷ 10 = 2,500 ✓ (within limits)
```

### Sharding Strategy for URL Shortener

**Hash-based Sharding by short_code:**
```yaml
Shard Selection Logic:
- Shard ID = hash(short_code) % number_of_shards
- Example: hash("abc123") % 10 = Shard 3
- Even distribution: Random short codes → uniform shard distribution
```

**Why short_code is Perfect Sharding Key:**
- **Random Distribution**: Base62 encoding creates uniform hash distribution
- **No Hot Spots**: Unlike user_id or timestamp, no natural clustering
- **Query Efficiency**: Most queries lookup by short_code (primary use case)
- **No Cross-Shard Queries**: Each URL lookup hits exactly one shard

### Real-World Scaling Example

**Twitter's Approach (Hypothetical Scale):**
```yaml
Twitter Scale:
- Tweets per day: 500M
- Reads per day: 50B (timeline views)
- QPS needed: ~578,000 QPS
- Storage per tweet: ~1KB

Without Sharding:
- Single database max: 10,000 QPS
- Required capacity: 578,000 QPS
- Result: 58x over capacity → System failure

With Sharding (100 shards):
- Per shard: 5,780 QPS ✓ (manageable)
- Horizontal scaling: Add more shards as needed
- Fault tolerance: 1 shard failure ≠ total system failure
```

### Sharding Trade-offs

**Benefits:**
- **Linear Scaling**: 2x shards = 2x capacity
- **Fault Isolation**: One shard failure doesn't affect others  
- **Performance**: Smaller datasets per shard = faster queries
- **Maintenance**: Can upgrade/maintain shards individually

**Drawbacks:**
- **Complexity**: Need routing logic and database proxy
- **Cross-shard Queries**: Cannot join data across shards
- **Rebalancing**: Adding/removing shards is complex
- **Operational Overhead**: Multiple databases to monitor and maintain

## 8. System Design Math - Standard Calculations

### Step 1: Traffic Estimation
```yaml
DAU: 100M users
URLs per user per day: 2
Total URLs created daily: 200M
Seconds per day: 86,400
Write QPS: 200M ÷ 86,400 = 2,315 writes/sec
Read:Write ratio: 100:1
Read QPS: 2,315 × 100 = 231,500 reads/sec
```

### Step 2: Storage Calculation  
```yaml
URL record size: ~250 bytes
Daily storage: 200M × 250 bytes = 50GB/day
Monthly storage: 50GB × 30 = 1.5TB/month
5-year retention: 1.5TB × 12 × 5 = 90TB total
```

### Step 3: Cache Memory Calculation
```yaml
Active URLs daily: ~500M unique URLs accessed
Hot URLs (top 20%): 100M URLs need caching
Cache storage: 100M × 250 bytes = 25GB
Redis overhead (3x): 75GB
Safety margin: 75GB × 1.3 = 100GB cluster
```

### Step 4: Server Instance Calculation
```yaml
Target QPS per server: 1,000 
Total QPS needed: 231,500 + 2,315 = ~234,000
Base servers needed: 234,000 ÷ 1,000 = 234
Safety factor (2x): 234 × 2 = 468 servers
Round up: 500 application servers
```

### Step 5: Network Bandwidth Calculation
```yaml
Request Analysis:
- Average request size: 1KB (HTTP headers + URL data)
- Average response size: 0.5KB (redirect response + headers)
- Total QPS: 234,000

Incoming Bandwidth:
- 234,000 QPS × 1KB = 234MB/sec
- Convert to Gbps: 234MB/sec × 8 = 1.87 Gbps

Outgoing Bandwidth:
- 234,000 QPS × 0.5KB = 117MB/sec  
- Convert to Gbps: 117MB/sec × 8 = 0.94 Gbps

Total Bandwidth per Region: 1.87 + 0.94 = 2.81 Gbps
Safety Factor (2x): ~6 Gbps per region

Multi-Region Distribution:
- Primary region (60% traffic): 6 × 0.6 = 3.6 Gbps
- Secondary region (30% traffic): 6 × 0.3 = 1.8 Gbps  
- Tertiary region (10% traffic): 6 × 0.1 = 0.6 Gbps
```

**Bandwidth Cost Estimation:**
```yaml
Cloud Provider Pricing (AWS example):
- Data transfer out: ~$0.09 per GB
- Monthly outbound traffic: 117MB/sec × 2.6M seconds = 304TB
- Monthly bandwidth cost: 304TB × $90 = ~$27,000/month
- Annual bandwidth cost: ~$324,000/year
```

## 9. Key Takeaways

1. **Database Choice**: RDBMS for consistency, DynamoDB for managed scaling
2. **Connections**: Use connection pooling, don't confuse with concurrent users
3. **Redis Cluster**: Horizontal scaling, high availability vs single instance
4. **Route 53**: Geographic routing based on DNS resolver location
5. **Partitioning**: Logical single table, physical multiple tables for performance
6. **Cache Tiers**: L1 (ultra-hot), L2 (popular), L3 (warm) based on access patterns
7. **Math**: Always start with DAU, calculate QPS, then derive infrastructure needs