# ConcurrentHashMap vs HashMap

## HashMap vs ConcurrentHashMap: Key Differences

| Feature | HashMap | ConcurrentHashMap |
|---------|---------|-------------------|
| Thread Safety | Not thread-safe | Thread-safe |
| Performance | Faster in single-thread | Better in multi-thread |
| Null Support | Allows null keys and values | No null keys or values |
| Locking | N/A (not synchronized) | Segment/bucket level locking |
| Iteration | Fail-fast (throws ConcurrentModificationException) | Weakly consistent iterators |

## When to Use Each:

- **Use HashMap when:**
  - Working in a single-threaded environment
  - Performance is critical in a non-concurrent context
  - Need to store null keys or values

- **Use ConcurrentHashMap when:**
  - Multiple threads access the map concurrently
  - Need thread safety without external synchronization
  - High concurrency with minimal blocking is required
  - Performance under high thread contention is important

# Why ConcurrentHashMap Doesn't Support Null Values

## The Problem: Ambiguous Null Return

When a `get()` operation returns `null`, there are two possible meanings:
1. The key doesn't exist in the map
2. The key exists but is mapped to a `null` value

In concurrent environments, this ambiguity creates practical problems.

## Real-world Example: Customer Cache

```java
ConcurrentHashMap<String, CustomerProfile> customerCache = new ConcurrentHashMap<>();
```

### The Issue with Null Values

If nulls were allowed:

```java
// Thread 1
CustomerProfile profile = customerCache.get("customer123");
if (profile == null) {
    // NULL AMBIGUITY: "not checked yet" or "checked and doesn't exist"?
    profile = database.getCustomer("customer123");  // Unnecessary DB query?
    customerCache.put("customer123", null);  // Store "doesn't exist"
}
```

Multiple threads would make redundant database queries because they can't distinguish between:
- Keys not in the cache yet
- Keys mapped to null (meaning "customer doesn't exist")

### The Solution: No Null Values

With null values disallowed:

```java
// Use a marker object instead
private static final CustomerProfile CUSTOMER_NOT_EXIST = new CustomerProfile();

CustomerProfile profile = customerCache.get("customer123");
if (profile == null) {
    // Clear meaning: "not in cache yet"
    profile = database.getCustomer("customer123");
    customerCache.put("customer123", 
                     profile != null ? profile : CUSTOMER_NOT_EXIST);
}

// Check if it's our marker object
return (profile == CUSTOMER_NOT_EXIST) ? null : profile;
```

## Benefits of Disallowing Null

1. Unambiguous meaning of `null` return: always "not in cache"
2. Eliminates race conditions in "check-then-act" patterns
3. Avoids redundant operations in concurrent scenarios
4. Makes concurrent code more reliable and predictable

This design choice is an intentional trade-off that improves thread safety and performance.



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
