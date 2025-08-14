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
# 📄 Database Sharding

___

## 1️⃣ What is Database Sharding?

**Sharding** is a horizontal partitioning technique where a large dataset is split into smaller, more manageable pieces called **shards**, each stored on separate database instances.

Instead of storing all rows in a single table on one server, you distribute the data across multiple servers to improve scalability and performance.

Each shard is independent and contains a subset of the data, but all shards together represent the complete dataset.

### Analogy
Think of a large library (database) with millions of books (rows). Instead of keeping all books in one giant hall (single DB), we split them into multiple rooms based on genre (shards). Each room has only part of the data, but the complete collection is across all rooms.

---

## 2️⃣ Why Use Sharding?

- **Scalability:** Handles growth in data and traffic
- **Performance:** Queries are faster because each shard has fewer rows
- **Availability:** Failure in one shard doesn't take down the entire DB
- **Cost Optimization:** Can use smaller, cheaper hardware for each shard instead of one massive, expensive server

---

## 3️⃣ When to Use Sharding?

- Database is too large to fit on a single machine
- High write throughput and queries start becoming slow due to large table sizes
- Application needs global distribution (users from different geographies accessing different data subsets)
- Your use case involves multi-tenancy (separate customers' data in different shards)

---

## 4️⃣ Types of Sharding

### a) Key-Based (Hash) Sharding

Distributes rows based on hash value of a shard key.

**Example:** `shard_id = hash(user_id) % total_shards`

**Pros:**
- Uniform data distribution
- Avoids hotspots

**Cons:**
- Harder to add/remove shards (rehashing needed)

```java
public class HashSharding {
    private static final int TOTAL_SHARDS = 4;

    public int getShardId(int userId) {
        return Math.abs(Integer.hashCode(userId)) % TOTAL_SHARDS;
    }
}
```

### b) Range-Based Sharding

Rows are assigned based on a value range.

**Example:**
- Shard 1: user_id 1-10000
- Shard 2: user_id 10001-20000

**Pros:**
- Easy to implement
- Range queries efficient

**Cons:**
- Can cause hotspots if one range is much more active

```java
public class RangeSharding {
    public String getShard(int userId) {
        if (userId <= 10000) return "Shard1";
        else if (userId <= 20000) return "Shard2";
        else return "Shard3";
    }
}
```

### c) Directory-Based Sharding

A lookup table (directory) maps each shard key to its shard.

Flexible but requires extra lookup step.

```java
import java.util.HashMap;
import java.util.Map;

public class DirectorySharding {
    private Map<Integer, String> shardMap = new HashMap<>();

    public DirectorySharding() {
        shardMap.put(1, "Shard1");
        shardMap.put(2, "Shard2");
        shardMap.put(3, "Shard3");
    }

    public String getShard(int customerId) {
        return shardMap.get(customerId % shardMap.size() + 1);
    }
}
```

### d) Geo-Based Sharding

Shards are based on geographical location.

Useful for latency reduction and compliance.

---

## 5️⃣ Challenges in Sharding

- **Rebalancing:** Adding/removing shards requires moving data
- **Joins Across Shards:** Expensive and complex
- **Global Transactions:** Maintaining ACID across shards is tricky
- **Hotspots:** Poor shard key choice can overload a shard

---

## 6️⃣ Best Practices

- **Choose shard key carefully:** Should evenly distribute data
- **Use Consistent Hashing** to reduce re-sharding cost
- **Implement middleware or routing layer** for shard selection
- **Monitor shard load and size** continuously

---

## 7️⃣ Example: Middleware for Shard Routing

```java
public class ShardRouter {
    private static final int TOTAL_SHARDS = 4;

    public String routeQuery(int userId) {
        int shardId = Math.abs(Integer.hashCode(userId)) % TOTAL_SHARDS;
        return "jdbc:mysql://db-server-" + shardId + "/mydb";
    }

    public static void main(String[] args) {
        ShardRouter router = new ShardRouter();
        System.out.println(router.routeQuery(12345)); 
        // Outputs: jdbc:mysql://db-server-1/mydb
    }
}
```

---

## 8️⃣ Interview Questions & Answers

### Q1: How would you pick a shard key?

**A:** Choose a key that:
- **Distributes data evenly** (avoid hotspots)
- **Minimizes cross-shard queries**
- **Is stable** (doesn't change frequently)
- **Example:** `user_id` for user-centric data

### Q2: What's the difference between Sharding and Partitioning?

**A:**
- **Partitioning:** Logical separation within the same DB instance
- **Sharding:** Physical separation across multiple DB instances

### Q3: How to handle a situation where one shard becomes too large?

**A:**
- **Resharding:** Split it into smaller shards
- **Consistent Hashing** to minimize data movement
- **Add virtual nodes** to distribute load

# CAP Theorem 


---

## 1. Definition

The **CAP theorem** (also called Brewer's theorem) states that in any distributed data system, you can only guarantee **two out of the following three properties** at the same time:

### **Consistency (C)**
- Every read receives the most recent write or an error
- All nodes in the system return the same data at the same time

### **Availability (A)**
- Every request receives a (non-error) response, without guaranteeing that it contains the most recent write

### **Partition Tolerance (P)**
- The system continues to operate despite an arbitrary number of messages being dropped or delayed between nodes in the network

---

## 2. Why It Matters

- In distributed systems, **network partitions** (communication breaks) will eventually happen (due to node crashes, cable failures, network latency spikes)
- Because **P is unavoidable**, the real trade-off is usually between **C and A** when a partition occurs
- You design based on which property is more important for your business requirements

---

## 3. Key Insight

**Distributed systems must be partition tolerant** because networks can fail.

This means:
- If two parts of the system cannot talk to each other, you must decide:
    - **Choose Consistency:** Stop some operations until the network heals (users may see errors but data is correct when they do get a response)
    - **Choose Availability:** Allow all operations but risk serving stale or conflicting data

---

## 4. Real-World Analogy

Think of a **bank ATM system**:

- **C:** All ATMs must show the exact same balance at the same time
- **A:** Any ATM must allow withdrawals at any time
- **P:** The network between ATMs and the central bank can fail

**If the network fails:**
- **CA choice:** Stop withdrawals until the network is restored (keeps balances correct)
- **AP choice:** Allow withdrawals but reconcile balances later (may lead to overdrafts)

---

## 5. Combinations

| Property Set | Behavior |
|--------------|----------|
| **CP** | Consistent and partition-tolerant, but not always available during a partition. **Example:** MongoDB in "majority write concern" mode, HBase |
| **AP** | Available and partition-tolerant, but may serve stale data. **Example:** Cassandra, DynamoDB (eventually consistent) |
| **CA** | Consistent and available, but not partition-tolerant — practically only possible in single-node or non-distributed systems |

---

## 6. Example Scenarios

### CP Example (Consistency over Availability)
**System:** Financial ledger service

**During a partition:**
- If a node cannot confirm the latest transaction with other nodes, it rejects the transaction
- Users may see downtime, but no double-spending occurs

### AP Example (Availability over Consistency)
**System:** Social media feed

**During a partition:**
- Posts may not immediately appear to all users
- Eventually, when the network heals, data converges

---

## 7. When to Choose What

### Choose **CP** if:
- You cannot tolerate stale data (finance, orders, inventory)
- Data correctness is more important than uptime
- Strong consistency requirements exist

### Choose **AP** if:
- You value uptime more than absolute correctness at any given moment (social feeds, analytics)
- Eventually consistent data is acceptable
- User experience degradation from downtime is costly

---

## 8. Practical Code Examples

### CP System Implementation (Simplified)

```java
public class CPDatabase {
    private List<Node> nodes;
    private int majorityThreshold;

    public void write(String key, String value) throws UnavailableException {
        int confirmations = 0;
        
        for (Node node : nodes) {
            try {
                if (node.isReachable() && node.write(key, value)) {
                    confirmations++;
                }
            } catch (NetworkException e) {
                // Node unreachable due to partition
                continue;
            }
        }
        
        if (confirmations < majorityThreshold) {
            // Not enough nodes confirmed - reject write to maintain consistency
            throw new UnavailableException("Cannot achieve majority consensus");
        }
    }
    
    public String read(String key) throws UnavailableException {
        int confirmations = 0;
        String value = null;
        
        for (Node node : nodes) {
            try {
                if (node.isReachable()) {
                    String nodeValue = node.read(key);
                    if (value == null) value = nodeValue;
                    confirmations++;
                }
            } catch (NetworkException e) {
                continue;
            }
        }
        
        if (confirmations < majorityThreshold) {
            throw new UnavailableException("Cannot achieve majority consensus");
        }
        
        return value;
    }
}
```

### AP System Implementation (Simplified)

```java
public class APDatabase {
    private List<Node> nodes;

    public void write(String key, String value) {
        // Write to all available nodes, don't wait for consensus
        for (Node node : nodes) {
            try {
                if (node.isReachable()) {
                    node.writeAsync(key, value);
                }
            } catch (NetworkException e) {
                // Continue to other nodes, maintain availability
                continue;
            }
        }
    }
    
    public String read(String key) {
        // Return from first available node
        for (Node node : nodes) {
            try {
                if (node.isReachable()) {
                    return node.read(key); // May return stale data
                }
            } catch (NetworkException e) {
                continue;
            }
        }
        throw new RuntimeException("No nodes available");
    }
}
```

### Partition Detection Example

```java
public class PartitionDetector {
    private static final long HEARTBEAT_TIMEOUT = 5000; // 5 seconds
    
    public boolean isPartitioned(Node node) {
        try {
            long start = System.currentTimeMillis();
            node.ping();
            long latency = System.currentTimeMillis() - start;
            
            return latency > HEARTBEAT_TIMEOUT;
        } catch (NetworkException e) {
            return true; // Definitely partitioned
        }
    }
    
    public void handlePartition(Node node) {
        if (isPartitioned(node)) {
            // CP system: Remove node from active set
            // AP system: Continue serving from available nodes
            System.out.println("Partition detected with node: " + node.getId());
        }
    }
}
```

---

## 9. Real-World System Examples

### CP Systems
- **MongoDB** (with majority write concern)
- **HBase**
- **Redis Cluster** (when configured for consistency)
- **Zookeeper**
- **etcd**

### AP Systems
- **Cassandra**
- **DynamoDB** (eventually consistent mode)
- **Riak**
- **CouchDB**
- **Amazon S3** (eventually consistent)

### CA Systems (Non-distributed)
- **Traditional RDBMS** (single instance)
- **PostgreSQL** (single master)
- **MySQL** (single instance)

---

## 10. Common Misconceptions

### ❌ Misconception 1: "CAP is a strict either/or choice"
**✅ Reality:** You can tune the system behavior. For example:
- DynamoDB allows you to choose between eventually consistent reads (AP) and strongly consistent reads (CP)
- You can have different consistency levels for different operations

### ❌ Misconception 2: "You must choose one combination forever"
**✅ Reality:** You can make different choices for different operations:
```java
// Strong consistency for critical operations
database.write(key, value, ConsistencyLevel.STRONG);

// Eventual consistency for non-critical reads
database.read(key, ConsistencyLevel.EVENTUAL);
```

### ❌ Misconception 3: "Availability means the system never goes down"
**✅ Reality:** Availability in CAP means responding to requests, but responses might contain stale data.

### ❌ Misconception 4: "Network partitions are rare"
**✅ Reality:** In large distributed systems, some form of partition happens frequently (node failures, network hiccups, GC pauses).

---

## 11. PACELC Theorem Extension

**PACELC** extends CAP by considering what happens when there's **no** partition:

- **If Partition:** Choose between Availability and Consistency (standard CAP)
- **Else (no partition):** Choose between Latency and Consistency

### Examples:
- **MongoDB:** PC/EC (Consistent during partitions, Consistent during normal operation)
- **Cassandra:** PA/EL (Available during partitions, Low latency during normal operation)
- **DynamoDB:** PA/EL (configurable)

```java
public class PAELCExample {
    public String read(String key, boolean prioritizeLatency) {
        if (isPartitioned()) {
            // Standard CAP applies - this is an AP system
            return readFromAnyAvailableNode(key);
        } else {
            // PACELC: Choose between Latency and Consistency
            if (prioritizeLatency) {
                return readFromLocalCache(key); // Fast but potentially stale
            } else {
                return readFromPrimary(key); // Slower but consistent
            }
        }
    }
}
```

---

## 12. Interview-Level Hard Questions

### Q1: Why can't we have all three (C, A, P) in a distributed system?

**Answer:**
Because when a partition occurs, the system must either:
- Stop serving requests (losing **Availability**) to ensure all data is consistent (**CP**), OR
- Serve requests without coordination (losing **Consistency**) to maintain **Availability** (**AP**)

**Partition tolerance is not optional** — networks can and will fail.

### Q2: Can you give an example of how a CP system behaves during a network partition?

**Answer:**
Suppose MongoDB with a replica set of 3 nodes:
- If the primary node gets isolated from the majority:
    - It steps down and stops accepting writes
    - Clients connected to that node get errors (downtime) until failover completes
    - This prevents conflicting writes, ensuring consistency

### Q3: Why is Partition Tolerance mandatory?

**Answer:**
In a distributed system, nodes are connected by an unreliable network. Even in perfectly engineered environments:
- Messages can be dropped
- Links can fail temporarily
- Latency spikes can make nodes "think" a partition exists

Since you can't control the network 100%, you must design to handle partitions.

### Q4: Give a real-world example where AP is preferred over CP.

**Answer:**
**System:** Amazon shopping cart

**Reason:**
- If you add an item to your cart, it's okay if another device shows it after a few seconds (eventual consistency)
- But you should be able to keep shopping during network issues (availability first)

### Q5: How does eventual consistency work in AP systems?

**Answer:**
```java
public class EventualConsistency {
    // Anti-entropy process for conflict resolution
    public void reconcile(Node node1, Node node2) {
        Map<String, VersionedValue> data1 = node1.getAllData();
        Map<String, VersionedValue> data2 = node2.getAllData();
        
        for (String key : getAllKeys(data1, data2)) {
            VersionedValue v1 = data1.get(key);
            VersionedValue v2 = data2.get(key);
            
            if (v1 == null) {
                node1.put(key, v2);
            } else if (v2 == null) {
                node2.put(key, v1);
            } else if (v1.getTimestamp() > v2.getTimestamp()) {
                node2.put(key, v1); // Last-write-wins
            } else if (v2.getTimestamp() > v1.getTimestamp()) {
                node1.put(key, v2);
            }
            // Handle concurrent writes with vector clocks or other strategies
        }
    }
}
```

### Q6: How do you handle the scenario where different parts of an AP system accept conflicting writes?

**Answer:**
Use conflict resolution strategies:
- **Last-write-wins:** Use timestamps
- **Vector clocks:** Track causality between updates
- **Application-level resolution:** Let the application decide how to merge conflicts
- **Multi-value:** Keep all versions and let the client resolve

---

## 13. Key Takeaways

- **P is unavoidable** → You must pick C or A during partitions
- **AP systems** → Higher uptime, eventual consistency
- **CP systems** → Strong correctness, possible downtime
- **Design decision should align with business risk tolerance**
- **You can make different CAP choices for different operations in the same system**
- **Consider PACELC for normal (non-partition) operation trade-offs**
- **Modern systems often provide tunable consistency levels**

### Decision Framework:

```java
public class CAPDecisionFramework {
    public SystemType chooseCAP(Requirements req) {
        if (req.isStrongConsistencyRequired()) {
            if (req.canTolerateDowntime()) {
                return SystemType.CP; // Financial systems
            } else {
                throw new IllegalStateException("Cannot guarantee both strong consistency and zero downtime");
            }
        } else {
            if (req.isHighAvailabilityRequired()) {
                return SystemType.AP; // Social media, content delivery
            } else {
                return SystemType.CP; // Better safe than sorry
            }
        }
    }
}
```

---
# Quorum and Checksum in Distributed Systems - Complete Guide

## Table of Contents

1. [Quorum in Distributed Systems](#quorum-in-distributed-systems)
  - [Definition](#definition)
  - [Why Quorum is Needed](#why-quorum-is-needed)
  - [Key Terms](#key-terms)
  - [Quorum Rules](#quorum-rules)
  - [Example Scenarios](#example-scenarios)
  - [Code Implementation](#code-implementation)
  - [Real-World Usage](#real-world-usage)
  - [Interview Questions & Answers](#interview-questions--answers-quorum)

2. [Checksum in Distributed Systems](#checksum-in-distributed-systems)
  - [Definition](#definition-1)
  - [Why Checksums are Needed](#why-checksums-are-needed)
  - [How It Works](#how-it-works)
  - [Types of Checksums](#types-of-checksums)
  - [Implementation Examples](#implementation-examples)
  - [Real-World Usage](#real-world-usage-1)
  - [Interview Questions & Answers](#interview-questions--answers-checksum)

3. [Integration: Quorum + Checksum](#integration-quorum--checksum)

---

## Quorum in Distributed Systems

### Definition

In distributed databases or replicated systems, **quorum** is the minimum number of nodes that must participate in a read or write operation for it to be considered successful. It's a strategy to ensure **consistency** despite network failures or node crashes.

### Why Quorum is Needed

- In distributed setups, **data is replicated** across multiple nodes for fault tolerance
- Network partitions or node failures can make some replicas **unreachable**
- Without quorum rules, a system could:
  - Read outdated data (stale read)
  - Accept conflicting writes that cause data divergence
- Quorum ensures **a sufficient overlap** between read and write sets so that:
  - Any read sees the latest write
  - Writes propagate reliably despite failures

### Key Terms

- **N** → Total number of replicas
- **W** → Number of replicas that must acknowledge a write
- **R** → Number of replicas that must participate in a read

### Quorum Rules

#### 1. Consistency Rule:
```
R + W > N
```
This ensures there's an overlap between the read set and write set.

#### 2. Availability Rule:
- Smaller `W` → Higher availability for writes
- Smaller `R` → Higher availability for reads

### Example Scenarios

Imagine **N = 5 replicas**. We can configure:

| Configuration | W | R | Characteristics |
|---------------|---|---|-----------------|
| Strong Consistency | 3 | 3 | Balanced consistency and availability |
| Read-Heavy | 2 | 4 | Optimized for read performance |
| Write-Heavy | 4 | 2 | Optimized for write performance |

#### Scenario Walkthrough:

**1. Write Operation (W=3, R=3, N=5):**
- Client writes data
- Coordinator node sends to all 5 replicas
- Write is considered *successful* when **3 replicas (W=3)** confirm
- Even if 2 nodes are down, write can still succeed

**2. Read Operation:**
- Client requests the latest value
- Coordinator queries **3 replicas (R=3)**
- Even if 2 replicas had old data, overlap ensures at least 1 replica has the latest write

### Code Implementation

```java
public class QuorumBasedDatabase {
    private final int N; // Total replicas
    private final int W; // Write quorum
    private final int R; // Read quorum
    private final List<DatabaseNode> replicas;

    public QuorumBasedDatabase(int N, int W, int R, List<DatabaseNode> replicas) {
        if (R + W <= N) {
            throw new IllegalArgumentException("Quorum rule violated: R + W must be > N");
        }
        this.N = N;
        this.W = W;
        this.R = R;
        this.replicas = replicas;
    }

    public boolean write(String key, String value) throws QuorumException {
        List<CompletableFuture<Boolean>> writeFutures = new ArrayList<>();
        
        // Send write request to all replicas
        for (DatabaseNode replica : replicas) {
            CompletableFuture<Boolean> future = CompletableFuture.supplyAsync(() -> {
                try {
                    return replica.write(key, value);
                } catch (Exception e) {
                    return false; // Node failed
                }
            });
            writeFutures.add(future);
        }

        // Wait for W successful acknowledgments
        int successCount = 0;
        for (CompletableFuture<Boolean> future : writeFutures) {
            try {
                if (future.get(1, TimeUnit.SECONDS)) {
                    successCount++;
                    if (successCount >= W) {
                        return true; // Quorum achieved
                    }
                }
            } catch (Exception e) {
                // Timeout or failure - continue with other nodes
            }
        }

        throw new QuorumException("Failed to achieve write quorum: " + successCount + "/" + W);
    }

    public String read(String key) throws QuorumException {
        List<CompletableFuture<VersionedValue>> readFutures = new ArrayList<>();
        
        // Send read request to all replicas
        for (DatabaseNode replica : replicas) {
            CompletableFuture<VersionedValue> future = CompletableFuture.supplyAsync(() -> {
                try {
                    return replica.read(key);
                } catch (Exception e) {
                    return null; // Node failed
                }
            });
            readFutures.add(future);
        }

        // Collect R successful responses
        List<VersionedValue> responses = new ArrayList<>();
        for (CompletableFuture<VersionedValue> future : readFutures) {
            try {
                VersionedValue result = future.get(1, TimeUnit.SECONDS);
                if (result != null) {
                    responses.add(result);
                    if (responses.size() >= R) {
                        break; // Quorum achieved
                    }
                }
            } catch (Exception e) {
                // Continue with other nodes
            }
        }

        if (responses.size() < R) {
            throw new QuorumException("Failed to achieve read quorum: " + responses.size() + "/" + R);
        }

        // Return the most recent version (highest timestamp)
        return responses.stream()
            .max(Comparator.comparing(VersionedValue::getTimestamp))
            .map(VersionedValue::getValue)
            .orElse(null);
    }
}

class VersionedValue {
    private final String value;
    private final long timestamp;
    
    public VersionedValue(String value, long timestamp) {
        this.value = value;
        this.timestamp = timestamp;
    }
    
    // getters
    public String getValue() { return value; }
    public long getTimestamp() { return timestamp; }
}
```

### Real-World Usage

- **Cassandra**: Tunable consistency with R and W parameters
  ```sql
  SELECT * FROM users WHERE id = 123 USING CONSISTENCY QUORUM;
  INSERT INTO users (id, name) VALUES (123, 'John') USING CONSISTENCY QUORUM;
  ```
- **DynamoDB**: Supports strongly consistent reads using quorum
- **ZooKeeper**: Majority quorum for leader election and writes
- **MongoDB**: Replica sets use majority write concern for consistency

### Interview Questions & Answers (Quorum)

#### Q1: How would you choose R and W for a read-heavy workload in a distributed system?

**Answer:**
For a read-heavy workload, I would optimize for read performance:
- Choose smaller **R** (e.g., R=1 or R=2) for faster reads
- Choose larger **W** (ensuring R + W > N) for consistency
- Example: N=5, R=1, W=5
  - Reads are very fast (only need 1 replica)
  - Writes ensure all replicas are updated
  - Still maintains consistency: R + W = 6 > 5

#### Q2: If N=5, W=2, R=2, can you guarantee strong consistency? Why or why not?

**Answer:**
**No, you cannot guarantee strong consistency.**

Reason: R + W = 2 + 2 = 4, which is NOT > N (5).

This violates the quorum rule. Here's why it fails:
- A write might succeed by updating only replicas A and B (W=2)
- A subsequent read might only query replicas C and D (R=2)
- Since there's no overlap, the read could miss the latest write

**Correct configuration:** R=3, W=3 (R + W = 6 > 5) ensures overlap.

#### Q3: How does quorum help in resolving conflicts in eventual consistency systems?

**Answer:**
Quorum helps in several ways:

1. **Conflict Detection:** When R replicas are read, conflicting versions can be detected
2. **Last-Write-Wins:** Among conflicting writes, choose the one with the latest timestamp
3. **Read Repair:** During reads, if inconsistencies are detected, the system can repair stale replicas

```java
public String readWithRepair(String key) {
    List<VersionedValue> responses = readFromRReplicas(key);
    
    // Find the latest version
    VersionedValue latest = responses.stream()
        .max(Comparator.comparing(VersionedValue::getTimestamp))
        .orElse(null);
    
    // Repair stale replicas asynchronously
    for (VersionedValue response : responses) {
        if (response.getTimestamp() < latest.getTimestamp()) {
            repairReplicaAsync(response.getReplicaId(), key, latest);
        }
    }
    
    return latest.getValue();
}
```

---

## Checksum in Distributed Systems

### Definition

A **checksum** is a small fixed-size value (hash) calculated from a block of data to detect **data corruption** during transmission or storage.

### Why Checksums are Needed

- In large distributed systems, **data travels across networks** and is stored in multiple places
- Network errors, disk failures, or memory corruption can alter data
- Bit rot in storage devices can corrupt data over time
- Without checksums, the system could serve corrupted data **without knowing**
- Essential for maintaining data integrity at scale

### How It Works

1. **Sender** computes a **checksum** for the data (e.g., using CRC32, MD5, SHA-256)
2. **Sender** transmits the data **and** the checksum
3. **Receiver** recomputes checksum on received data
4. **If values differ** → data is corrupted, request retransmission

### Types of Checksums

| Type | Speed | Security | Use Case |
|------|-------|----------|----------|
| **CRC32** | Fast | Low | Network packets, basic error detection |
| **MD5** | Medium | Medium | File integrity (deprecated for security) |
| **SHA-256** | Slower | High | Cryptographic applications, data integrity |
| **xxHash** | Very Fast | Low | High-performance applications |

### Implementation Examples

#### Basic Checksum Implementation

```java
import java.security.MessageDigest;
import java.util.zip.CRC32;

public class ChecksumUtil {
    
    // Fast checksum for performance-critical applications
    public static long calculateCRC32(byte[] data) {
        CRC32 crc32 = new CRC32();
        crc32.update(data);
        return crc32.getValue();
    }
    
    // Secure checksum for data integrity
    public static String calculateSHA256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            return bytesToHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to calculate SHA-256", e);
        }
    }
    
    private static String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}
```

#### Distributed File System with Checksums

```java
public class DistributedFile {
    private final String fileName;
    private final byte[] content;
    private final String checksum;
    private final long timestamp;

    public DistributedFile(String fileName, byte[] content) {
        this.fileName = fileName;
        this.content = content.clone();
        this.checksum = ChecksumUtil.calculateSHA256(content);
        this.timestamp = System.currentTimeMillis();
    }

    public boolean verifyIntegrity() {
        String currentChecksum = ChecksumUtil.calculateSHA256(content);
        return checksum.equals(currentChecksum);
    }

    public byte[] getContent() throws CorruptedDataException {
        if (!verifyIntegrity()) {
            throw new CorruptedDataException("File " + fileName + " is corrupted!");
        }
        return content.clone();
    }
}

public class DistributedFileSystem {
    private final Map<String, List<DistributedFile>> fileReplicas = new HashMap<>();

    public void storeFile(String fileName, byte[] content, int replicas) {
        List<DistributedFile> replicaList = new ArrayList<>();
        
        for (int i = 0; i < replicas; i++) {
            DistributedFile file = new DistributedFile(fileName, content);
            replicaList.add(file);
            // Store on different nodes in real implementation
        }
        
        fileReplicas.put(fileName, replicaList);
    }

    public byte[] readFile(String fileName) throws FileNotFoundException, CorruptedDataException {
        List<DistributedFile> replicas = fileReplicas.get(fileName);
        if (replicas == null || replicas.isEmpty()) {
            throw new FileNotFoundException("File not found: " + fileName);
        }

        // Try each replica until we find a non-corrupted one
        for (DistributedFile replica : replicas) {
            try {
                return replica.getContent(); // This verifies checksum
            } catch (CorruptedDataException e) {
                System.err.println("Corrupted replica detected for " + fileName + ", trying next...");
                // Log corruption for repair process
                scheduleReplicaRepair(fileName, replica);
            }
        }

        throw new CorruptedDataException("All replicas of " + fileName + " are corrupted!");
    }

    private void scheduleReplicaRepair(String fileName, DistributedFile corruptedReplica) {
        // In real implementation, this would:
        // 1. Mark the corrupted replica for replacement
        // 2. Create a new replica from a good copy
        // 3. Update the replica list
        System.out.println("Scheduling repair for corrupted replica of " + fileName);
    }
}
```

#### Example Usage

```java
public class ChecksumExample {
    public static void main(String[] args) {
        // Original data
        String data = "HelloWorld";
        byte[] originalBytes = data.getBytes();
        
        // Calculate checksum
        String originalChecksum = ChecksumUtil.calculateSHA256(originalBytes);
        System.out.println("Original data: " + data);
        System.out.println("Checksum: " + originalChecksum);
        
        // Simulate data corruption
        byte[] corruptedBytes = "Hell0World".getBytes(); // 'o' changed to '0'
        String corruptedChecksum = ChecksumUtil.calculateSHA256(corruptedBytes);
        
        // Verify integrity
        if (!originalChecksum.equals(corruptedChecksum)) {
            System.out.println("❌ Data corruption detected!");
            System.out.println("Expected: " + originalChecksum);
            System.out.println("Actual: " + corruptedChecksum);
        } else {
            System.out.println("✅ Data integrity verified");
        }
    }
}
```

### Real-World Usage

- **HDFS (Hadoop)**: Stores block checksums to validate data integrity during reads
- **TCP/IP**: Includes checksum fields to detect packet errors during transmission
- **Databases**: Use checksums to detect page-level corruption
- **Git**: Uses SHA-1 checksums for all objects (commits, trees, blobs)
- **Bitcoin**: Uses double SHA-256 for block hashing
- **Amazon S3**: Provides MD5 checksums for uploaded objects

### Interview Questions & Answers (Checksum)

#### Q1: Why is a cryptographic hash (like SHA) sometimes preferred over a simple checksum like CRC?

**Answer:**

**Security vs Performance trade-off:**

**CRC32 Advantages:**
- Very fast computation
- Good for detecting random errors
- Lightweight

**CRC32 Limitations:**
- Not cryptographically secure
- Vulnerable to intentional tampering
- Can have collisions with malicious data

**SHA-256 Advantages:**
- Cryptographically secure
- Extremely difficult to forge
- Collision resistant

**When to use each:**
```java
// Use CRC32 for performance-critical error detection
public boolean isNetworkPacketValid(byte[] packet, long expectedCrc) {
    return ChecksumUtil.calculateCRC32(packet) == expectedCrc;
}

// Use SHA-256 for security-critical data integrity
public boolean isFileAuthentic(byte[] file, String expectedSha) {
    return ChecksumUtil.calculateSHA256(file).equals(expectedSha);
}
```

#### Q2: Can checksums detect all data corruption? What about intentional tampering?

**Answer:**

**Checksums can detect most but not all corruption:**

**What checksums CAN detect:**
- Random bit flips
- Network transmission errors
- Storage device failures
- Most accidental corruption

**What checksums CANNOT detect:**
- Collisions (two different inputs producing same checksum)
- Sophisticated attacks designed to preserve checksum
- Corruption of both data AND checksum

**For intentional tampering:**
- **Simple checksums (CRC)**: Easily bypassed by attackers
- **Cryptographic hashes (SHA)**: Much harder to forge, but not impossible
- **Digital signatures**: Best protection against tampering

**Enhanced protection strategy:**
```java
public class SecureDataStorage {
    // Store checksum separately from data
    public void storeSecurely(byte[] data, String dataLocation, String checksumLocation) {
        String checksum = ChecksumUtil.calculateSHA256(data);
        
        // Store data and checksum in different locations
        storeData(dataLocation, data);
        storeChecksum(checksumLocation, checksum);
        
        // Additional: Use digital signatures for critical data
        String signature = digitallySign(checksum);
        storeSignature(checksumLocation + ".sig", signature);
    }
}
```

#### Q3: How would you implement a checksum system for files stored in a distributed file system?

**Answer:**

**Multi-layered checksum strategy:**

```java
public class DistributedFileSystemWithChecksums {
    
    // 1. Block-level checksums (like HDFS)
    public class FileBlock {
        private static final int BLOCK_SIZE = 64 * 1024 * 1024; // 64MB
        private final byte[] data;
        private final String blockChecksum;
        private final long blockId;
        
        public FileBlock(byte[] data, long blockId) {
            this.data = data;
            this.blockId = blockId;
            this.blockChecksum = ChecksumUtil.calculateSHA256(data);
        }
        
        public boolean verify() {
            return blockChecksum.equals(ChecksumUtil.calculateSHA256(data));
        }
    }
    
    // 2. File-level checksums
    public class DistributedFile {
        private final List<FileBlock> blocks;
        private final String fileChecksum; // Checksum of all block checksums
        private final String fileName;
        
        public DistributedFile(String fileName, byte[] fileData) {
            this.fileName = fileName;
            this.blocks = splitIntoBlocks(fileData);
            this.fileChecksum = calculateFileChecksum();
        }
        
        private String calculateFileChecksum() {
            StringBuilder allBlockChecksums = new StringBuilder();
            for (FileBlock block : blocks) {
                allBlockChecksums.append(block.blockChecksum);
            }
            return ChecksumUtil.calculateSHA256(allBlockChecksums.toString().getBytes());
        }
        
        public boolean verifyIntegrity() {
            // Verify each block
            for (FileBlock block : blocks) {
                if (!block.verify()) {
                    return false;
                }
            }
            
            // Verify file-level checksum
            return fileChecksum.equals(calculateFileChecksum());
        }
    }
    
    // 3. Periodic integrity checks
    @Scheduled(fixedRate = 3600000) // Every hour
    public void performIntegrityCheck() {
        for (String fileName : getAllStoredFiles()) {
            DistributedFile file = loadFile(fileName);
            if (!file.verifyIntegrity()) {
                handleCorruption(fileName, file);
            }
        }
    }
    
    // 4. Corruption handling and repair
    private void handleCorruption(String fileName, DistributedFile corruptedFile) {
        // Find good replicas
        List<DistributedFile> allReplicas = getAllReplicas(fileName);
        DistributedFile goodReplica = allReplicas.stream()
            .filter(DistributedFile::verifyIntegrity)
            .findFirst()
            .orElse(null);
            
        if (goodReplica != null) {
            // Repair corrupted replica
            repairFile(fileName, goodReplica);
            logCorruptionEvent(fileName, "Repaired from good replica");
        } else {
            // All replicas corrupted - escalate
            alertOperators(fileName, "All replicas corrupted!");
        }
    }
}
```

**Key implementation considerations:**
1. **Hierarchical checksums**: Block-level + file-level for efficient verification
2. **Separate storage**: Store checksums separately from data when possible
3. **Regular verification**: Periodic background jobs to detect silent corruption
4. **Repair mechanisms**: Automatic recovery from good replicas
5. **Performance optimization**: Use fast checksums (CRC32) for frequent checks, secure checksums (SHA-256) for critical verification

---

## Integration: Quorum + Checksum

In practice, these concepts work together:

```java
public class SecureQuorumDatabase {
    public boolean writeWithIntegrity(String key, byte[] value) {
        // Calculate checksum
        String checksum = ChecksumUtil.calculateSHA256(value);
        VersionedValue versionedValue = new VersionedValue(value, checksum, System.currentTimeMillis());
        
        // Use quorum for consistent writes
        return quorumWrite(key, versionedValue);
    }
    
    public byte[] readWithIntegrity(String key) throws CorruptedDataException {
        // Use quorum for consistent reads
        List<VersionedValue> responses = quorumRead(key);
        
        // Verify integrity of all responses
        List<VersionedValue> validResponses = responses.stream()
            .filter(this::verifyChecksum)
            .collect(Collectors.toList());
            
        if (validResponses.isEmpty()) {
            throw new CorruptedDataException("All replicas are corrupted for key: " + key);
        }
        
        // Return latest valid version
        return validResponses.stream()
            .max(Comparator.comparing(VersionedValue::getTimestamp))
            .map(VersionedValue::getValue)
            .orElseThrow();
    }
    
    private boolean verifyChecksum(VersionedValue value) {
        String expectedChecksum = ChecksumUtil.calculateSHA256(value.getValue());
        return expectedChecksum.equals(value.getChecksum());
    }
}
```

This combination provides both **consistency** (through quorum) and **integrity** (through checksums) in distributed systems.

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
