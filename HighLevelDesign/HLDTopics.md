# System Design Deep Dive — Load Balancer · Consistent Hashing · Caching

**Purpose:** Consolidated, interview-ready reference with theory + concrete Java examples + common pitfalls and model answers.

## Table of Contents

1. [Load Balancers](#load-balancers)
2. [Consistent Hashing](#consistent-hashing)
3. [Caching](#caching)
4. [Putting it Together](#putting-it-together--which-to-use-when-quick-guide)
5. [Final Interview Checklist](#final-checklist-for-interviews--architecture-answers)

---

## Load Balancers

### Generic Description
A load balancer distributes incoming network or application traffic across multiple backend servers so the service is available, responsive, and scalable.

### Why Used
- Avoid overloading a single server
- Increase availability and fault tolerance
- Enable horizontal scaling and seamless rolling deployments
- Route traffic based on intelligent rules (path, header, client, etc.)

### Advantages
- Better utilization of resources
- Failover and graceful degradation
- Centralized place for SSL termination, rate limiting, WAF policies

### Sub-categories / Types
- **Layer 4 (Transport)** — TCP/UDP (fast, protocol-agnostic)
- **Layer 7 (Application)** — HTTP-aware (routing by path, header, cookie)
- **DNS / Global LB** — geo-routing, multi-region
- **Client-side LB** — the client chooses/picks backend from a registry (useful in microservices clusters)

### Routing Algorithms & Java Examples

#### Round Robin (simple)
Use for stateless, equal-capacity servers.

```java
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public class RoundRobin {
    private final List<String> servers;
    private final AtomicInteger idx = new AtomicInteger(0);

    public RoundRobin(List<String> servers) { 
        this.servers = servers; 
    }

    public String next() {
        int i = Math.abs(idx.getAndUpdate(x -> (x + 1) % servers.size()));
        return servers.get(i);
    }
}
```

#### Weighted Round Robin
Assign heavier servers more traffic.

```java
import java.util.List;

class Server {
    final String name; 
    final int weight;
    
    Server(String name, int weight) { 
        this.name = name; 
        this.weight = weight; 
    }
}

public class WeightedRoundRobin {
    private final List<Server> servers;
    private int currentIndex = -1;
    private int currentWeight = 0;
    private final int maxWeight;
    private final int gcdWeight;

    public WeightedRoundRobin(List<Server> servers) {
        this.servers = servers;
        int max = 0;
        for (Server s : servers) max = Math.max(max, s.weight);
        this.maxWeight = max;
        this.gcdWeight = computeGCDForAll(servers);
    }

    public Server next() {
        while (true) {
            currentIndex = (currentIndex + 1) % servers.size();
            if (currentIndex == 0) {
                currentWeight = currentWeight - gcdWeight;
                if (currentWeight <= 0) {
                    currentWeight = maxWeight;
                    if (currentWeight == 0) return null;
                }
            }
            if (servers.get(currentIndex).weight >= currentWeight) {
                return servers.get(currentIndex);
            }
        }
    }

    private int computeGCDForAll(List<Server> list) { 
        /* gcd code omitted for brevity */ 
        return 1; 
    }
}
```

#### Least Connections (concept)
Track active connection counts per server and choose the server with fewest active connections. Good for long-lived connections (WebSockets).

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

class LeastConnLB {
    private final List<String> servers;
    private final ConcurrentHashMap<String, AtomicInteger> connCount = new ConcurrentHashMap<>();

    public LeastConnLB(List<String> servers) {
        this.servers = servers;
        servers.forEach(s -> connCount.put(s, new AtomicInteger(0)));
    }

    public String choose() {
        return servers.stream()
            .min((a,b) -> Integer.compare(connCount.get(a).get(), connCount.get(b).get()))
            .get();
    }

    // call when connection opens/closes
    public void inc(String server) { 
        connCount.get(server).incrementAndGet(); 
    }
    
    public void dec(String server) { 
        connCount.get(server).decrementAndGet(); 
    }
}
```

#### IP Hash / Sticky Session (affinity)
Deterministically send same client to same server (cookie-based or IP-hash). Useful for legacy apps with in-memory sessions.

```nginx
# NGINX sticky cookie example (conceptual)
upstream backends {
    server s1:8080;
    server s2:8080;
    sticky cookie srv_id expires=1h;
}
```

### Sticky Sessions — Pros / Cons / Best Practice

**Pros:**
- Quick way to support session-heavy legacy apps (no code changes)

**Cons:**
- Uneven load: heavy users stick to same node
- Single point-of-failure for user's session if node dies (unless sessions replicated)
- Harder to autoscale and utilize pool effectively

**Better approach:**
- Make app stateless or store session in a distributed store (Redis, Memcached, DB) or use JWT tokens
- Use sticky sessions only as a stop-gap

### Health Checks & Graceful Draining
- Expose `/health`, `/ready`, `/metrics`
- LB should periodically probe; mark unhealthy nodes out
- Before taking instance down, enable draining: stop new connections, wait for active requests to finish

### Observability & Autoscaling
- Measure request latency, error rate, connections, CPU/memory per backend
- Use LB metrics to trigger autoscaling (e.g., CPU > 70% or p95 latency > threshold)

### Interview Q&A (Load Balancer)

**Q: Layer 4 vs Layer 7 — when to use each?**

**A (model):** Use L4 for raw speed and protocol-agnostic routing (TCP/UDP). Use L7 when routing decisions must consider HTTP fields (path, host, header), for TLS termination, auth, WAF.

**Q: How would you implement sticky sessions safely?**

**A (model):** Prefer stateless apps + a centralized session store (Redis). If impossible, use cookie-based affinity with session replication or sticky as short-term solution; add health checks and session replication where possible.

---

## Consistent Hashing

### Generic Description
Consistent hashing maps keys and nodes into the same hash space (ring). A key is assigned to the first node clockwise. When nodes are added/removed, only a small subset of keys are remapped.

### Why Used
- Minimizes key movement when scaling
- Makes cache rebalancing cheap and practical
- Ideal for distributed caches, DHTs, sharded storage

### Advantages
- Low churn on scaling events
- Can be made balanced via virtual nodes and weights
- Facilitates simple replication strategies (take next R nodes clockwise)

### Sub-categories / Variations
- Basic consistent hashing
- Consistent hashing with virtual nodes (vNodes)
- Weighted consistent hashing (assign more vNodes to powerful machines)
- Replication-aware hashing (return multiple nodes per key)

### Node vs Virtual Node — Intuitive Explanation

**Node:** A physical machine / cache instance.

**Virtual Node (vNode):** Each physical node is represented by many logical points on the ring. This evens out the key distribution and makes load less dependent on number of physical nodes and exact hashes.

**Visual:** Imagine the ring has 1,000 positions; mapping 3 nodes means each node might occupy a few positions. With vNodes, Node A may occupy positions A#0..A#99, Node B B#0..B#99, etc., smoothing variance.

### Full Java Implementation (generic, with vNodes and replication)

```java
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

public class ConsistentHash<T> {
    private final SortedMap<Long, T> ring = new TreeMap<>();
    private final int vNodeCount;
    private final MessageDigest md;

    public ConsistentHash(int vNodeCount) throws Exception {
        this.vNodeCount = Math.max(1, vNodeCount);
        this.md = MessageDigest.getInstance("MD5");
    }

    private long hash(String key) {
        byte[] digest = md.digest(key.getBytes(StandardCharsets.UTF_8));
        // use first 8 bytes to form positive long
        long h = 0;
        for (int i = 0; i < 8; i++) { 
            h = (h << 8) | (digest[i] & 0xff); 
        }
        return h & 0x7fffffffffffffffL;
    }

    public void addNode(T node) {
        for (int i = 0; i < vNodeCount; i++) {
            ring.put(hash(node.toString() + "#" + i), node);
        }
    }

    public void removeNode(T node) {
        for (int i = 0; i < vNodeCount; i++) {
            ring.remove(hash(node.toString() + "#" + i));
        }
    }

    public T getNode(String key) {
        if (ring.isEmpty()) return null;
        long h = hash(key);
        SortedMap<Long, T> tail = ring.tailMap(h);
        Long nodeKey = tail.isEmpty() ? ring.firstKey() : tail.firstKey();
        return ring.get(nodeKey);
    }

    // For replication: get next 'count' distinct nodes clockwise
    public List<T> getNodes(String key, int count) {
        List<T> result = new ArrayList<>();
        if (ring.isEmpty()) return result;
        long h = hash(key);
        Iterator<Long> it = ring.tailMap(h).keySet().iterator();
        Set<T> seen = new HashSet<>();
        while (result.size() < count) {
            if (!it.hasNext()) it = ring.keySet().iterator();
            T node = ring.get(it.next());
            if (seen.add(node)) result.add(node);
        }
        return result;
    }
}
```

### Practical Concerns & Mitigations

#### Rebalancing Impact
- **With consistent hashing:** only keys belonging to the added/removed node are moved (~1/N)
- **With modulo key % N:** almost all keys remap

#### Hotspots
If a particular key is extremely hot, consistent hashing alone won't help. Mitigate with replication and pre-splitting (shard the key into multiple logical keys).

#### Weighted Nodes
Assign more virtual nodes to powerful machines (e.g., vNodeCount proportional to capacity).

### Interview Q&A (Consistent Hashing)

**Q: Why use vNodes?**

**A (model):** vNodes flatten distribution variance: each physical node owns many small ranges, so random distribution evens out even if hash function is imperfect or N is small.

**Q: How to support replication with consistent hashing?**

**A (model):** After finding the primary node clockwise for a key, choose the next R-1 unique nodes clockwise as replicas. Ensure those nodes are healthy and use anti-entropy to recover diverged replicas.

---

## Caching

### Generic Description
A cache stores copies of frequently accessed data in fast storage (memory) to reduce latency and backend load.

### Why Used
- Serve reads quickly (ms → sub-ms)
- Reduce database / computation cost
- Smooth traffic spikes (buffering)

### Advantages
- Low-latency responses, better user experience
- Reduced load and cost on origin systems
- Can be layered (local + distributed) for extra performance

### Sub-categories / Patterns
- **Cache-Aside (Lazy Load)** — app checks cache, on miss reads DB and populates cache
- **Read-Through** — cache itself loads from DB when missing (transparent to app)
- **Write-Through** — writes synchronously update cache + DB
- **Write-Behind (Write-Back)** — write to cache, background flusher writes to DB
- **Local (in-process) vs Distributed** — local is fastest but not shared; distributed (Redis, memcached) shared across nodes

### Eviction Policies
- **LRU** — evict least recently used
- **LFU** — evict least frequently used
- **TTL** — time-based expiry
- **Size-based** — evict when memory exceeds limit

## Detailed Comparison

| Aspect | Cache-Aside | Write-Through | Write-Behind |
|--------|-------------|---------------|--------------|
| **Write responsibility** | App writes to DB, then manages cache | Cache system writes to both cache and DB | Cache system writes to cache, then DB async |
| **Read performance** | Fast after cache is populated | Fast (always in cache) | Fast (always in cache) |
| **Write performance** | Fast (only DB write) | Slower (synchronous dual write) | Fastest (async DB write) |
| **Data consistency** | Eventually consistent | Strong consistency | Eventually consistent |
| **Complexity** | Higher (app manages cache) | Lower (cache handles it) | Medium (async handling needed) |
| **Cache population** | Lazy (on first read) | Eager (on every write) | Eager (on every write) |
| **Cache miss handling** | App loads from DB | Cache loads from DB | Cache loads from DB |
| **Failure handling** | Cache failures don't block DB ops | Cache failure can block writes | Risk of data loss if cache fails |
| **Memory usage** | Efficient (only cached on demand) | Higher (all written data cached) | Higher (all written data cached) |


### Java Examples

#### Cache-Aside (Spring + Caffeine example)

```java
// Gradle deps: spring-boot-starter-cache + com.github.ben-manes.caffeine:caffeine

@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cm = new CaffeineCacheManager("users");
        cm.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .maximumSize(10000));
        return cm;
    }
}

@Service
public class UserService {
    @Autowired 
    private UserRepository repo;

    @Cacheable(value = "users", key = "#id")
    public User getUser(String id) { 
        return repo.findById(id).orElse(null); 
    }

    @CacheEvict(value = "users", key = "#user.id")
    public User updateUser(User user) { 
        return repo.save(user); 
    }
}
```

#### Write-Through (conceptual)
Write-through synchronously updates both cache and DB. If either fails, operation handling is required (retries, compensation).

```java
public void save(Entity e) {
    db.save(e);          // persist DB first (or cache first depending strategy)
    cache.put(e.getId(), e);
}
```

#### Write-Behind (background flusher)
Write to cache (queue), background thread batches writes to DB.

```java
BlockingQueue<Entity> queue = new LinkedBlockingQueue<>();

public void update(Entity e) { 
    cache.put(e.getId(), e); 
    queue.offer(e); 
}

// background flusher thread:
while(true) {
    List<Entity> batch = drain(queue, 100, 5000);
    db.batchWrite(batch);
}
```

### Cache Stampede — Detection & Fixes

**Stampede:** Many clients see a cache miss around same time → DB overwhelms.

#### Strategies

**1. Single-flight / request coalescing**

Use a `ConcurrentHashMap<String, CompletableFuture<V>>` so only one thread fetches DB; others wait on the future.

```java
private final ConcurrentHashMap<String, CompletableFuture<String>> inflight = new ConcurrentHashMap<>();

public String getCached(String key) {
    String val = cache.get(key);
    if (val != null) return val;
    
    CompletableFuture<String> f = inflight.computeIfAbsent(key, k ->
        CompletableFuture.supplyAsync(() -> {
            try { 
                String v = db.get(k); 
                cache.put(k, v); 
                return v; 
            }
            finally { 
                inflight.remove(k); 
            }
        }));
    return f.join();
}
```

**2. Distributed lock (Redis SETNX)**

```java
String lockKey = "lock:" + key;
String ok = jedis.set(lockKey, myId, "NX", "PX", 5000);
if ("OK".equals(ok)) {
    // we hold lock => fetch from DB & set cache, then release
    jedis.del(lockKey);
} else {
    // wait & poll cache
    Thread.sleep(50);
    return cache.get(key);
}
```

**3. Early refresh / refresh-ahead**

When TTL is near expiration, asynchronously refresh value so it never becomes cold.

**4. Staggered TTLs**

Add small random TTL windows so not all keys expire simultaneously.

### Stale Reads (consistency) — Patterns & Pitfalls

**Possible race:** T1 reads, misses cache, writes DB; T2 reads cache before cache updated → stale read.

**To avoid:**
- **Invalidate-after-write:** Update DB then delete cache key (or update cache). Order matters: DB update → delete cache → eventually repopulate on next read. Or use write-through to keep cache consistent.
- **Versioning:** store a version number or last-modified timestamp in DB & cache; on read compare.
- **Event-driven invalidation:** after DB write, publish event to invalidate caches across nodes.

### Hot Keys / Uneven Load

**Problem:** One key accounts for majority of traffic (e.g., homepage, celebrity feed)

**Mitigations:**
- **Key sharding / "fan-out":** split into key:0..N, round-robin or hash by request id. Aggregate results if needed.
- **Local in-process cache:** keep extremely hot value locally for each server (combined with TTLs).
- **Replicate hot value** into more cache nodes or use CDN.
- **Rate-limit cache-miss rebuilding:** let a small pool rebuild and others read stale value until rebuild done (trade freshness for stability).

**Example: shard hot key by adding suffix:**

```java
int replicas = 5;
String shardKey = key + ":" + ThreadLocalRandom.current().nextInt(replicas);
```

### Monitoring & Metrics

**Collect:**
- Cache hits / misses ratio
- Eviction counts
- TTL expiration rates
- Load on DB during cache misses
- Latency (p50/p95/p99) for cache reads & DB reads

These metrics help tune TTLs, eviction sizes, and identify stampedes/hot keys.

### Interview Q&A (Caching)

**Q: How to avoid cache stampede?**

**A (model):** Use request coalescing (single-flight), Redis locks (SETNX), or refresh-ahead for hot keys; combine with idempotent rebuild logic.

**Q: When to use write-through vs write-behind?**

**A (model):** Use write-through when cache must reflect DB immediately (strong freshness). Use write-behind to absorb high write throughput and batch writes when eventual persistence is acceptable.

**Q: How to handle stale reads across many app instances?**

**A (model):** Use event-driven invalidation or write-through, or short TTLs and versioned keys. If cross-service writes exist, ensure all services emit invalidation events.

---

## Putting it Together — "Which to Use When" Quick Guide

- **Load balancing:** Always at front of fleets. Use L7 for web apps needing path/host routing; use L4 for performance-sensitive TCP services. Use least-connections for long-lived connections.

- **Consistent hashing:** Use in distributed cache layers or sharded state stores where nodes may come/go; always use vNodes for smoothing.

- **Caching:** For read-heavy APIs or expensive computations. Start with cache-aside; add single-flight and distributed locks to prevent stampede. Use write-through for strong freshness requirements.

---

## Final Checklist for Interviews / Architecture Answers

1. **State assumptions** (traffic qps, read/write ratio, latency SLOs)
2. **Explain failure modes and trade-offs** (consistency vs availability)
3. **Show instrumentation and operational plan** (health checks, alerts)
4. **Mention performance tuning knobs** (TTL, vNode count, LB weights)
5. **Always include testing/chaos plan** (simulate node failures, expiry storms)

---

*This guide provides comprehensive coverage of Load Balancers, Consistent Hashing, and Caching with practical Java implementations and interview-ready explanations.*