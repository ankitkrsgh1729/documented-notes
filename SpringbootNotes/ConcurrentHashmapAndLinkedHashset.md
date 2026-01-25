# HashMap vs ConcurrentHashMap vs Synchronized Collections

## The Problem: Thread Safety in HashMap

### HashMap is NOT Thread-Safe
```java
HashMap<String, Integer> map = new HashMap<>();

// Thread 1                    // Thread 2
map.put("key", 1);             map.put("key", 2);
// Race condition! Can cause:
// - Lost updates
// - Infinite loops (pre-Java 8)
// - Corrupted internal structure
```

### Real Consequences:
- **Lost updates**: Thread 2's write overwrites Thread 1's
- **Infinite loops**: During resize, corrupted links create cycles
- **Data corruption**: Internal structure breaks, causing exceptions

---

## Solution 1: Collections.synchronizedMap(HashMap)
```java
Map<String, Integer> syncMap = Collections.synchronizedMap(new HashMap<>());
```

### How It Works:
- Wraps HashMap with synchronized methods
- **Locks entire map** for every operation
```java
public V get(Object key) {
    synchronized(mutex) {  // Locks entire map
        return map.get(key);
    }
}
```

### Problems:
1. **Poor concurrency**: Only ONE thread can access at a time
2. **Bottleneck**: All threads wait, even for different keys
3. **Manual iteration locking required**:
```java
synchronized(syncMap) {  // Must lock manually!
    for (Entry e : syncMap.entrySet()) { ... }
}
```

---

## Solution 2: ConcurrentHashMap (Best Choice)

### How It Works: Segment/Bucket-Level Locking

**Java 7**: Divides map into 16 segments, locks per segment  
**Java 8+**: Locks individual buckets (even finer granularity)
```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

// Thread 1: put("key1", 1)  → Locks bucket[1]
// Thread 2: put("key2", 2)  → Locks bucket[2]  ← Can run simultaneously!
// Thread 3: get("key3")     → No lock needed   ← Read while writes happen!
```

### Key Advantages:

#### 1. Fine-Grained Locking
```java
// Collections.synchronizedMap
Thread 1: put("a", 1)  ← Locks ENTIRE map
Thread 2: get("z")     ← BLOCKED (different key!)

// ConcurrentHashMap
Thread 1: put("a", 1)  ← Locks bucket[0]
Thread 2: get("z")     ← Locks bucket[25] ← Both run concurrently!
```

#### 2. Lock-Free Reads (Java 8+)
```java
// get() operations don't acquire locks
// Uses volatile reads for safe concurrent access
map.get("key");  // No blocking!
```

#### 3. Safe Iteration (No Manual Locking)
```java
// Collections.synchronizedMap
synchronized(syncMap) {  // REQUIRED or ConcurrentModificationException
    for (Entry e : syncMap.entrySet()) { ... }
}

// ConcurrentHashMap
for (Entry e : concurrentMap.entrySet()) { ... }  // Safe without locking!
// Weakly consistent: sees some updates during iteration
```

#### 4. Atomic Operations
```java
// Collections.synchronizedMap
synchronized(syncMap) {  // Multi-step, must lock manually
    if (!syncMap.containsKey("key")) {
        syncMap.put("key", 1);
    }
}

// ConcurrentHashMap
concurrentMap.putIfAbsent("key", 1);  // Single atomic operation!
```

---

## Performance Comparison

### Scenario: 10 threads, 1000 operations each

| Map Type | Throughput | Why |
|----------|------------|-----|
| **HashMap** | ❌ Crashes | Not thread-safe |
| **Collections.synchronizedMap** | 1000 ops/sec | One thread at a time |
| **ConcurrentHashMap** | 8000 ops/sec | Multiple threads concurrently |

### Visual: Lock Contention
```
Collections.synchronizedMap:
Thread 1 ████████ (locks entire map)
Thread 2         ████████ (waits)
Thread 3                 ████████ (waits)

ConcurrentHashMap:
Thread 1 ████ (locks bucket[1])
Thread 2 ████ (locks bucket[2]) ← Runs simultaneously!
Thread 3 ████ (locks bucket[3]) ← Runs simultaneously!
```

---

## Detailed Comparison Table

