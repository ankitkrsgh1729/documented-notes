# URL Shortener - Part 2: Architecture & Design

**Navigation**: [← Part 1: Requirements & Capacity](NonFunctionalReq)

---

## 1. High-Level Architecture

```
Client → CDN → API Gateway → [URL Shortener | URL Redirect | Analytics API | Auth]
                                      ↓              ↓             ↓
                                Redis Cache ← → DB Proxy → DB Shards (128)
                                      ↓
                              Message Queue (Kafka)
                                      ↓
                          Analytics Processor → Analytics DB (ClickHouse)
```

## 2. Key Components

### API Gateway
- **Purpose**: Single entry point, security, routing
- **Responsibilities**: JWT validation, rate limiting, request routing
- **Rate limits**: 100 req/min (anonymous), 1,000 req/min (authenticated)
- **Instances**: 5-10 (handles 5,000 req/sec easily)

### URL Shortener Service
- **Endpoint**: `POST /api/v1/shorten`
- **Function**: Generate short codes, store mappings
- **Instances**: 10-15 (each handles ~30 writes/sec)

### URL Redirect Service (Critical Path)
- **Endpoint**: `GET /{shortCode}`
- **Function**: Lookup and redirect (< 10ms target)
- **Instances**: 50-100 (each handles ~50 reads/sec)
- **Why separate**: Different scaling needs (100x more reads)

### Redis Cache Cluster
- **Configuration**: 5 master + 5 replica nodes, 100 GB each
- **Total memory**: 500 GB
- **Eviction**: LRU (Least Recently Used), 24hr TTL
- **Throughput**: 1M+ ops/sec per node
- **Why Redis**: Sub-ms latency, built-in replication, persistence

### Database Architecture

#### Why Database Sharding?
**Problem with single DB**:
- PostgreSQL handles ~10M rows efficiently (indexes in memory)
- Beyond 10M: Index lookups slow, queries degrade
- Single server limits: CPU, memory, IOPS bottleneck

**Solution: Horizontal Sharding**
- **Partitioning**: Split data across multiple DB instances
- **Sharding key**: `hash(short_code) % num_shards`
- **Benefit**: Each shard manages 10M records (optimal)
- **Scalability**: Add shards linearly as data grows

**Sharding vs Other Approaches**:

| Approach | Pros | Cons | Our Choice |
|----------|------|------|------------|
| **Sharding** | Linear scalability, independent failure | Complex routing | ✅ Yes |
| **Vertical scaling** | Simple, no code changes | Hardware limits, expensive | ❌ Doesn't scale |
| **Read replicas** | Helps reads, simple | Doesn't help writes or storage | ✅ Use with sharding |
| **Partitioning (single DB)** | Simpler than sharding | Single point of failure | ❌ Not enough |

**How sharding helps**:
1. **Writes distributed**: 116 writes/sec ÷ 128 shards = <1 write/sec per shard
2. **Reads distributed**: Even with cache misses, each shard handles minimal load
3. **Storage distributed**: 18.25B records ÷ 128 shards = 142M per shard (manageable)
4. **Independent scaling**: Add/upgrade shards independently

#### DB Proxy (ProxySQL/Vitess)
- **Purpose**: Abstract sharding complexity from application
- **Functions**:
  - Route queries to correct shard: `shard_id = hash(short_code) % 128`
  - Connection pooling: 1000 app connections → 10 DB connections
  - Query caching, failover handling
- **Instances**: 3-5 (HA setup)

#### Database Shards (PostgreSQL)
- **Initial**: 128 shards (grows to ~1,825 over 5 years)
- **Per shard**: 1 primary + 2 read replicas
- **Storage per shard**: ~1 TB (10M records)
- **Schema**:
```sql
CREATE TABLE url_mappings (
    short_code VARCHAR(7) PRIMARY KEY,
    original_url TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP,
    INDEX idx_user_id (user_id)
);
```

**Why PostgreSQL**: ACID compliance (no duplicate codes), mature replication, JSON support

### Message Queue (Kafka)
- **Topics**: `url.created` (low volume), `url.accessed` (high volume)
- **Configuration**: 50 partitions, 7-day retention, replication factor 3
- **Consumer groups**: Analytics processor (20 consumers), audit log (2 consumers)
- **Why Kafka**: High throughput (millions msg/sec), durable, scales horizontally

