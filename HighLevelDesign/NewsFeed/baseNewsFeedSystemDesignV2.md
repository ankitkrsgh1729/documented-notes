# News Feed System Design - Complete Guide

> **Note:** For detailed explanation of pagination, cursors, versioning, and checksums, see [Feed Pagination & Consistency Guide](feedPaginationViaCursorAndChecksum.md)

## System Overview & Requirements

### Functional Requirements
- Create and view posts (text, media)
- Follow/unfollow users
- View personalized chronological news feed
- Infinite scroll pagination
- Basic interactions (likes, comments)

### Non-Functional Requirements
- **Scale:** 2B users, 300M DAU, 150M posts/day
- **Performance:** Feed load <500ms, Post creation <200ms
- **QPS:** 35K reads/sec, 2K writes/sec
- **Storage:** 100TB annually
- **Consistency:** Eventual consistency (1-minute delay acceptable)

### Capacity Estimation
```
Daily Posts: 300M users × 0.5 posts = 150M posts/day = ~1,736 posts/sec
Feed Requests: 300M users × 10 requests = 3B requests/day = ~34,722 requests/sec
Storage: 150M × 2KB = 300GB/day ≈ 100TB/year
Cache: Multi-tier approach to handle 300M users efficiently
```

---

## High-Level Architecture

```
[User] → [Load Balancer] → [Web Servers] → [Services] → [Cache] → [Database]
                                ↓
                        [Message Queues]
                                ↓
                        [Fanout Workers]
```

### Core Components

**Web Services Layer:**
- Post Service: Handle post creation and retrieval
- Feed Service: Manage user feed generation and pagination
- Graph Service: Handle follow/unfollow operations
- Authentication Service: User management and security

**Backend Services:**
- **Fanout Service:** Orchestrates feed distribution after new posts
- **Message Queues:** Handle asynchronous processing (post_created_events, feed_update_jobs)
- **Fanout Workers:** Process feed updates asynchronously

**Storage Layer:**
- **Multi-tier Cache:** Redis (Tier 1), Memcached (Tier 2)
- **Databases:** Post DB, User DB (DynamoDB), Graph DB (Neo4j/Neptune)


#### Memcached vs Redis vs Database - Quick Comparison

| Aspect | Memcached | Redis | Database |
|--------|-----------|-------|----------|
| **Storage Location** | RAM only | RAM (+ optional disk backup) | Disk (+ RAM cache) |
| **Data Persistence** | ❌ No (lost on restart) | ✅ Yes (can save to disk) | ✅ Yes (permanent) |
| **Data Structures** | String → String only | String, List, Set, Hash, Sorted Set, etc. | Tables, Rows, Columns |
| **Speed** | Very Fast (~1ms) | Very Fast (~1ms) | Slower (~10-50ms) |
| **Threading** | Multi-threaded | Single-threaded | Multi-threaded |
| **Max Value Size** | 1 MB | 512 MB | Unlimited |
| **TTL (Expiration)** | ✅ Yes | ✅ Yes | Manual cleanup |
| **Transactions** | ❌ No | ✅ Yes | ✅ Yes (ACID) |
| **Replication** | ❌ No (built-in) | ✅ Yes | ✅ Yes |
| **Use Case** | Simple cache, cheap | Cache + real-time features | Permanent storage, complex queries |
| **Cost (AWS)** | $0.017/GB/hour | $0.034/GB/hour | Varies (slower, cheaper per GB) |
| **When Data Lost** | Gone forever | Can recover from disk | Never lost |

---
Even though Redis stores data in RAM for speed, it can periodically save snapshots to disk. Hence recovery from disk is possible.
#### Simple Mental Model

```
Memcached:  Whiteboard (fast, temporary, simple)
Redis:      Smart whiteboard (fast, temporary, many features)
Database:   Filing cabinet (slower, permanent, organized)
```

---


## Data Flow Patterns

