# URL Shortener - Non-Functional Requirements & Design Decisions

## 1. Non-Functional Requirements

### Performance Requirements
- **Latency**: 
  - URL redirect: < 50ms (p99)
  - URL creation: < 200ms (p99)
  - Analytics query: < 1s (p95)
- **Throughput**: 
  - 10,000 URL redirects/second
  - 100 URL creations/second
  - Read:Write ratio of 100:1

### Scalability Requirements
- **Growth**: Support 100M URLs in first year, 1B in 5 years
- **Traffic**: Handle 10x traffic spikes during viral events
- **Geographic**: Serve users globally with < 100ms additional latency

### Availability Requirements
- **Uptime**: 99.9% availability (43 minutes downtime/month)
- **Recovery**: RTO < 15 minutes, RPO < 5 minutes
- **Degradation**: Graceful degradation when dependencies fail

### Data Requirements
- **Retention**: URLs active for minimum 5 years unless deleted
- **Consistency**: Eventual consistency acceptable for analytics
- **Durability**: 99.999% durability for URL mappings

### Security Requirements
- **Authentication**: JWT-based with 1-hour expiry
- **Rate Limiting**: 100 requests/hour per IP for creation
- **Protection**: DDoS mitigation, malicious URL blocking
- **Encryption**: TLS 1.3 for all communications

---

## 2. Key Design Decisions

### Decision 1: Redis for Caching Layer
**Context**: Need fast lookups for frequently accessed URLs

**Decision**: Use Redis Cluster with master-replica configuration

**Rationale**:
- Sub-millisecond read latency for cache hits
- Power-law distribution means 20% URLs = 80% traffic
- Single-threaded nature is acceptable for simple key-value lookups
- Built-in replication for high availability

**Alternatives Considered**:
- Memcached: Lacks persistence and advanced data structures
- Application-level cache: Doesn't scale across instances

**Trade-offs**:
- ✅ Extremely fast reads
- ✅ Reduces database load by 90%+
- ❌ Additional infrastructure complexity
- ❌ Cache invalidation challenges

---

### Decision 2: Database Sharding by Short Code Hash
**Context**: Single database cannot handle billions of URLs

**Decision**: Shard PostgreSQL databases using consistent hashing of short code

**Rationale**:
- Predictable shard lookup (hash(short_code) % num_shards)
- Even distribution of data across shards
- No cross-shard queries needed for core operations
- Each shard independently scalable

**Alternatives Considered**:
- Range-based sharding: Leads to hot shards
- User-based sharding: Complicates anonymous URL lookups

**Trade-offs**:
- ✅ Horizontal scalability
- ✅ No single point of bottleneck
- ❌ Complex shard rebalancing when adding shards
- ❌ Analytics queries become more complex

---

### Decision 3: Asynchronous Analytics via Message Queue
**Context**: Click tracking must not slow down redirects

**Decision**: Use Kafka to decouple event publishing from processing

**Rationale**:
- Redirects complete in < 50ms without waiting for analytics
- Buffering handles traffic spikes without data loss
- Analytics Processor can batch process for efficiency
- Separate scaling of analytics infrastructure

**Alternatives Considered**:
- Synchronous database writes: Would violate latency requirements
- Log aggregation: Less reliable, harder to guarantee delivery

**Trade-offs**:
- ✅ Fast redirects (NFR met)
- ✅ Analytics survives traffic spikes
- ❌ Analytics delayed by 5-10 seconds
- ❌ Additional infrastructure component

---

### Decision 4: CDN for Static Assets and Hot URLs
**Context**: Reduce latency for global users

**Decision**: CloudFront CDN for static assets; optional caching of top 1% URLs

**Rationale**:
- Edge caching reduces latency by 100-200ms globally
- Offloads 40-50% of redirect traffic for viral URLs
- Built-in DDoS protection
- Geographic proximity to users

**Alternatives Considered**:
- No CDN: Poor global performance
- Multi-region deployment: More complex, higher cost

**Trade-offs**:
- ✅ Meets global latency requirements
- ✅ Reduces origin server load
- ❌ Cache invalidation complexity
- ❌ Additional cost for high traffic

