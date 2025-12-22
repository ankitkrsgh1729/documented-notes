# Gaming Leaderboard System Design - Deep Dive Notes

## 1. Back-of-the-Envelope Calculation: 2,500 QPS for Score Updates

### Given Requirements:
- **5 million DAU** (Daily Active Users)
- **2,500 QPS** for score updates

### Understanding the Calculation:

**Breaking down QPS (Queries Per Second):**

```
Total daily updates = 5,000,000 users × average games per user per day
```

**Assumption Check:**
- If each user plays and wins/loses multiple games per day
- Let's say average user updates score **5 times per day**
- Total daily score updates = 5,000,000 × 5 = 25,000,000 updates/day

**Converting to QPS:**
```
Seconds in a day = 24 × 60 × 60 = 86,400 seconds

Average QPS = 25,000,000 / 86,400 ≈ 289 QPS
```

**But why 2,500 QPS?**

This accounts for **peak load and traffic patterns**:
- Users don't play uniformly throughout the day
- Peak hours (evening 6 PM - 11 PM) might have 10x average traffic
- Need to handle **burst traffic** during peak gaming hours
- **Peak QPS = Average QPS × Peak Factor**
- Peak Factor ≈ 8-10x for gaming applications

```
Peak QPS = 289 × 8.6 ≈ 2,500 QPS
```

### Why This Matters:
- System must handle **2,500 write operations per second**
- Each write operation includes:
  - Update user score
  - Potentially update leaderboard position
  - Log the event
  - Trigger notifications (if applicable)

### Storage Calculation:
```
Storage per user entry:
- user_id: 24 characters (varchar)
- score: 16-bit integer (2 bytes)
- Total: 26 bytes per entry

For 25 million users:
26 bytes × 25,000,000 = 650,000,000 bytes = ~650 MB
```

**With Redis overhead (skip list + hash table):**
- Actual storage ≈ 650MB × 2 = **~1.3 GB**
- Single modern Redis server can handle this easily

---

## 2. Relational Database Solution - Why It Doesn't Scale

### The Proposed Solution:

```sql
-- Leaderboard table structure
CREATE TABLE leaderboard (
    user_id VARCHAR(255) PRIMARY KEY,
    score INT
);

-- Insert new user
INSERT INTO leaderboard (user_id, score) VALUES ('mary1934', 1);

-- Update existing user score
UPDATE leaderboard 
SET score = score + 1 
WHERE user_id = 'mary1934';

-- Fetch user's rank
SELECT (@rownum := @rownum + 1) AS rank, user_id, score
FROM leaderboard
ORDER BY score DESC;
```

### Why This Fails at Scale:

#### Problem 1: **Query Performance for Ranking**

**The Ranking Query:**
```sql
SELECT (@rownum := @rownum + 1) AS rank, user_id, score
FROM leaderboard
ORDER BY score DESC;
```

**Time Complexity Analysis:**
- **Sorting**: O(n log n) where n = total number of users
- For 5 million users: O(5,000,000 × log(5,000,000)) ≈ O(5M × 22.6) operations
- **No index can help** because we need to sort the entire table each time

**Real-world impact:**
- With millions of rows, this query takes **10+ seconds**
- Users expect leaderboard in **< 100ms**
- Completely unacceptable for real-time requirements

#### Problem 2: **Duplicate Scores**

Example scenario:
```
Rank | User         | Score
-----|--------------|------
1    | happy_tomato | 987
2    | mallow       | 902
3    | smith        | 870
4    | mary1934     | 850
```

**What if two users have score 870?**
- They should both be rank 3
- Next user should be rank 5 (not 4)
- SQL needs additional logic to handle this:

```sql
SELECT 
    DENSE_RANK() OVER (ORDER BY score DESC) as rank,
    user_id, 
    score
FROM leaderboard;
```

This adds more computational overhead.

#### Problem 3: **High Write Load**

**At 2,500 QPS:**
- Each UPDATE requires:
  1. Find the row (even with index on user_id)
  2. Lock the row
  3. Update the score
  4. Update any indexes
  5. Write to transaction log
  6. Commit transaction

**Bottlenecks:**
- **Lock contention**: Multiple users updating simultaneously
- **Index updates**: Any index on `score` must be rebuilt on every update
- **Transaction overhead**: ACID properties slow down writes
- **Disk I/O**: Even with SSD, 2,500 writes/sec is pushing limits

#### Problem 4: **Cannot Cache Effectively**