### Post Creation Flow (Write Path)

```
1. User creates post → Post Service
2. Post Service saves to Post DB + Post Cache
3. Publish "post_created_event" to message queue
4. Fanout Service consumes event → Queries Graph DB for followers
5. Fanout Service publishes "feed_update_jobs" to queue
6. Fanout Workers consume jobs → Update News Feed Cache for each follower
```

**Key Points:**
- Asynchronous processing prevents blocking user's post creation
- Message queue decouples post creation from fanout
- Fanout workers can be scaled independently based on load

### Feed Generation Flow (Read Path)

```
1. User requests feed → Feed Service
2. Check News Feed Cache (multi-tier lookup)
3. If cache hit → Return cached feed with pagination
4. If cache miss → Generate from Post DB + Graph DB
5. Store in appropriate cache tier → Return to user
```

**Key Points:**
- Multi-tier cache lookup (Redis → Memcached → Database)
- Cache miss triggers feed generation from database
- Generated feed cached for future requests

---

## Multi-Tier Caching Strategy

### Cache Distribution

**Redis (Tier 1) - Hot Users (30M users)**
- Active users (last hour)
- Stores rich metadata: version, checksum, session info
- Supports real-time features and WebSocket sessions
- Size: 30M × 2.5KB = 75GB

**Memcached (Tier 2) - Warm Users (100M users)**  
- Recent users (last 24 hours)
- Stores only serialized posts (no metadata)
- Simple key-value storage
- Size: 100M × 2KB = 200GB

**Database (Tier 3) - Cold Users (170M users)**
- Inactive users
- Generate feeds on-demand from Post DB + Graph DB
- No pre-computed storage

### Tier Decision Logic

```
User Activity Check:
├── Last seen < 1 hour → Redis (Hot)
├── Last seen < 24 hours → Memcached (Warm)  
└── Last seen > 24 hours → Database (Cold)

Dynamic Migration:
- Warm user requests real-time features → Migrate to Redis
- Hot user becomes inactive → Demote to Memcached
```

### Why Multi-Tier Instead of Single Redis?

**Cost Optimization:**
- Redis: $0.05/GB/hour → 300M users would cost $30K/hour
- Memcached: $0.01/GB/hour → Significant savings for warm data
- Most users don't need real-time features

**Feature Optimization:**
- Redis: Complex data structures, pub/sub, WebSocket sessions
- Memcached: Simple key-value, perfect for serialized post lists
- Right tool for the right job

---

## Feed Consistency & Pagination

> **📖 Detailed Guide:** See [Feed Pagination & Consistency Guide](feedPaginationViaCursorAndChecksum.md) for complete explanation with diagrams

### Quick Summary

**Cursor-Based Pagination:**
- Format: `"timestamp_postID"` (e.g., `"2025-01-15T10:20:00Z_post_C"`)
- Stable reference that doesn't shift when new posts arrive
- Handles duplicates automatically

**Feed Versioning:**
- Each feed state has unique version ID
- Detect when feed changed during user session
- Used mainly for UX (showing "new posts available" banner)
- Also handles edge cases like post deletions

**Checksums:**
- XOR-based hash for O(1) integrity validation
- Detects cache corruption during updates
- Recovers by regenerating from database

### Feed Cache Structure
```json
{
  "version": "v1642678800",
  "checksum": "a1b2c3d4",
  "posts": [post_ids...],  // Max 200 posts
  "metadata": {
    "last_updated": "2025-01-15T10:30:00Z",
    "cursor_positions": {...}
  }
}
```

**TTL Strategy:**
- Redis (Hot): 1 hour TTL
- Memcached (Warm): 24 hours TTL
- Database (Cold): No caching

---

## Hybrid Push-Pull Strategy

### The Celebrity Problem

**Challenge:** User with 50M followers → 50M cache updates per post (write amplification)

