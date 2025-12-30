# URL Shortener - Part 1: Requirements & Capacity

**Navigation**: [Part 2: Architecture & Design →](ComponentAndDataFlow)

---

## 1. Functional Requirements

### Core Features
- **URL Shortening**: Convert long URLs to 7-character short codes
- **URL Redirection**: Redirect short URLs to original URLs (< 10ms)
- **Custom URLs**: Vanity URLs for authenticated users
- **Analytics**: Track clicks, geography, referrers, devices
- **User Management**: Registration, authentication, URL ownership

### Out of Scope (MVP)
- Link expiration, QR codes, A/B testing

## 2. Non-Functional Requirements

### Performance
- **Latency**: Redirection < 10ms (p99), Creation < 100ms (p99)
- **Read-heavy**: 100:1 read-to-write ratio
- **Availability**: 99.9% uptime (8.76 hours downtime/year)

### Scale
- **Users**: 100M Daily Active Users (DAU)
- **Traffic spikes**: Handle 3x normal load

### Data
- **Retention**: URLs persist indefinitely
- **Durability**: 99.999999999% (11 nines)

## 3. Capacity Estimation

### 3.1 Traffic Estimates

#### Assumptions (Clarify in Interview)
- **DAU**: 100M users
- **URLs per user per day**: 0.1 (most users don't create URLs daily)
- **Clicks per URL per day**: 10 (average)
- **Peak traffic**: 3x average
- **Read:Write ratio**: 100:1 (conservative estimate)

#### Write Traffic (URL Creation)
- URLs/day: 100M × 0.1 = **10M URLs/day**
- Write QPS: 10M / 86,400 = **116 writes/sec**
- Peak write QPS: 116 × 3 = **348 writes/sec**

#### Read Traffic (URL Redirection)
- Redirects/day: 10M × 10 = **100M redirects/day**
- Read QPS: 100M / 86,400 = **1,157 reads/sec**
- Peak read QPS: 1,157 × 3 = **3,471 reads/sec**

### 3.2 Storage Estimates

#### URL Mapping Storage (5 years)
**Per URL Record**:
- Short code: 7 bytes
- Original URL: 2,000 bytes (average)
- User ID: 8 bytes
- Timestamps + metadata: ~200 bytes
- **Total**: ~2.2 KB per record

**Total Storage**:
- URLs over 5 years: 10M/day × 1,825 days = **18.25B URLs**
- Raw storage: 18.25B × 2.2 KB = **40 TB**
- With 3x replication: **120 TB**

#### Analytics Storage (1 year)
**Per Click Event**: ~0.5 KB (timestamp, IP, user agent, referrer)

**Total Storage**:
- Click events/year: 100M/day × 365 = 36.5B events
- Raw events: 36.5B × 0.5 KB = **18 TB**
- Aggregated data: ~2 TB
- **Total**: **~20 TB/year**

### 3.3 Memory (Cache) Estimates

#### Strategy: Cache Hot URLs
- **80-20 rule**: 20% of URLs get 80% of traffic
- **Practical cache**: 1% of total URLs = 182.5M URLs
- **Memory needed**: 182.5M × 2.2 KB = **400 GB**
- **Expected hit rate**: 95%+ (power-law distribution)

### 3.4 Bandwidth Estimates

#### Incoming (URL Creation)
- QPS: 116 × request size (2.5 KB) = **2.3 Mbps** (peak: 7 Mbps)

#### Outgoing (URL Redirection)
- QPS: 1,157 × response size (0.5 KB) = **4.6 Mbps** (peak: 14 Mbps)

### 3.5 Database Sharding Requirements

**Why shard?**
- Single DB limit: ~10M records perform well (indexes fit in memory)
- Our scale: 18.25B records over 5 years
- **Need**: 18.25B / 10M = **~1,825 shards** (over 5 years)

**Initial deployment**:
- Start with **128 shards** (room to grow)
- Add shards as data grows

## 4. Short Code Design

### Character Set & Length
- **Character set**: Base62 (a-z, A-Z, 0-9) = 62 characters
- **Capacity needed**: 73B URLs (10M/day × 10 years × 2 safety margin)

**Length calculation**:
- 6 chars: 62^6 = 56.8B ❌ (insufficient)
- 7 chars: 62^7 = 3.5T ✅ (plenty!)
- 8 chars: 62^8 = 218T (overkill)

**Decision**: **7 characters**

### Collision Probability
- After 1B URLs: ~0.014% chance
- With 3 retries: ~0.00000027% (acceptable)

## 5. High-Level Numbers Summary

| Metric | Value | Notes |
|--------|-------|-------|
| Write QPS | 116 (peak: 348) | URL creation |
| Read QPS | 1,157 (peak: 3,471) | Redirection (100x writes) |
| Storage (5 years) | 120 TB | With 3x replication |
| Analytics (1 year) | 20 TB | Raw + aggregated |
| Cache memory | 400 GB | 1% of URLs, 95%+ hit rate |
| DB shards (initial) | 128 | Scale to 1,825 over 5 years |
| Bandwidth | ~7 Mbps | Peak incoming/outgoing |
| Short code length | 7 chars | 3.5T capacity (base62) |

---

**Next**: [Part 2: Architecture & Design →](ComponentAndDataFlow)