**Why caching fails:**
- Leaderboard changes with **every score update**
- Cache invalidation would happen 2,500 times/second
- Cache would always be stale
- No benefit from caching

#### Problem 5: **Top 10 Query is Expensive**

Even with LIMIT optimization:
```sql
SELECT user_id, score
FROM leaderboard
ORDER BY score DESC
LIMIT 10;
```

**Issues:**
- Still requires **full table sort** or **full index scan**
- Even with index on score (DESC), database must:
  - Read from disk/memory
  - Sort or scan index
  - Return top 10
- No way to maintain "top 10" separately efficiently

#### Problem 6: **Finding User's Rank is Very Expensive**

To find where user "mary1934" ranks:
```sql
SELECT COUNT(*) + 1 as rank
FROM leaderboard
WHERE score > (SELECT score FROM leaderboard WHERE user_id = 'mary1934');
```

**Performance:**
- Subquery to get user's score: O(1) with index
- Count users with higher score: **O(n) - scans entire table**
- For millions of users, this is catastrophically slow

### Summary: Why RDB Fails

| Requirement | RDB Performance | Why It Fails |
|-------------|----------------|--------------|
| Get Top 10 | 5-10 seconds | Full table sort |
| Get User Rank | 10+ seconds | Count all higher scores |
| Update Score | 50-100ms | Lock + index update |
| Handle 2.5K QPS | Impossible | Lock contention |
| Real-time updates | No | Cache invalidation |

**Key Insight:**
> "SQL databases are not performant when we have to process large amounts of continuously changing information. Attempting to do a rank operation over millions of rows is going to take 10s of seconds, which is not acceptable for the desired real-time approach."

---

## 3. Redis Sorted Sets Solution - Why One Node is Sufficient

### Understanding Redis Sorted Sets

Redis sorted sets provide these operations:

```redis
# ZADD: Insert user (O(log n))
ZADD leaderboard_feb_2021 1 'mary1934'

# ZINCRBY: Increment score (O(log n))
ZINCRBY leaderboard_feb_2021 1 'mary1934'

# ZREVRANGE: Fetch top 10 (O(log n + m))
ZREVRANGE leaderboard_feb_2021 0 9 WITHSCORES

# ZREVRANK: Get user's rank (O(log n))
ZREVRANK leaderboard_feb_2021 'mary1934'
```

### Internal Data Structure: Skip List

**Skip List Characteristics:**
- Base layer: Singly-linked sorted list
- Multi-level indexes for fast search
- **Time complexity**: O(log n) for insertion, removal, and search
- **Space complexity**: O(n)

**How Skip List Works:**

```
Level 2:  1 ----------------> 45
          |                   |
Level 1:  1 -----> 7 -------> 45
          |        |          |
Level 0:  1 -> 7 -> 45 -> 72 -> 83 -> ...
```

**Searching for element 45:**
- Start at highest level (Level 2)
- Move right until next element > target
- Drop down one level
- Repeat until found
- **Result**: O(log n) instead of O(n)

### Why One Redis Node is Sufficient

#### 1. **Memory Capacity**

```
Storage requirement:
- 25 million users
- 26 bytes per entry
- Total: ~650 MB
- With overhead (skip list + hash): ~1.3 GB

Modern Redis server:
- Can handle 100+ GB of RAM
- 1.3 GB is only ~1% capacity
- Plenty of headroom
```

#### 2. **Performance at 2,500 QPS**

**Write Performance:**
- Redis is **in-memory** - no disk I/O
- ZINCRBY operation: O(log n)
- For 25M users: log₂(25,000,000) ≈ 24.6 operations
- Single-threaded but extremely fast
- **Can handle 100,000+ operations/second**
- 2,500 QPS is only **2.5% of capacity**

**Read Performance:**
- ZREVRANGE (top 10): O(log n + m) where m=10
- ZREVRANK (user rank): O(log n) ≈ 25 operations
- Both complete in **< 1ms**
- Much faster than required 100ms

#### 3. **CPU Usage**

> "Our peak QPS from the back-of-the-envelope estimation is 2500 updates/sec. This is well within the performance envelope of a single Redis server."

**Analysis:**
```
Redis operations:
- Single-threaded for command execution
- But uses I/O multiplexing (epoll/kqueue)
- Can process 100K simple ops/sec on modern hardware

At 2,500 QPS:
- CPU usage: ~2-3%
- Plenty of headroom for spikes
```

#### 4. **Network I/O**