**Example:**
```
Celebrity posts once:
├── Traditional Push: Update 50M feeds = 50M cache writes
├── Queue depth: Massive backlog
├── Time to complete: Hours
└── Cost: Extremely high
```

### Fanout Decision Logic

```
Follower Count Strategy:
├── < 100K followers → PUSH (pre-compute all feeds)
│   └── Fast reads, manageable write amplification
│
├── 100K - 1M followers → PUSH_ACTIVE (only active followers)
│   └── Skip inactive users, reduce fanout by ~70%
│
└── > 1M followers → PULL (compute at read time)
    └── No fanout, fetch at read time
```

### Hybrid Feed Generation (Read Time)

**For Regular User:**
```
1. Get precomputed feed from Redis/Memcached (push model)
2. Check if user follows any celebrities (Graph DB lookup)
3. If yes: Fetch recent celebrity posts separately (pull model)
4. Merge both feeds chronologically
5. Cache merged result
6. Return to user

Example Timeline:
[Celebrity Post X] ← Fetched via pull
[Friend Post A]    ← From precomputed feed
[Celebrity Post Y] ← Fetched via pull
[Friend Post B]    ← From precomputed feed
[Friend Post C]    ← From precomputed feed
```

**Benefits:**
- **Scalability:** No write amplification for celebrities
- **Performance:** Most users still get fast precomputed feeds
- **Flexibility:** Thresholds adjustable based on system load
- **Cost:** Significant reduction in cache updates

**Trade-off:**
- Slight read latency for celebrity followers (50-100ms extra)
- Acceptable since most feeds are still precomputed

---

## Real-Time Updates

### WebSocket Integration (Redis Tier Only)

**Why Only Redis Tier:**
- Real-time requires persistent WebSocket connections
- Need session management and connection metadata
- Memcached can't handle complex session state
- Database tier users too inactive to justify real-time

**Real-Time Flow:**
```
1. User A (celebrity) creates post
2. Fanout service identifies online followers in Redis tier
3. Send WebSocket notification: "New posts available"
4. Client shows banner: "5 new posts ↻ Tap to refresh"
5. User chooses to refresh (pull-to-refresh)
6. Feed service merges new posts with existing feed
```

**Why Not Auto-Insert?**
- Disrupts user's reading experience
- Can cause UI jumpiness
- User loses their position
- Better UX to let user control refresh timing

### Graceful Degradation

**If WebSocket connection fails:**
```
Redis Tier Users:
├── Fall back to HTTP polling (every 30 seconds)
├── Still get updates, just not real-time
└── System remains functional

Memcached Tier:
├── Continue with batch fanout updates
└── Updates appear on next feed refresh

Database Tier:
├── No change (already on-demand generation)
└── See latest posts when they refresh
```

---

## Database Design

### Posts Table (DynamoDB)

**Schema:**
```
Partition Key: post_id
Sort Key: created_at (for range queries)

Global Secondary Indexes:
1. author_id + created_at (fetch user's posts)
2. is_deleted + created_at (filter deleted posts)

Attributes:
- post_id (UUID)
- author_id (User ID)
- content (text, max 280 chars)
- media_urls (list of S3 URLs)
- created_at (timestamp)
- updated_at (timestamp)
- post_type (text/image/video)
- likes_count (number)
- comments_count (number)
- is_deleted (boolean)
```

**Query Patterns:**
```
1. Get post by ID: 
   Query by post_id (O(1) lookup)

2. Get user's posts:
   Query GSI: author_id + created_at DESC
   
3. Batch get posts for feed:
   BatchGetItem with list of post_ids
```

### Social Graph (Neo4j/Neptune)

**Graph Structure:**
```
Nodes: User
Relationships: FOLLOWS

Example:
(User A)-[:FOLLOWS]->(User B)
(User A)-[:FOLLOWS]->(User C)
(User D)-[:FOLLOWS]->(User A)
```

