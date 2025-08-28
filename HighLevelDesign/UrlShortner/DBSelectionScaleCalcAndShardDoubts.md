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

## 2. Connection Pool Calculations - Deep Dive

### What Are Database Connections?

**Database Connection Definition:**
- TCP socket connection between application server and database
- Persistent connection that stays open for multiple queries
- Each connection consumes memory on both client (app server) and server (database)
- Used to send SQL queries and receive results

**Connection Pool Example:**
```yaml
Application Server Process:
├── Connection Pool (50 connections total)
│   ├── 5 connections → Database Shard 1
│   ├── 5 connections → Database Shard 2
│   ├── 5 connections → Database Shard 3
│   ├── ... (5 connections to each of 10 shards)
│   └── 5 connections → Database Shard 10
└── Handles 1000+ HTTP requests using these 50 DB connections
```

### Database Connections vs Concurrent Users

**Why Only 50-100 Connections Per Server?**
- **HTTP Request Lifecycle**: 50-200ms duration
- **Connection Reuse**: 1 DB connection serves 10-20 HTTP requests/second
- **Memory Overhead**: Each connection uses ~8MB RAM on database server
- **Context Switching**: Too many connections slow down database performance

**Connection Distribution Calculation:**
```yaml
Total System:
- 500 Application Servers
- 50 connections per server
- 10 Database Shards
- All servers must connect to all shards (for any short_code access)

Per Server Distribution:
- 50 total connections ÷ 10 shards = 5 connections per shard per server

Total Connections Per Shard:
- 500 servers × 5 connections per server = 2,500 connections per shard ✓

Why All Servers Connect to All Shards:
- Any server might process any short_code (e.g., "abc123")
- Server calculates: hash("abc123") % 10 = Shard 7
- Server needs connection to Shard 7 to retrieve URL
- Cannot predict which shard needed until request arrives
```

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

### The Fundamental Problem: Single Database Limitations

**Physical Constraints of Single Database (Where These Numbers Come From):**

**Max Connections (~5,000):**
```yaml
MySQL Configuration Limits:
- Default max_connections: 151
- Practical production limit: 1,000-5,000 (depends on RAM)
- Each connection uses ~8MB RAM on database server
- 5,000 connections × 8MB = 40GB RAM just for connections
- Beyond 5,000: Connection overhead dominates, performance degrades

PostgreSQL Similar Limits:
- Default max_connections: 100  
- Production max: 200-8,000 (depending on server specs)
- Each connection: ~10MB RAM + file descriptors
```

**Max QPS (~10,000):**
```yaml
Database Performance Factors:
- Disk I/O: Even SSD has ~50,000 IOPS limit
- Complex queries: JOINs, aggregations reduce QPS significantly  
- Simple SELECT by primary key: ~10,000-50,000 QPS possible
- Mixed workload (reads + writes): ~5,000-15,000 QPS realistic
- Network saturation: 1Gbps network = ~8,000 QPS for 1KB responses

Industry Benchmarks:
- MySQL (m5.xlarge): ~10,000 QPS for simple queries
- PostgreSQL (similar hardware): ~8,000-12,000 QPS
- These are single-instance limits, not clustered
```

**Max Storage (~10TB before performance degradation):**
```yaml
Database Performance vs Size:
- Index size grows with data size
- Query planning time increases exponentially  
- Backup/restore times become impractical
- Memory can't cache working set (index + hot data)

Practical Limits:
- MySQL single table: 256TB theoretical, ~5-10TB practical
- PostgreSQL: Similar limits due to index management overhead
- Beyond 10TB: Queries slow down, maintenance windows too long
```

**Max Memory (~1TB):**
```yaml
Single Server Hardware Limits:
- AWS largest instance (x1e.32xlarge): 3.9TB RAM ($26,000/month)
- Typical production servers: 64-512GB RAM  
- Cost grows exponentially beyond 1TB
- Single point of failure for entire dataset
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

**Step 1: Traffic Estimation**
```yaml
DAU: 100M users
URLs per user per day: 2
Total URLs created daily: 200M
Seconds per day: 86,400
Write QPS: 200M ÷ 86,400 = 2,315 writes/sec
Read:Write ratio: 100:1
Read QPS: 2,315 × 100 = 231,500 reads/sec
Total daily read requests: 231,500 QPS × 86,400 seconds = 20B requests/day
```

### Step 2: Storage Calculation  
```yaml
URL record size: ~250 bytes
Daily storage: 200M × 250 bytes = 50GB/day
Monthly storage: 50GB × 30 = 1.5TB/month
5-year retention: 1.5TB × 12 × 5 = 90TB total
```

### Step 3: Cache Memory Calculation - How We Decided 500M Active URLs

**Power Law Distribution in URL Access:**
```yaml
Total URLs in system: 3B URLs (accumulated over years)
URLs created daily: 200M new URLs
Key Question: How many DIFFERENT URLs are accessed daily?