### Analytics Processor
- **Function**: Consume events, enrich (geo-location), aggregate by minute/hour/day
- **Batch size**: 1,000 events
- **Processing delay**: 2-5 minutes
- **Instances**: 10-20 workers

### Analytics DB (ClickHouse)
- **Purpose**: Store and query aggregated analytics
- **Why ClickHouse**: Columnar storage (fast aggregations), handles billions of rows
- **Storage**: 20 TB/year

### Auth Service
- **Endpoints**: `/api/v1/auth/register`, `/api/v1/auth/login`
- **Function**: User management, JWT token issuance (7-day expiry)
- **Instances**: 5

## 3. Data Flows

### 3.1 URL Shortening Flow (~70ms)
```
1. Client → API Gateway (auth + rate limit) [5ms]
2. API Gateway → URL Shortener Service
3. Validate URL, generate base62 code [10ms]
4. Check collision: Redis → DB if needed [20ms]
5. Write to DB via proxy [30ms]
6. Update Redis cache (TTL: 24h) [5ms]
7. Publish to Kafka (url.created) [10ms async]
8. Return short URL to client
```

### 3.2 URL Redirection - Cache Hit (~5-8ms)
```
1. Client → API Gateway [2ms]
2. API Gateway → URL Redirect Service
3. Redis.get(short_code) → Cache HIT [1ms]
4. Async: Publish to Kafka (url.accessed)
5. Return HTTP 302 redirect to client
```

### 3.3 URL Redirection - Cache Miss (~40-50ms)
```
1. Client → API Gateway
2. API Gateway → URL Redirect Service
3. Redis.get(short_code) → Cache MISS
4. DB Proxy → Query correct shard [30-40ms]
5. Redis.set(short_code, url, TTL=24h) [5ms]
6. Async: Publish to Kafka (url.accessed)
7. Return HTTP 302 redirect to client
```

### 3.4 Analytics Processing Flow (~2-5 min delay)
```
1. Kafka topics (url.created, url.accessed) accumulate events
2. Analytics Processor consumes events in batches (1,000)
3. Enrich data:
   - Geo-location lookup from IP
   - Parse user agent (device, browser, OS)
4. Aggregate by time windows (minute/hour/day)
5. Bulk insert to ClickHouse (Analytics DB)
6. Data now queryable via Analytics API
```

### 3.5 Authentication Flow (~50ms)
```
1. Client → API Gateway (POST /auth/login)
2. API Gateway → Auth Service
3. Auth Service queries Auth DB (validate credentials) [20ms]
4. Generate JWT token (HS256, 7-day expiry)
   {
     "user_id": 12345,
     "email": "user@example.com",
     "exp": 1640000000
   }
5. Return token + refresh token (30-day) to client
6. Client stores in httpOnly cookie (secure)

For subsequent requests:
7. Client → API Gateway (with JWT in Authorization header)
8. API Gateway validates token (signature + expiry)
9. If valid: route to service; if invalid: 401 Unauthorized
```

## 4. Key Algorithms

### 4.1 Short Code Generation
```python
def generate_short_code():
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    code = ''.join(random.choice(charset) for _ in range(7))
    
    # Fast collision check
    if redis.exists(code):
        if db.exists(code):  # Confirm in DB
            return generate_short_code()  # Retry (rare)
    return code
```

**Why random over counter**:
- ✅ No coordination needed (scales horizontally)
- ✅ Even distribution across shards
- ✅ Doesn't leak business metrics
- ❌ Possible collisions (0.014% after 1B URLs, acceptable with retry)

**Alternative: Counter-based**:
- ❌ Single point of coordination (bottleneck)
- ❌ Sequential codes reveal volume
- ❌ Doesn't meet 348 writes/sec peak

### 4.2 Rate Limiting (Token Bucket in Redis)
```python
key = f"ratelimit:{user_id_or_ip}"
current = redis.incr(key)
if current == 1:
    redis.expire(key, 60)  # 60-second window

if current > limit:
    return 429  # Too Many Requests
```