| Feature | HashMap | Collections.synchronizedMap | ConcurrentHashMap |
|---------|---------|---------------------------|-------------------|
| **Thread Safety** | ❌ No | ✅ Yes | ✅ Yes |
| **Locking Strategy** | None | Entire map | Per bucket/segment |
| **Read Blocking** | N/A | ✅ Blocks | ❌ Lock-free (Java 8+) |
| **Write Blocking** | N/A | ✅ Blocks all | ✅ Only same bucket |
| **Concurrent Reads** | N/A | ❌ One at a time | ✅ Multiple |
| **Concurrent Writes** | N/A | ❌ One at a time | ✅ Multiple (different buckets) |
| **Null Keys** | ✅ One null | ✅ One null | ❌ Not allowed |
| **Null Values** | ✅ Allowed | ✅ Allowed | ❌ Not allowed |
| **Iteration Locking** | N/A | ⚠️ Manual required | ✅ Automatic |
| **Fail-Fast Iterator** | ✅ Yes | ✅ Yes | ❌ Weakly consistent |
| **Performance (Multi-thread)** | N/A | ⭐ Poor | ⭐⭐⭐⭐⭐ Excellent |
| **Atomic Operations** | ❌ No | ❌ No | ✅ Yes (putIfAbsent, etc.) |

---

## Why ConcurrentHashMap Doesn't Support Null

### The Ambiguity Problem

When `get()` returns `null`, it could mean:
1. Key doesn't exist
2. Key exists but is mapped to `null`

### Why This Matters in Concurrent Code
```java
// With null values allowed (BAD):
CustomerProfile profile = cache.get("customer123");
if (profile == null) {
    // AMBIGUOUS: "not in cache" or "cached as null"?
    profile = database.query("customer123");  // Unnecessary query?
    cache.put("customer123", profile);  // Could be null
}

// Multiple threads make redundant DB queries!
```

### The Solution: Null Not Allowed
```java
// Clear semantics:
CustomerProfile profile = cache.get("customer123");
if (profile == null) {
    // UNAMBIGUOUS: "not in cache yet"
    profile = database.query("customer123");
    if (profile != null) {
        cache.put("customer123", profile);
    }
    // If customer doesn't exist, leave out of cache
}
```

### Alternative: Use Optional or Marker Objects
```java
// Option 1: Optional
cache.put("key", Optional.ofNullable(value));

// Option 2: Marker object
private static final Object NOT_FOUND = new Object();
cache.put("key", value != null ? value : NOT_FOUND);
```

---

## When to Use Each

### Use HashMap:
- ✅ Single-threaded applications
- ✅ Performance critical, no concurrency
- ✅ Need null keys/values

### Use Collections.synchronizedMap:
- ⚠️ Rarely recommended (ConcurrentHashMap is better)
- Use only if you need null values AND thread safety
- Low concurrency requirements

### Use ConcurrentHashMap:
- ✅ Multi-threaded applications (most common)
- ✅ High concurrency requirements
- ✅ Need lock-free reads
- ✅ Need atomic operations (putIfAbsent, computeIfAbsent)
- ✅ Production systems with concurrent access

---

## Real-World Example: Request Cache
```java
// BAD: HashMap (not thread-safe)
Map<String, Response> cache = new HashMap<>();

// OKAY: synchronized (low concurrency)
Map<String, Response> cache = Collections.synchronizedMap(new HashMap<>());

// BEST: ConcurrentHashMap (high concurrency)
ConcurrentHashMap<String, Response> cache = new ConcurrentHashMap<>();

// Usage:
cache.computeIfAbsent(requestId, id -> {
    return expensiveApiCall(id);  // Only one thread computes
});
```

---

## Key Takeaways

1. **HashMap**: Fast but unsafe for concurrent access
2. **Collections.synchronizedMap**: Safe but slow (locks entire map)
3. **ConcurrentHashMap**: Safe AND fast (locks only buckets)
4. **No nulls in ConcurrentHashMap**: Prevents ambiguity in concurrent scenarios
5. **Modern choice**: Almost always use ConcurrentHashMap for multi-threaded apps


# HashSet vs LinkedHashSet

## Key Difference
- **HashSet**: No order guarantee - iteration order depends on hash codes and bucket positions
- **LinkedHashSet**: Preserves insertion order

## Internal Implementation

### HashSet Entry
```java
class Entry {
    Object key;
    int hash;
    Entry next;  // for collision handling only
}
```

### LinkedHashSet Entry
```java
class LinkedEntry extends Entry {
    Object key;
    int hash;
    Entry next;           // for collision handling
    LinkedEntry before;   // previous in insertion order
    LinkedEntry after;    // next in insertion order
}
```

## Two Separate Chains

### 1. Collision Chain (`next` pointer)
- Handles elements in **same bucket**
- Used for hash collision resolution

### 2. Insertion Order Chain (`before/after` pointers)
- Links **all elements across buckets**
- Preserves insertion order