Reality: Most URLs are accessed only by their creators + few friends
Only small fraction becomes viral content
```

**How We Determine URL Counts (1M, 10M, 500M):**

**Method 1: Reverse Engineering from Traffic Patterns**
```yaml
Given: 20B total requests per day need to be distributed across URLs

Working Backwards:
If average viral URL gets 12,000 requests/day:
- Viral URL count = (60% of traffic) ÷ 12,000 requests per URL
- Viral URL count = 12B requests ÷ 12,000 = 1M URLs

If average popular URL gets 600 requests/day:  
- Popular URL count = (30% of traffic) ÷ 600 requests per URL
- Popular URL count = 6B requests ÷ 600 = 10M URLs

If average regular URL gets 4 requests/day:
- Regular URL count = (10% of traffic) ÷ 4 requests per URL  
- Regular URL count = 2B requests ÷ 4 = 500M URLs
```

**Method 2: Industry Pattern Analysis**
```yaml
Real-world URL Shortener Patterns (based on bit.ly, TinyURL data):

Viral Content (0.1% of URLs, 60% of traffic):
- Breaking news, celebrity posts, viral videos
- Shared millions of times across social media
- Lifespan: Hours to days
- Count estimation: 0.1% of 200M daily URLs = 200K URLs
- But viral URLs from previous days still get traffic
- Rolling 7-day window: 200K × 7 = ~1.4M URLs
- Conservative estimate: 1M viral URLs getting heavy traffic

Popular Content (1% of URLs, 30% of traffic):
- Trending articles, popular blog posts, company announcements  
- Shared thousands of times
- Lifespan: Days to weeks
- Rolling 30-day window: 1% × 200M × 30 = 60M URLs
- But not all stay popular full 30 days
- Effective count: ~10M URLs

Regular Content (remaining URLs, 10% of traffic):
- Personal links, niche content, work documents
- Shared with small groups (family, coworkers, friends)
- Most URLs created are in this category
- Account for: 200M new daily + previous days still accessed
- Rolling window of actively accessed regular URLs: ~500M
```

**Method 3: Zipf Distribution (Mathematical Model)**
```yaml
Zipf's Law for Web Content:
- Rank 1 URL gets X views
- Rank 2 URL gets X/2 views  
- Rank 3 URL gets X/3 views
- And so on...

Applied to URL Shortener:
- Top 1M URLs (ranks 1-1,000,000): Get 60% of traffic
- Next 10M URLs (ranks 1M-11M): Get 30% of traffic
- Remaining URLs (ranks 11M+): Get 10% of traffic

This mathematical distribution matches real-world observations
```

**Cache Sizing Strategy - Why Multi-Tier Approach:**

**L1 Cache (Application Memory) - 250MB per server:**
```yaml
Content: 1M hottest URLs only
Why L1: Fastest access (nanoseconds), no network calls
Storage: 1M URLs × 250 bytes = 250MB per application server
Total L1 across all servers: 250MB × 500 servers = 125GB total
```

**L2 Cache (Redis) - THIS is our Redis cluster:**
```yaml
Content: 10M popular URLs (excludes L1 content to avoid duplication)
Why L2: Shared across servers, survives app restarts, sub-millisecond access
Storage needed: 10M URLs × 250 bytes = 2.5GB for data
Redis overhead (3x for hashes, expire timers, indexes): 2.5GB × 3 = 7.5GB
Safety margin: 7.5GB × 1.3 = ~10GB Redis cluster

This is our actual Redis requirement: 10GB, NOT 400GB!
```

**L3 Cache (SSD-based storage) - 125GB:**
```yaml
Content: 500M regular URLs (warm data backup)
Why L3 needed:
- Cost: SSD storage ~$0.10/GB vs Redis ~$0.50/GB (5x cheaper)
- Capacity: Can store 50x more data than Redis for same cost
- Redundancy: If Redis fails, L3 prevents database overload
- Performance: SSD access ~1-5ms vs Database ~50ms (10x faster)