**Key Queries:**
```cypher
// Get user's followers (for fanout)
MATCH (u:User {id:'user123'})<-[:FOLLOWS]-(follower)
RETURN follower.id, follower.last_active
LIMIT 10000

// Get user's followings (for feed generation)
MATCH (u:User {id:'user123'})-[:FOLLOWS]->(following)
RETURN following.id

// Get active followers only (for PUSH_ACTIVE strategy)
MATCH (u:User {id:'celebrity'})<-[:FOLLOWS]-(f)  
WHERE f.last_active > timestamp() - 86400
RETURN f.id
```

**Why Graph Database?**
- Follow relationships are highly connected
- Need fast traversal for fanout operations
- Efficient for "followers of followers" queries
- Better than SQL joins for many-to-many relationships

### User Table (DynamoDB)

**Schema:**
```
Partition Key: user_id

Attributes:
- user_id (UUID)
- username (string)
- email (string)
- last_active (timestamp)
- follower_count (number)
- following_count (number)
- tier (hot/warm/cold)
- created_at (timestamp)
```

---

## Performance Optimizations

### Feed Generation Optimizations

**1. Parallel Processing**
```
Traditional: Sequential fetch
User's 100 followings → 100 sequential DB calls → 1000ms

Optimized: Parallel fetch
User's 100 followings → 10 parallel batches → 100ms
```

**2. Smart Batching**
```
Group similar requests:
- Batch get posts: BatchGetItem (get 100 posts in 1 call)
- Batch graph queries: Get all followings in single query
- Reduces network round trips
```

**3. Connection Pooling**
```
Without pooling: Create new connection per request
- Connection overhead: 50-100ms
- Max connections: Limited

With pooling: Reuse existing connections
- Connection overhead: 0ms
- Max connections: Configurable pool size
```

**4. Incremental Checksums**
```
Traditional: O(n) recalculation
- Recalculate hash for all 200 posts
- CPU intensive

XOR-based: O(1) updates
- Add post: checksum XOR hash(new_post)
- Remove post: checksum XOR hash(removed_post)
```

### Cache Optimizations

**1. Cache Warming**
```
During low traffic hours (2-4 AM):
- Identify trending users
- Pre-generate their followers' feeds
- Improves cache hit rate during peak hours
```

**2. Compression**
```
Without compression: 2KB per feed × 130M users = 260GB
With compression: 1KB per feed × 130M users = 130GB
- Use gzip or snappy
- 50% memory savings
```

**3. Lazy Loading**
```
Initial load: Only first 50 posts
User scrolls: Fetch next 50 posts
- Reduces memory usage
- Faster initial load time
```

**4. Dynamic Migration**
```
Monitor user activity:
- Inactive hot user (no activity for 1 hour) → Demote to warm
- Active warm user (requests real-time) → Promote to hot
- Optimizes cache utilization
```

---

## Scaling Challenges & Solutions

### 1. Write Amplification

**Problem:**
```
Celebrity with 50M followers posts once:
├── Traditional push: 50M feed updates
├── Queue depth: Hours of backlog
├── Other users' posts delayed
└── System overwhelmed
```

**Solution:**
```
Hybrid Strategy:
├── Regular users (< 100K): Push model
├── Popular users (100K-1M): Push to active followers only
├── Celebrities (> 1M): Pull model at read time
└── Result: Balanced write load
```

### 2. Hot Partitions

**Problem:**
```
Celebrity's posts → Single database partition
├── All followers query same partition
├── Partition overloaded
├── Slow queries for everyone
└── Database becomes bottleneck
```

**Solution:**
```
Strategies:
├── Separate celebrity posts to dedicated shards
├── Use pull model (distributes reads across time)
├── Cache celebrity posts aggressively
├── Connection pooling to prevent connection exhaustion
└── Read replicas for celebrity data
```

### 3. Memory Requirements

**Problem:**
```
300M users × 2KB per feed = 600GB cache needed
- Single Redis cluster: Very expensive
- Memory pressure → Evictions → Cache misses
```