### 4.3 Cache Strategy
```python
# Set on write
redis.setex(short_code, 86400, original_url)  # 24h TTL

# Get on read
url = redis.get(short_code)
if url is None:  # Cache miss
    url = db_proxy.query(short_code)
    redis.setex(short_code, 86400, url)
return url
```

**Eviction**: LRU at 95% memory (naturally keeps hot URLs)

## 5. Critical Trade-offs

| Decision | Choice | Why |
|----------|--------|-----|
| **CAP Theorem** | AP (Availability + Partition tolerance) | Redirects must always work; analytics can lag 5 min |
| **Code generation** | Random | Scales writes horizontally; no coordination bottleneck |
| **Database** | SQL (PostgreSQL) | ACID prevents duplicate codes; structured relationships |
| **HTTP redirect** | 302 (temporary) | Track every click; 301 caches in browser (no analytics) |
| **Analytics** | Asynchronous (Kafka) | Don't slow redirects (critical path); handle traffic spikes |
| **CDN caching** | No (for redirects) | Accurate analytics > latency; can update URLs |

## 6. Failure Handling

### Redis Cluster Failure (MTTR: 5 min)
- **Impact**: Cache miss storm → DB load spike
- **Mitigation**: 
  1. Promote replica to master
  2. Circuit breaker limits DB queries
  3. Return cached responses if available
  4. System degrades but stays available

### DB Shard Failure (MTTR: 30 sec)
- **Impact**: 0.78% of URLs unavailable (1/128 shards)
- **Mitigation**:
  1. DB proxy detects failure (health check)
  2. Promote read replica to primary
  3. Update routing, rebuild new replica

### Viral URL (100M requests in 1 hour)
- **Handling**:
  1. Redis handles load (1M+ ops/sec per node)
  2. Auto-scale redirect service (50 → 200 instances)
  3. Kafka partitions distribute event load
  4. Optional: Manual CDN caching for this specific URL

### Cache Stampede (1000 concurrent misses)
- **Problem**: Popular URL expires, all requests hit DB
- **Solution**: Lock pattern
```python
lock_key = f"lock:{short_code}"
if redis.set(lock_key, 1, nx=True, ex=10):  # Acquire lock
    url = db.query(short_code)
    redis.setex(short_code, 86400, url)
    redis.delete(lock_key)
else:
    time.sleep(0.05)  # Wait for first request to populate cache
    return redis.get(short_code)
```

## 7. Monitoring & Metrics

**Critical Alerts** (page on-call):
- Latency p99 > 100ms for 10 min
- Error rate > 1% for 5 min
- Availability < 99% for 5 min
- Cache hit rate < 80%

**Key Metrics**:
- Requests/sec (reads, writes)
- Latency p50, p99, p999
- Cache hit rate (target: 95%+)
- Kafka lag (target: < 1 min)
- DB connection pool usage
- Disk usage per shard

## 8. Scaling Timeline

### Phase 1: MVP (0-1M users, ~$5K/month)
- 8 DB shards, 50 GB Redis
- Single region, basic analytics

### Phase 2: Growth (10M-100M users, ~$100K/month)
- 128 DB shards, 500 GB Redis
- Multi-region (US + EU), real-time analytics

## 9. Interview Talking Points

**Q: Why sharding over vertical scaling?**
A: Vertical scaling hits hardware limits (~10M records optimal per DB). Sharding provides linear scalability—add shards as data grows. Our 18.25B records need ~1,825 shards over 5 years.

**Q: How does sharding work?**
A: Hash-based: `shard_id = hash(short_code) % 128`. All queries include short_code, so no cross-shard queries. DB proxy handles routing transparently.

**Q: Why 302 not 301?**
A: 301 = permanent redirect, browsers cache forever → can't track subsequent clicks, can't update destination. 302 = temporary, every click hits our server → analytics accuracy.

**Q: What if Redis dies?**
A: Promote replica (5 min). During outage: cache misses → DB load spike → circuit breaker limits queries → degrade gracefully (serve some requests, drop others) → system stays partially available.

**Q: Why Redis over Memcached?**
A: Built-in replication/persistence, rich data structures, single-threaded but handles 1M+ ops/sec per node (sufficient for our 3,471 peak reads/sec distributed across 5 nodes).

---

**Navigation**: [← Part 1: Requirements & Capacity](NonFunctionalReq)