Why not put everything in Redis:
- 500M URLs × 250 bytes × 3x overhead = 375GB Redis needed
- Cost: 375GB Redis ≈ $200,000/year vs 125GB SSD ≈ $15,000/year
- Diminishing returns: 500M URLs accessed only 4 times/day each
```

**Corrected Cache Architecture:**
```yaml
L1 (App Memory): 250MB × 500 servers = 125GB total system memory
L2 (Redis Cluster): 10GB cluster (our main Redis requirement)
L3 (SSD Cache): 125GB distributed SSD storage  

Total Infrastructure:
- Redis cluster size: 10GB (much smaller than 400GB!)
- SSD cache servers: 125GB distributed storage
- Cost-optimized approach: Right storage tier for right access patterns
```

**Why This Tier Strategy Works:**
```yaml
Cache Hit Ratios:
- L1 hit ratio: 60% (hottest URLs served from memory)
- L2 hit ratio: 30% (popular URLs served from Redis)  
- L3 hit ratio: 9% (warm URLs served from SSD)
- Database queries: 1% (only for new/cold URLs)

Performance Benefits:
- 60% requests: <1ms response (L1)
- 30% requests: 1-2ms response (L2)  
- 9% requests: 5-10ms response (L3)
- 1% requests: 50-100ms response (Database)
- Overall: 99% requests served under 10ms
```

**Validation Approaches:**
- **Industry Benchmarks**: bit.ly reports similar power law distributions
- **Zipf's Law**: Web traffic follows s-curve distribution
- **Cache Hit Analysis**: Monitor actual access patterns in production

### Step 4: Server Instance Calculation - How We Decided 1,000 QPS

**Hardware Assumptions (Typical Cloud Instance):**
```yaml
Server Specifications:
- CPU: 8-16 cores (e.g., AWS c5.4xlarge)
- Memory: 32-64GB RAM  
- Network: 10 Gbps network interface
- Storage: SSD-backed
```

**Per Request Resource Analysis:**
```yaml
URL Shortener Request Processing:
1. Receive HTTP request: Parse headers, extract short_code
2. Hash calculation: hash(short_code) % num_shards  
3. Database lookup: Single SELECT query via connection pool
4. Send HTTP response: 302 redirect or JSON response

Resource Usage Per Request:
- CPU time: ~1-2ms (simple operations, no complex business logic)
- Memory: ~1KB per request (request object + minimal state)
- Network: ~1.5KB total (0.5KB incoming + 1KB outgoing)
- Database connection: Reuse existing connection (~0.1ms to acquire from pool)
```

**What is "2ms CPU time" and "8,000ms CPU capacity":**

**CPU Time Explained:**
```yaml
2ms CPU Time Per Request means:
- CPU spends 2 milliseconds of actual processing time per HTTP request
- This includes: parsing HTTP, hash calculation, database query processing
- Measured as "wall clock time" that CPU is actively working

Real-world examples for 2ms CPU:
- Parse HTTP headers: 0.1ms
- Calculate hash(short_code): 0.1ms  
- Execute database query: 1.5ms (including result processing)
- Generate HTTP response: 0.3ms
- Total: ~2ms of CPU work
```

**CPU Capacity Calculation:**
```yaml
Single CPU Core Capacity:
- 1 CPU core can provide 1,000ms of processing per second (by definition)
- This means 1 core = 1,000ms/second of compute capacity

8-Core Server Capacity:
- 8 CPU cores × 1,000ms per core = 8,000ms/second total capacity
- This is theoretical maximum processing power available

CPU Utilization Math:
- 1,000 requests/sec × 2ms per request = 2,000ms of CPU needed per second
- Server provides: 8,000ms/second capacity
- Utilization: 2,000ms ÷ 8,000ms = 25% CPU usage

Why this works:
- 75% CPU capacity remains free for traffic spikes
- OS overhead, monitoring, GC use remaining capacity
- Industry best practice: Keep CPU under 50% for stability
```

**Server Capacity Calculations:**

**CPU Utilization:**
```yaml
Calculation: 1,000 requests/sec × 2ms CPU time = 2,000ms of CPU per second

Server has 8 CPU cores = 8,000ms of CPU capacity per second
CPU utilization: 2,000ms ÷ 8,000ms = 25% CPU usage ✓

