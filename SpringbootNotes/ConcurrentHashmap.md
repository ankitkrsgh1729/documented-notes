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