---

### Decision 5: Separate Analytics Database
**Context**: Analytics queries must not impact core service

**Decision**: Use ClickHouse columnar database for analytics

**Rationale**:
- Optimized for OLAP workloads (aggregations, time-series)
- 10-100x faster than PostgreSQL for analytical queries
- Compression reduces storage costs
- No impact on operational database performance

**Alternatives Considered**:
- Same PostgreSQL database: Would impact redirect performance
- NoSQL (MongoDB): Not optimized for aggregations

**Trade-offs**:
- ✅ Fast complex queries
- ✅ Isolated from core service
- ❌ Additional database to maintain
- ❌ Data duplication

---

### Decision 6: JWT-Based Stateless Authentication
**Context**: Need scalable authentication across services

**Decision**: JWT tokens validated at API Gateway

**Rationale**:
- No session storage required (stateless)
- API Gateway can validate without calling Auth Service
- Tokens include user ID and permissions
- Standard, well-supported approach

**Alternatives Considered**:
- Session-based: Requires shared session store
- OAuth delegation: Unnecessary complexity for first version

**Trade-offs**:
- ✅ Horizontally scalable
- ✅ Fast validation (no network call)
- ❌ Cannot revoke tokens before expiry
- ❌ Token size larger than session ID

---

### Decision 7: Base62 Encoding for Short Codes
**Context**: Need short, URL-safe identifiers

**Decision**: 7-character Base62 codes (a-z, A-Z, 0-9)

**Rationale**:
- 62^7 = 3.5 trillion possible codes
- URL-safe without encoding
- Collision probability negligible with random generation
- Human-readable (no special characters)

**Alternatives Considered**:
- UUID: Too long (36 characters)
- Base64: Contains URL-unsafe characters (/, +)
- Sequential IDs: Predictable, security concern

**Trade-offs**:
- ✅ Compact representation
- ✅ Sufficient keyspace
- ❌ Requires collision checking
- ❌ Not sortable by creation time

---

## 3. NFR → Design Mapping

| NFR | Design Decision | Component |
|-----|----------------|-----------|
| Redirect < 50ms | Redis caching, CDN | Redis Cluster, CloudFront |
| 10K redirects/sec | Horizontal scaling, stateless | URL Redirect Service |
| 100:1 read ratio | Read-optimized caching | Redis, DB read replicas |
| 99.9% availability | Multi-AZ deployment, replication | All services |
| Eventual consistency OK | Async analytics processing | Message Queue, Analytics Processor |
| Global < 100ms | CDN, multi-region option | CloudFront |
| Handle spikes | Message Queue buffering | Kafka |
| Billions of URLs | Database sharding | DB Proxy, DB Shards |

---

## 4. Capacity Planning (Year 1)

### Assumptions
- 100M URLs created
- 10B redirects (100:1 ratio)
- Average URL size: 2KB (including metadata)

### Storage Requirements
- URL database: 100M × 2KB = 200GB
- Analytics (raw events): 10B × 500 bytes = 5TB
- Analytics (aggregated): ~100GB

### Compute Requirements
- URL Shortener: 5 instances (20 req/sec each)
- URL Redirect: 50 instances (200 req/sec each)
- Analytics Processor: 10 instances

### Cache Requirements
- Redis: 20% of URLs cached = 20M × 2KB = 40GB
- With replication: 80GB total

---

## 5. Monitoring & SLIs

### Service Level Indicators
- **Availability**: Successful redirects / Total redirect attempts
- **Latency**: p50, p95, p99 redirect time
- **Error Rate**: 5xx errors / Total requests
- **Cache Hit Rate**: Redis hits / Total lookups

### Key Metrics
- Redirect success rate > 99.9%
- Cache hit rate > 80%
- p99 redirect latency < 50ms
- Queue lag < 10 seconds

### Alerts
- Error rate > 1% for 5 minutes
- p99 latency > 100ms for 5 minutes
- Cache hit rate < 70%
- Queue lag > 60 seconds