**Solution:**
```
Multi-tier approach:
├── Hot users (30M): Redis 75GB
├── Warm users (100M): Memcached 200GB
├── Cold users (170M): No cache, on-demand
└── Total: 275GB instead of 600GB (54% savings)
```

### 4. Feed Consistency

**Problem:**
```
User scrolling while new posts arrive:
├── Page 1: [A, B, C]
├── New post X inserted at top
├── Page 2 request: Might see duplicate C
└── Poor user experience
```

**Solution:**
```
See detailed guide: feedPaginationViaCursorAndChecksum.md
├── Cursor-based pagination
├── Feed versioning (optional, for UX)
└── Checksums for data integrity
```

---

## Monitoring & Alerting

### Key Metrics

**Performance Metrics:**
```
1. API Response Time
   ├── p50 < 200ms
   ├── p95 < 500ms
   └── p99 < 1000ms

2. Cache Hit Ratio
   ├── Redis: > 95%
   ├── Memcached: > 90%
   └── Alert if < thresholds

3. Queue Processing Time
   ├── Average: < 100ms
   ├── p95: < 500ms
   └── Queue depth < 10K

4. Database Query Performance
   ├── Post fetch: < 50ms
   ├── Graph query: < 100ms
   └── Feed generation: < 200ms
```

**Business Metrics:**
```
1. Feed Load Success Rate: > 99.9%
2. Post Creation Success Rate: > 99.95%
3. Daily Active Users (DAU)
4. Posts per user per day
5. Real-time update delivery rate: > 95% (Redis tier)
```

### Alert Thresholds

```
CRITICAL Alerts:
├── Feed load time > 1s → Scale read capacity
├── Queue depth > 10K → Scale fanout workers
├── Cache hit rate < 90% → Investigate efficiency
├── Celebrity post detected → Monitor pull model
└── Database connection pool exhausted → Add connections

WARNING Alerts:
├── Feed load time > 500ms
├── Queue depth > 5K
├── Cache hit rate < 95%
└── Version mismatch rate > 5%
```

---

## System Evolution Path

### Phase 1: MVP (Basic System)
```
Components:
├── Simple push model for all users
├── Single cache layer (Redis)
├── Basic offset pagination
├── Synchronous fanout
└── Single region deployment

Handles: ~1M users, basic functionality
```

### Phase 2: Scale Optimizations
```
Improvements:
├── Add Memcached tier
├── Implement message queues
├── Async fanout workers
├── Cursor-based pagination
└── Multi-region deployment

Handles: ~50M users, improved performance
```

### Phase 3: Advanced Consistency
```
Enhancements:
├── Feed versioning
├── XOR checksums
├── Hybrid push-pull model
├── Celebrity handling
└── Advanced monitoring

Handles: ~300M users, production-ready
```

### Phase 4: Real-Time Features
```
Additional Features:
├── WebSocket integration
├── Real-time notifications
├── Dynamic tier migration
├── ML-based feed ranking
└── A/B testing framework

Handles: Billions of users, feature-complete
```

---

## Critical Design Decisions

### 1. Push vs Pull Trade-offs

| Aspect | Push | Pull | Hybrid |
|--------|------|------|--------|
| Read Speed | Very Fast | Slow | Fast |
| Write Cost | Very High | Low | Medium |
| Storage | High | Low | Optimized |
| Consistency | Eventual | Real-time | Eventual |
| Celebrity Handling | Poor | Excellent | Excellent |

**Decision:** Use hybrid approach
- Push for regular users (fast reads)
- Pull for celebrities (scalable writes)
- Best of both worlds

### 2. Redis + Memcached vs Single Redis

| Aspect | Single Redis | Redis + Memcached |
|--------|-------------|-------------------|
| Cost | Very High | Optimized |
| Features | Rich | Tiered |
| Complexity | Low | Medium |
| Scalability | Limited | High |

