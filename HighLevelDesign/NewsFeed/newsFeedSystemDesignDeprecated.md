# Deprecated Design
# News Feed System Design - Complete Guide

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

### Feed Generation Flow (Read Path)

```
1. User requests feed → Feed Service
2. Check News Feed Cache (multi-tier lookup)
3. If cache hit → Return cached feed with pagination
4. If cache miss → Generate from Post DB + Graph DB
5. Store in appropriate cache tier → Return to user
```

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

## Feed Consistency & Version Management

### The Core Problem

When users are scrolling through their feed, new posts arrive and get inserted at the top. This creates issues:
- User sees posts A, B, C
- New post X gets inserted at position 0
- User scrolls for next page → might see duplicate B, C or miss posts entirely

### Solution: Feed Versioning with Checksums

**Version Structure:**
```json
{
  "version_id": "v1642678800",
  "checksum": "a1b2c3d4e5f6", 
  "last_updated": "2025-01-15T10:30:00Z",
  "posts": [...],
  "cursor_metadata": {...}
}
```

**How Version Management Works:**

1. **Version Generation:** Each feed update creates new version ID (timestamp-based)
2. **Client Tracking:** Client sends current version with each request  
3. **Version Mismatch Detection:** Server compares client vs current version
4. **Position Recalculation:** When version changes, use cursor timestamp to find equivalent position in new feed

### Detailed Version Recalculation Example

**Initial State:**
```
Feed v1001: [post_A, post_B, post_C, post_D, post_E, post_F]
User sees: [post_A, post_B, post_C] 
Current cursor: "2025-01-15T09:40:00Z_post_C"
```

**New Posts Arrive:**
```
Feed v1002: [post_X, post_Y, post_A, post_B, post_C, post_D, post_E, post_F]
                ↑     ↑
           New posts inserted at top
```

**User Scrolls (Version Mismatch Detected):**
```
1. Client requests next page with cursor="2025-01-15T09:40:00Z_post_C" and version="v1001"
2. Server detects version mismatch (current is v1002)
3. Server finds post_C in new feed (now at position 4)
4. Returns posts after position 4: [post_D, post_E, post_F]
5. User gets expected continuation without duplicates
```

### Checksum for Data Integrity

**Purpose:** Detect data corruption during cache updates

**How Checksums Work:**

1. **Generation:** Calculate hash of all post IDs + timestamps
2. **Storage:** Store checksum alongside feed data
3. **Validation:** Recalculate checksum when serving feeds
4. **Corruption Detection:** If stored ≠ calculated checksum → regenerate feed

**Example Corruption Scenario:**
```
Timeline:
1. New posts X, Y arrive → Calculate checksum for [X, Y, A, B, C]
2. Network error during cache update
3. Cache ends up with [X, A, B, C] (missing Y)
4. Stored checksum doesn't match actual posts
5. Next request detects mismatch → Regenerate feed from database
```

### XOR for Incremental Checksums

**Problem:** Recalculating checksums for every feed update is O(n)

**Solution:** Use XOR properties for O(1) updates

**Key XOR Properties:**
- A XOR A = 0 (self-inverse)
- A XOR B = B XOR A (commutative)
- If C = A XOR B, then A = C XOR B (reversible)

**Implementation:**
```
Initial feed [A, B, C]: checksum = hash(A) XOR hash(B) XOR hash(C)

Add post D: new_checksum = old_checksum XOR hash(D)
Remove post B: new_checksum = current_checksum XOR hash(B)

Result: O(1) checksum updates instead of O(n)
```

## Cursor-Based Pagination

### Cursor Format
```
cursor = "timestamp_postid"
Example: "2025-01-15T10:30:00Z_post123"
```

### Why This Format
- **Timestamp:** Ensures chronological ordering in DESC sorted feed
- **Post ID:** Prevents duplicates when posts have identical timestamps
- **Stability:** Maintains user position during concurrent feed updates
- **Efficiency:** Enables binary search O(log n) instead of linear scan