**Calculation:**
```
Per operation data:
- Command: ~50 bytes
- Response: ~100 bytes
- Total per op: ~150 bytes

At 2,500 QPS:
- Bandwidth: 150 × 2,500 = 375 KB/sec
- Modern NIC: 1 Gbps = 125 MB/sec
- Usage: 375/125,000 = 0.3%
```

**Conclusion**: Network is not a bottleneck

#### 5. **Persistence Consideration**

> "One concern about the Redis cache is persistence, as a Redis node might fail. Luckily, Redis does support persistence, but restarting a large Redis instance from disk is slow."

**Solution:**
- Redis supports RDB snapshots and AOF logs
- Use **read replica** for high availability
- If main instance fails:
  - Read replica is promoted
  - New read replica is attached
- Downtime: seconds, not minutes

**Backup Strategy:**
- MySQL stores point table with timestamps
- Can reconstruct Redis leaderboard if needed
- Trade-off: slower recovery vs. data durability

### Comparison: RDB vs Redis Single Node

| Metric | MySQL RDB | Redis Single Node |
|--------|-----------|-------------------|
| Get Top 10 | 5-10 sec | < 1 ms |
| Get Rank | 10+ sec | < 1 ms |
| Update Score | 50-100 ms | < 1 ms |
| Handle 2.5K QPS | ❌ No | ✅ Yes (2.5% capacity) |
| Memory | N/A | 1.3 GB (plenty) |
| CPU | High | 2-3% |
| Scalability | ❌ | ✅ (until ~100K QPS) |

### When Do We Need Multiple Redis Nodes?

**Scaling is needed when:**
1. **Storage grows beyond one node**
2. **QPS exceeds capacity**:
   ```
   500M DAU / 5M DAU = 100x scale
   2,500 QPS × 100 = 250,000 QPS
   ```
   This would require sharding.

**Current scenario (5M DAU, 2.5K QPS):**
- ✅ One Redis node is **more than sufficient**
- 💪 Operating at ~2-3% capacity
- 🚀 Can handle 30-40x growth before needing to scale

---

## 5. Understanding Sharding

### What is Sharding?

**Sharding = Horizontal Partitioning = Splitting data across multiple physical machines**

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  Physical Machine 1  │  │  Physical Machine 2  │  │  Physical Machine 10 │
│  IP: 10.0.1.1        │  │  IP: 10.0.1.2        │  │  IP: 10.0.1.10       │
│  Redis (Port 6379)   │  │  Redis (Port 6379)   │  │  Redis (Port 6379)   │
│  RAM: 16GB           │  │  RAM: 16GB           │  │  RAM: 16GB           │
│                      │  │                      │  │                      │
│  SHARD 0             │  │  SHARD 1             │  │  SHARD 9             │
│  Sorted Set          │  │  Sorted Set          │  │  Sorted Set          │
│  Scores: [1-100]     │  │  Scores: [101-200]   │  │  Scores: [901-1000]  │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

**Key Points:**
- **Different physical machines** with different IP addresses
- Each machine handles **1/10th of the data and traffic**
- Increases **total system capacity** (QPS, memory, network)
- NOT just multiple keys on the same Redis instance

### Why Shard?

**When single node is insufficient:**
```
500M DAU Requirements:
- Storage: 65GB
- QPS: 250,000 (2.5x single node capacity)

Solution: 10 shards
- Each handles: 6.5GB, 25K QPS
- Total capacity: 65GB, 250K QPS
```

---

## 6. Sharding Strategies

### Two Main Strategies

Both are methods of sharding (splitting across machines), but differ in **HOW** they decide which machine gets which data.

```
Sharding Goal: Distribute data across multiple machines
│
├─── Strategy 1: Fixed Partition (Score-Based Range Sharding)
│    └─── Manual routing based on score ranges
│
└─── Strategy 2: Hash Partition (Hash-Based Sharding)
     └─── Automatic routing based on hash(user_id)
          └─── Redis Cluster (specific implementation)
```

---

## 7. Strategy 1: Fixed Partition (Score-Based Range Sharding)

### How It Works

```python
# Manual routing logic in YOUR application code:

def get_shard_for_user(user_score):
    """Route based on score"""
    shard_num = user_score // 100  # Custom logic
    return shard_num

# Shard configuration:
SHARD_MAP = {
    0: {'host': '10.0.1.1', 'range': [1, 100]},
    1: {'host': '10.0.1.2', 'range': [101, 200]},
    # ...
    9: {'host': '10.0.1.10', 'range': [901, 1000]}
}

# Application routes requests:
def update_score(user_id, new_score):
    shard_num = get_shard_for_user(new_score)
    redis_host = SHARD_MAP[shard_num]['host']
    
    redis_client = redis.Redis(host=redis_host)
    redis_client.zadd("leaderboard", {user_id: new_score})
```

