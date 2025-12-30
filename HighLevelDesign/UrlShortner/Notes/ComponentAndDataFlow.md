# URL Shortener - Components & Data Flows

## Component Overview

### Client-Facing Layer

**CDN (CloudFront)**
- Caches static assets (JS/CSS/images)
- Optional: Cache top 1% hot redirects at edge
- Reduces origin load by 40-50%

**API Gateway (Kong)**
- JWT token validation
- Rate limiting: 100 req/hour per IP
- Routes: `/api/v1/*`, `/api/v2/*`
- Stateless, horizontally scalable

---

### Application Services

**URL Shortener Service** `/api/v1/shorten`
- Generates 7-char Base62 short codes
- Validates URLs against blacklist
- Stores mapping in DB Shard via DB Proxy
- Publishes "URL Created" event to Kafka
- Stateless, scales horizontally

**URL Redirect Service** `/api/v1/{code}`
- Checks Redis first (cache hit = 80%+)
- On miss: queries DB Shard, updates cache
- Returns 302 redirect (allows analytics)
- Publishes "URL Accessed" event to Kafka
- Most traffic, scaled to 50+ instances

**Custom URL Service** `/api/v2/custom`
- Authenticated endpoint for vanity URLs
- Checks name availability across shards
- Reserves custom codes
- Lower traffic than standard shortener

**Analytics API** `/api/v1/analytics`
- Queries ClickHouse analytics DB
- Aggregations: clicks by time/geo/referrer
- Read-only, no impact on core service

**Analytics Processor** (Background)
- Consumes events from Kafka
- Enriches with geo-IP, user-agent parsing
- Batch writes to ClickHouse
- Processes 10K events/second

**Auth Service** `/api/v1/auth`
- Registration, login, JWT issuance
- Validates credentials against Auth DB
- Tokens valid 1 hour
- Moderate traffic

---

### Data Layer

**Redis Cluster**
- Master-replica, 3 shards
- Stores hot 20% of URLs (80% of traffic)
- TTL: 24 hours, LRU eviction
- Sub-millisecond reads
- **Why**: Meets p99 < 50ms latency requirement

**DB Proxy (ProxySQL)**
- Routes to shard using `hash(short_code) % 3`
- Connection pooling (1000 connections)
- Query cache for repeated lookups
- **Why**: Abstracts sharding from services

**DB Shards (PostgreSQL x3)**
- Each shard: 30M URLs (year 1)
- Primary-replica for reads
- Index on `short_code` (clustered)
- **Why**: Horizontal scaling beyond single DB limits

**Message Queue (Kafka)**
- Topics: `url_created`, `url_accessed`
- Retention: 7 days
- Partitions: 10 per topic
- **Why**: Async analytics without slowing redirects

**Analytics DB (ClickHouse)**
- Columnar storage for aggregations
- Pre-aggregated hourly/daily summaries
- Raw events + rollup tables
- **Why**: 10-100x faster than PostgreSQL for OLAP

**Auth DB (PostgreSQL)**
- Stores user accounts, hashed passwords
- Separate from URL data
- Lower scale (1M users vs 100M URLs)

---

## Critical Data Flows

### 1. URL Creation Flow
```
Client → API Gateway (validate JWT + rate limit)
  → URL Shortener Service
    → Check Redis (URL already exists?)
    → Generate short code (Base62, 7 chars)
    → Store in DB Shard (via DB Proxy)
    → Add to Redis cache
    → Publish to Kafka (url_created)
  → Return short URL to client
```
**Latency**: ~150ms (p99 < 200ms ✓)

---

### 2. URL Redirect Flow (Cache Hit - 80% of requests)
```
Client → CDN (cache miss) → API Gateway
  → URL Redirect Service
    → Redis: Lookup short code → **FOUND**
    → Async: Publish to Kafka (url_accessed)
    → Return 302 redirect
  → Client redirected
```
**Latency**: ~20ms (p99 < 50ms ✓)

---

### 3. URL Redirect Flow (Cache Miss - 20% of requests)
```
Client → API Gateway → URL Redirect Service
  → Redis: Lookup short code → MISS
  → DB Proxy → DB Shard: Query short_code
  → Add to Redis (TTL 24h)
  → Async: Publish to Kafka (url_accessed)
  → Return 302 redirect
```
**Latency**: ~40ms (p99 < 50ms ✓)

---

### 4. Analytics Processing Flow
```
Kafka (url_accessed events)
  → Analytics Processor (batch of 1000 events)
    → Enrich: Geo-IP lookup, parse user-agent
    → Aggregate: Group by hour, URL, geo
    → Write to ClickHouse (batch insert)

User → Analytics API
  → Query ClickHouse (pre-aggregated tables)
  → Return JSON response
```
**Delay**: 5-10 seconds (eventual consistency acceptable)

---

### 5. Authentication Flow
```
Client → API Gateway → Auth Service
  → Validate credentials against Auth DB
  → Generate JWT (includes user_id, role, exp)
  → Return token

Subsequent requests:
Client (JWT in header) → API Gateway
  → Validate JWT signature (no DB call)
  → Extract user_id from token
  → Route to service
```
**Why stateless**: API Gateway validates without Auth Service call

---

## Scaling Patterns

### Horizontal Scaling (Stateless Services)
- **URL Shortener**: Add instances behind load balancer
- **URL Redirect**: Auto-scale based on CPU (target 70%)
- **Analytics API**: Scale independently of core services

### Database Scaling
- **Vertical**: Larger DB instances (16 → 32 → 64 vCPUs)
- **Horizontal**: Add more shards (3 → 6 → 12)
- **Read replicas**: Route read traffic to replicas

### Cache Scaling
- **Vertical**: Larger Redis instances (8GB → 16GB → 32GB)
- **Horizontal**: More Redis shards (3 → 6)
- **TTL tuning**: Reduce TTL if memory constrained

### Queue Scaling
- **Partitions**: Increase Kafka partitions (10 → 20)
- **Consumers**: Add Analytics Processor instances
- **Retention**: Reduce if storage is issue (7d → 3d)

---

## Failure Handling

### Redis Failure
- **Impact**: Cache miss for all requests
- **Fallback**: Direct DB queries (increased latency)
- **Mitigation**: Replica promotion, multi-AZ

### DB Shard Failure
- **Impact**: 1/3 of URLs unavailable
- **Fallback**: Replica promotion (< 1 min)
- **Mitigation**: Cross-AZ replicas, automated failover

### Kafka Failure
- **Impact**: Analytics delayed, core service unaffected
- **Fallback**: Events buffer in service memory (5 min)
- **Mitigation**: Multi-broker setup, replication

### Service Failure
- **Impact**: Reduced capacity, not complete outage
- **Mitigation**: Multiple instances, health checks, auto-restart

---

## Security Layers

### Network Level
- VPC with private subnets for databases
- Security groups: Only allow necessary ports
- TLS 1.3 for all external communication

### Application Level
- JWT validation at API Gateway
- Rate limiting per IP/user
- Input validation, SQL injection prevention

### Data Level
- Hashed passwords (bcrypt)
- Encrypted data at rest (RDS encryption)
- URL blacklist (malware, phishing)

### Monitoring
- Failed auth attempts (potential attacks)
- Unusual traffic patterns (DDoS)
- Anomalous URLs (spam campaigns)