### Pagination with Version Handling

```
Request: cursor="2025-01-15T09:40:00Z_post_C", client_version="v1001"

Processing:
1. Check version mismatch (v1001 vs current v1002)
2. If mismatch: recalculate position using cursor timestamp
3. Find posts older than cursor timestamp
4. Return next page with new version info

Response: Posts continue seamlessly despite version change
```

## Hybrid Push-Pull Strategy

### The Celebrity Problem

**Challenge:** User with 50M followers → 50M cache updates per post (write amplification)

**Solution:** Dynamic fanout strategy based on follower count

### Fanout Decision Logic

```
Follower Count Strategy:
├── < 100K followers → PUSH (pre-compute all feeds)
├── 100K - 1M followers → PUSH_ACTIVE (only active followers)
└── > 1M followers → PULL (compute at read time)
```

### Hybrid Feed Generation

**At Read Time:**
1. Get precomputed feed from normal users (push model)
2. Fetch recent posts from celebrities separately (pull model)  
3. Merge feeds chronologically with proper version management
4. Cache result for future requests

**Benefits:**
- **Scalability:** Handles celebrity users without fanout explosion
- **Performance:** Most users get fast pre-computed feeds
- **Flexibility:** Can adjust thresholds based on system load

## Real-Time Updates

### WebSocket Integration (Redis Tier Only)

**Why Only Redis Tier:**
- Real-time requires session management and metadata
- Memcached lacks complex data structures for session tracking
- Database tier users get updates on next request

**Real-Time Flow:**
1. New post published → Identify online followers in Redis tier
2. Send WebSocket notification: "New posts available"
3. User can choose to refresh (pull-to-refresh)
4. Don't auto-insert posts (disrupts reading experience)

### Graceful Degradation

**If real-time systems fail:**
- Redis tier users → Fall back to periodic polling
- Warm users → Continue with batch updates
- System remains functional without real-time features

## Database Design

### Posts Table (DynamoDB)
```
Partition Key: post_id
Global Secondary Index: author_id + created_at

Attributes:
- post_id, author_id, content, media_urls
- created_at, updated_at, post_type
- likes_count, comments_count, is_deleted
```

### Social Graph (Neo4j/Neptune)
```cypher
// Efficient graph queries
MATCH (u:User {id:'user123'})<-[:FOLLOWS]-(follower)
RETURN follower.id LIMIT 1000

// Optimized for fanout operations
MATCH (u:User {id:'celebrity'})<-[:FOLLOWS]-(f)  
WHERE f.last_active > timestamp() - 86400
RETURN f.id
```

### Feed Cache Structure
```
Key: "feed:user_id"
Value: {
  version: "v1642678800",
  checksum: "a1b2c3d4",
  posts: [post_ids...], // Max 200 posts
  metadata: {...}
}
TTL: 1 hour (hot), 24 hours (warm)
```

## Performance Optimizations

### Feed Generation Optimizations
- **Parallel Processing:** Fetch multiple user timelines concurrently
- **Smart Batching:** Group similar requests to reduce database load
- **Connection Pooling:** Reuse database connections efficiently
- **Binary Search:** O(log n) cursor position finding
- **Incremental Checksums:** O(1) integrity validation updates

### Cache Optimizations
- **Cache Warming:** Pre-load popular user feeds during low traffic
- **Compression:** Reduce memory usage for stored feeds
- **Lazy Loading:** Load older posts only when requested
- **Dynamic Migration:** Move users between tiers based on activity patterns
- **Batch Updates:** Group multiple feed updates for efficiency

## Scaling Challenges & Solutions

### Write Amplification
**Problem:** Popular users cause millions of feed updates
**Solution:** Hybrid push-pull + async processing + celebrity pull model

### Hot Partitions
**Problem:** Celebrity data causes uneven database load  
**Solution:** Separate handling for celebrities + pull model + connection pooling