### Architecture

```
┌─────────────────────────────────────────┐
│       Your Application Code             │
│  ┌───────────────────────────────────┐  │
│  │   Manual Shard Router             │  │
│  │   - Score → Shard mapping         │  │
│  │   - Connection pool per shard     │  │
│  └───────────────────────────────────┘  │
└──────┬────────┬────────┬───────┬────────┘
       │        │        │       │
       ▼        ▼        ▼       ▼
   ┌──────┐┌──────┐┌──────┐┌──────┐
   │Redis0││Redis1││Redis2││Redis9│
   │10.0  ││10.0  ││10.0  ││10.0  │
   │.1.1  ││.1.2  ││.1.3  ││.1.10 │
   └──────┘└──────┘└──────┘└──────┘
   
   Each Redis is independent and unaware of others
```



### Advantages

✅ **Fast Top-K queries**: Only query highest shard (1 node)  
✅ **Efficient ranking**: Local rank + count higher shards  
✅ **Predictable performance**: Know exactly which shard to query  
✅ **Optimized for leaderboards**: Main use case is fast

### Disadvantages

❌ **Hot spots**: Top shard gets hammered with queries  
❌ **Manual rebalancing**: Adjust ranges if distribution skews  
❌ **Cross-shard moves**: Complex when users change shards  
❌ **Operational overhead**: You maintain all routing logic

---

## 8. Strategy 2: Hash Partition (Redis Cluster)

### What is Redis Cluster?

**Built-in distributed system** that:
- Automatically shards data across nodes
- Automatically routes requests
- Automatically rebalances
- Provides high availability

**You don't write sharding logic—Redis does it!**

### Hash Slot System

**Core concept:**
- 16,384 total hash slots (2^14)
- Each key mapped to a slot via `CRC16(key) % 16384`
- Slots distributed across nodes

**Why 16,384 (2^14)?**
- **Trade-off choice by Redis creators:**
  - 2^10 = 1,024 → Too few (coarse rebalancing)
  - 2^16 = 65,536 → Too many (large cluster state overhead)
  - 2^14 = 16,384 → Sweet spot (fine-grained + efficient)

**What is a "slot"?**
- **Slot = A bucket number (0 to 16,383)**
- Think of it as an address that maps to a physical node

### How Hash Partitioning Works

```python
# Redis Cluster's internal logic:

def get_slot_for_key(key):
    # 1. Hash the key using CRC16
    hash_value = CRC16(key)  # Returns a number
    
    # 2. Map to one of 16,384 slots
    slot = hash_value % 16384
    
    return slot

# Example:
key = "user:mary1934"
hash_value = CRC16("user:mary1934")  # = 52,341
slot = 52,341 % 16384  # = 3,189

# Redis knows: slot 3,189 is on Node 1
# Automatically routes to Node 1
```

**Why hash only user_id (not score)?**
- Same key always goes to same node
- User's data doesn't move as score changes
- Consistent placement

### Slot Distribution Example

```
With 3 nodes:

Node 0: slots [0-5460]      ← 5,461 slots
Node 1: slots [5461-10922]  ← 5,462 slots  
Node 2: slots [10923-16383] ← 5,461 slots

Total: 16,384 slots (all covered, no gaps)

Example routing:
- mary1934 → slot 8523 → Node 1
- lovelove → slot 15234 → Node 2
- i_love_tofu → slot 2341 → Node 0
```

### Architecture

```
┌─────────────────────────────────────────┐
│       Your Application Code             │
│  ┌───────────────────────────────────┐  │
│  │   Redis Cluster Client            │  │
│  │   - Just make Redis calls         │  │
│  │   - Library handles routing       │  │
│  └───────────────────────────────────┘  │
└──────┬────────────────────────────┬─────┘
       │  Cluster-aware protocol    │
       ▼                            ▼
   ┌──────────────────────────────────────┐
   │      Redis Cluster                   │
   │  (Nodes communicate via gossip)      │
   │                                      │
   │  ┌──────┐  ┌──────┐  ┌──────┐      │
   │  │Node 0│←→│Node 1│←→│Node 2│      │
   │  │Slots │  │Slots │  