**Decision:** Multi-tier caching
- Redis for active users needing features
- Memcached for simple data storage
- Significant cost savings

### 3. Cursor vs Offset Pagination

| Aspect | Offset | Cursor |
|--------|--------|--------|
| Duplicates | Possible | No |
| Consistency | Poor | Excellent |
| Implementation | Simple | Medium |
| Performance | O(n) skip | O(log n) seek |

**Decision:** Cursor-based
- Better user experience
- Handles concurrent updates
- Industry standard

---

## Interview Deep Dive Topics

### Expected Senior Questions

**Q: "How do you handle a user with 100 million followers?"**

**A:** Use pull model instead of push:
- Don't precompute 100M feeds (write amplification)
- At read time: Fetch celebrity's recent posts + merge with user's precomputed feed
- Cache merged result for subsequent requests
- Trade-off: Slight read latency for followers, but system remains scalable

**Q: "What happens when Redis fails?"**

**A:** Graceful degradation with multiple fallback layers:
1. Redis Sentinel detects failure → Automatic failover to replica
2. If entire Redis cluster down → Fall back to Memcached (lose real-time features)
3. If Memcached also down → Fall back to database generation
4. Hot users temporarily become warm users
5. System remains functional, just slower

**Q: "How do you prevent duplicate posts during concurrent updates?"**

**A:** Cursor-based pagination handles this naturally:
- Cursor references specific post with timestamp + ID
- Query: "posts WHERE timestamp < cursor_timestamp"
- Even if new posts inserted above, cursor position stable
- Version tracking is optional, mainly for UX (showing "new posts" banner)
- See feedPaginationViaCursorAndChecksum.md for details

**Q: "Why both Redis and Memcached instead of just scaling Redis?"**

**A:** Cost and feature optimization:
- Redis: $0.05/GB/hour, rich features (pub/sub, sessions, complex data structures)
- Memcached: $0.01/GB/hour, simple key-value
- Active users (30M) need Redis features
- Warm users (100M) only need simple storage
- Savings: ~60% reduction in cache costs
- Right tool for the right job

**Q: "How do checksums help if you already have versions?"**

**A:** Different purposes:
- **Versions:** Detect WHEN feed changed (timing)
- **Checksums:** Detect IF data is corrupted (integrity)
- Example scenario:
  - New posts arrive → Version changes to v1002
  - Network error during cache update → Post missing
  - Stored checksum ≠ recalculated checksum
  - System detects corruption, regenerates from database
- Versions can't catch corruption, only timing changes

**Q: "How would you implement feed ranking/ML-based feeds?"**

**A:** Evolution from chronological to ranked:
1. Keep chronological as base (this design)
2. Add ranking service:
   - Fetch chronological feed
   - Score each post (engagement, relevance, recency)
   - Re-order by score
3. Cache ranked results separately
4. A/B test: 50% chronological, 50% ranked
5. Measure engagement metrics
6. Gradually roll out if successful

---

## Summary

This news feed system design handles billions of users through:

**Key Innovations:**
- Multi-tier caching (Redis/Memcached/Database) for cost optimization
- Hybrid push-pull strategy for celebrity handling
- Cursor-based pagination for consistency (see feedPaginationViaCursorAndChecksum.md)
- Async fanout with message queues for scalability
- Tiered real-time updates (Redis only) for performance
- Graceful degradation at every layer

**Scalability Achieved:**
- 300M DAU, 150M posts/day
- 35K reads/sec, 2K writes/sec
- <500ms feed load time
- Handles celebrity users gracefully
- 54% cache cost savings vs single-tier

**Trade-offs Made:**
- Eventual consistency (acceptable for social feeds)
- Slight read latency for celebrity followers
- Complexity of multi-tier cache management
- Storage overhead for precomputed feeds

This design balances performance, cost, scalability, and user experience for a production-grade news feed system.