### Visual Example
Adding: 5, 1, 9 (assume 1 and 9 collide in bucket[1])
```
Hash Table:
bucket[1] → Entry(1) --next--> Entry(9)  ← collision chain
bucket[2] → Entry(5)

Insertion Order (LinkedHashSet only):
Entry(5) ←--before/after--> Entry(1) ←--before/after--> Entry(9)
```

## Why LinkedHashSet Needs BOTH Structures

| Structure | Purpose | Example |
|-----------|---------|---------|
| **Hash Table** | Fast lookup O(1) | `contains(9)` → hash to bucket directly |
| **Linked List** | Ordered iteration | `for(element : set)` → follow before/after |

**Without hash table:** Lookup becomes O(n) - must traverse entire linked list  
**Without linked list:** Iteration is random - visits buckets 0, 1, 2... not insertion order

## How Hash Collisions Work

### Mapping Elements to Buckets
```java
bucketIndex = hash(element) % numberOfBuckets

// For integers, hash(n) = n
hash(5) = 5  → 5 % 4 = 1 → bucket[1]
hash(1) = 1  → 1 % 4 = 1 → bucket[1]  ← COLLISION!
hash(9) = 9  → 9 % 4 = 1 → bucket[1]  ← COLLISION!
hash(3) = 3  → 3 % 4 = 3 → bucket[3]
```

### Why Use Hashing + Modulo?
- **Without hashing**: Array size = largest possible value (huge memory waste)
- **With hashing**: Fixed small array (e.g., 16 buckets) for any number of elements

### Hash Function Examples
```java
// Integers: hashCode = value itself
hash(5) = 5

// Strings: complex calculation
"abc".hashCode() = 'a'*31² + 'b'*31 + 'c' = 96354
```

## Why HashSet Loses Insertion Order

HashSet iterates **bucket by bucket**, not by insertion order:
```java
// Added in order: 5, 1, 9, 3
set.add(5);  // → bucket[1]
set.add(1);  // → bucket[1]
set.add(9);  // → bucket[1]
set.add(3);  // → bucket[3]

// Iteration: bucket[0] → bucket[1] → bucket[2] → bucket[3]
// Output: [1, 9, 5, 3]  ← NOT insertion order!
```

### What Destroys Order:
1. **Different hash codes** → elements land in different buckets
2. **Bucket iteration** → visits bucket[0], bucket[1], bucket[2]...
3. **Resizing** → elements rehashed, buckets change completely

## Real Time Complexity

### The "O(1)" Myth
```java
contains(9):
Step 1: Find bucket → O(1)
        hash(9) % 4 = 1 → bucket[1]
        
Step 2: Search within bucket → O(k) where k = elements in bucket
        bucket[1] → Entry(5) → Entry(1) → Entry(9) ✓
                    compare    compare    found!
```

**Actual Time = O(1) + O(k)**

### Time Complexity Table

| Scenario | Complexity | Reason |
|----------|------------|--------|
| **Best case** | O(1) | Element is first in bucket |
| **Average case** | O(1) amortized | Good hash distribution, short chains |
| **Worst case** | O(n) | All elements in one bucket |
| **Java 8+ (8+ in bucket)** | O(log n) | Tree replaces linked list |

**Why "O(1) on average":** With good hash function + proper load factor, each bucket has ~1-2 elements

## Bucket Capacity & Optimization

### No Hard Limit
- Buckets are linked lists (can grow indefinitely)
- Performance degrades with many collisions

### Auto-Resizing (Load Factor = 0.75)
```
When size/capacity > 0.75:
16 buckets → 32 buckets → 64 buckets → ...
All elements rehashed, chains become shorter
```

### Java 8 Treeification
- **Bucket with 8+ elements**: Converts to Red-Black Tree
- **Search time**: O(n) → O(log n)

## Performance Comparison

| Operation | HashSet | LinkedHashSet |
|-----------|---------|---------------|
| add/remove/contains | O(1) avg, O(n) worst | O(1) avg, O(n) worst |
| Memory | Lower | ~20% higher (extra pointers) |
| Iteration order | Unpredictable (bucket order) | Insertion order |

## When to Use

**HashSet**: Order doesn't matter, minimal memory
```java
Set<String> unique = new HashSet<>(Arrays.asList("a", "b", "a"));
// Output: depends on hash codes, e.g., [b, a]
```

**LinkedHashSet**: Need insertion order preserved
```java
Set<String> ordered = new LinkedHashSet<>(Arrays.asList("a", "b", "c"));
// Output: [a, b, c] (always this order)
```

**TreeSet**: Need sorted order (O(log n) operations)