### Memory Requirements
**Problem:** 300M users × feeds = massive cache memory
**Solution:** Multi-tier caching + LRU eviction + dynamic tier assignment

### Feed Consistency
**Problem:** Concurrent updates + user pagination = duplicates/missing posts
**Solution:** Version management + checksum validation + cursor recalculation

### Real-Time vs Batch Balance
**Problem:** Real-time updates vs system performance
**Solution:** Tiered real-time (Redis only) + graceful degradation + user choice

## Monitoring & Alerting

### Key Metrics
```
Performance Metrics:
├── API Response Time (p95 < 500ms)
├── Cache Hit Ratio (> 95%)
├── Queue Processing Time
├── Database Query Performance
└── Version Mismatch Rate (< 1%)

Business Metrics:
├── Feed Load Success Rate
├── Post Creation Success Rate
├── User Engagement Metrics
├── Daily/Monthly Active Users
└── Real-time Update Delivery Rate
```

### Alert Thresholds
- **Feed Load Time > 1s** → Scale read capacity
- **Queue Depth > 10K** → Scale fanout workers
- **Cache Hit Rate < 90%** → Investigate cache efficiency  
- **Version Mismatch > 5%** → Check fanout service health
- **Celebrity Post Detection** → Monitor pull model performance

## System Evolution Path

### Phase 1: Basic System
- Simple push model for all users
- Single cache layer (Redis)
- Basic pagination without versioning

### Phase 2: Scale Optimizations
- Introduce hybrid push-pull model
- Add Memcached tier
- Implement message queues for async processing

### Phase 3: Advanced Consistency
- Full version management with checksums
- XOR incremental checksums
- Sophisticated cursor handling

### Phase 4: Real-Time Features
- WebSocket integration for Redis tier
- Dynamic tier migration
- Advanced monitoring and alerting

## Critical Design Decisions

### Push vs Pull Trade-offs
| Aspect | Push | Pull | Hybrid |
|--------|------|------|--------|
| Read Speed | Fast | Slow | Fast |
| Write Cost | High | Low | Balanced |
| Storage | High | Low | Optimized |
| Celebrity Handling | Poor | Good | Excellent |

### Cache Tier Strategy
- **Redis:** Hot users needing real-time features and metadata
- **Memcached:** Warm users needing simple fast access
- **Database:** Cold users with on-demand generation

### Version Management Benefits
- **Consistency:** Stable feed experience during user session
- **No Duplicates:** Prevents showing same content twice
- **Data Integrity:** Detects and recovers from corruption
- **Seamless Updates:** New posts don't disrupt pagination

## Interview Deep Dive Topics

### Expected Senior Questions

**"How do you handle a user with 100 million followers?"**
Use pull model - don't precompute their feeds. When users request feeds, fetch recent posts from celebrities in real-time and merge with precomputed content from normal users.

**"What happens when Redis fails?"**
Graceful degradation: Fall back to Memcached (lose real-time features), then database generation. Use Redis Sentinel for automatic failover. Hot users temporarily become warm users.

**"How do you prevent duplicate posts during concurrent updates?"**
Feed versioning with cursor recalculation. Each feed has version ID. Client sends version with requests. Server detects mismatches and uses cursor timestamp to find equivalent position in new feed version.

**"Why both Redis and Memcached instead of just scaling Redis?"**
Cost and feature optimization. Redis provides real-time capabilities (WebSocket sessions, metadata) for active users. Memcached efficiently stores simple post data for warm users at lower cost. Different tiers serve different needs.

**"How do checksums help if you already have versions?"**
Versions handle timing (when feed changed). Checksums handle integrity (what feed contains). Checksums detect data corruption during cache updates, network errors, or race conditions that versions alone cannot catch.

This design scales to billions of users while maintaining feed consistency, optimal performance, and graceful handling of edge cases like celebrity users and real-time updates.