Why this works:
- Low CPU utilization leaves headroom for traffic spikes
- OS overhead, monitoring, logging use additional CPU
- GC pauses (if using Java/C#) need CPU buffer
```

**Memory Throughput:**
```yaml
Calculation: 1,000 requests/sec × 1KB per request = 1MB/sec memory usage

Server has 32GB RAM with ~20GB/sec memory bandwidth
Memory utilization: 1MB/sec ÷ 20,000MB/sec = 0.005% ✓

Why this works:
- Minimal memory per request (no large objects)
- Connection pool reuses memory
- Most data served from cache (in-memory)
```

**Network Throughput:**
```yaml
Calculation: 1,000 requests/sec × 1.5KB = 1.5MB/sec = 12Mbps

Server has 10Gbps network interface = 10,000Mbps capacity
Network utilization: 12Mbps ÷ 10,000Mbps = 0.12% ✓

Why this works:
- Network is nowhere near saturation
- Leaves massive headroom for traffic bursts
- URL shortener has small payloads (not file transfers)

Conversion explanation:
- 1.5MB/sec × 8 bits/byte = 12Mbits/sec = 12Mbps
- 10Gbps = 10,000Mbps
- Utilization: 12 ÷ 10,000 = 0.0012 = 0.12%
```

**Why 1,000 QPS is Conservative:**
```yaml
Industry Benchmarks:
- Simple web services: 2,000-5,000 QPS per server
- Database-backed APIs: 1,000-3,000 QPS per server
- Cached responses: 10,000+ QPS per server

Our Choice: 1,000 QPS per server
- Conservative estimate with 4x safety margin
- Accounts for: monitoring overhead, logging, garbage collection
- Allows for traffic spikes without performance degradation
- Better to over-provision than have system failures
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

## 10. System Design Interview Guide - Facts vs Calculations

### 🔢 FACTS TO MEMORIZE (Industry Standards)

**Database Limits:**
- MySQL max connections: ~5,000 per instance
- Database max QPS: ~10,000 for mixed workload  
- Practical storage limit: ~10TB per instance
- Connection pool size: 50-100 per application server

**Performance Benchmarks:**
- Application server: 1,000 QPS per server (conservative)
- Redis QPS: 100,000 ops/sec per instance
- Network interface: 10Gbps typical cloud instance
- CPU cores: 8-16 cores typical production server

**Web Traffic Patterns:**
- Power law distribution: 1% URLs get 60% traffic
- Read:Write ratio: 100:1 for content systems
- Cache overhead: 3x for Redis (indexes, expiration, etc.)
- Viral content: 10K-100K shares, 5-50 clicks per share

**Cost Factors:**
- Redis: ~$0.50/GB/month  
- SSD storage: ~$0.10/GB/month
- Bandwidth: ~$0.09/GB outbound

### 📊 CALCULATIONS TO DERIVE (Show Your Work)

**Traffic Estimation:**
```yaml
START WITH: DAU, actions per user, read:write ratio
CALCULATE: QPS, daily requests, bandwidth needs
EXAMPLE: 100M DAU × 2 URLs × 100:1 ratio = 231,500 read QPS
```

**Server Sizing:**  
```yaml
START WITH: Total QPS needed, QPS per server target
CALCULATE: Number of servers, with safety margins
EXAMPLE: 234,000 QPS ÷ 1,000 QPS per server = 234 servers
```

**Storage Requirements:**
```yaml  
START WITH: Record size, daily volume, retention period
CALCULATE: Daily storage, total storage over time
EXAMPLE: 200M URLs × 250 bytes × 365 days × 5 years = 90TB
```

**Cache Sizing:**
```yaml
START WITH: Traffic distribution, access patterns  
CALCULATE: Hot data size, cache tiers, hit ratios
EXAMPLE: 1M hot URLs × 250 bytes × 3x overhead = 750MB L1 cache
```

**Sharding Requirements:**
```yaml
START WITH: Total load, single DB limits
CALCULATE: Number of shards needed  
EXAMPLE: 234,000 QPS ÷ 10,000 QPS per DB = 24 shards minimum
```

### 🎯 INTERVIEW STRATEGY

**Step 1: State Facts**
"Industry standard for MySQL is ~10,000 QPS per instance..."

**Step 2: Show Calculations**  
"Given our 234,000 QPS requirement, we need 234,000 ÷ 10,000 = 24 shards..."

**Step 3: Add Safety Margins**
"For production safety, we'll use 30 shards with 2x capacity buffer..."

**Step 4: Validate Reasonableness**
"This gives us ~8,000 QPS per shard, well within MySQL limits..."

## 11. Key Takeaways