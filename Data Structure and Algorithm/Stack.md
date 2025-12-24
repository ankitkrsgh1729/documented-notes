# Monotonic Stack Pattern

## When to Use
- Processing elements sequentially
- Need next/previous greater/smaller element
- Removing elements based on comparison
- Maintaining ordering constraint

## Template
```java
Stack<Type> st = new Stack<>();

for (each element) {
    // Pop elements violating monotonic property
    while (!st.isEmpty() && CONDITION) {
        st.pop();
        // Optional: track what was popped
    }
    st.push(current);
}
```

## Common Patterns

### 1. Next Greater/Smaller
```java
while (!st.isEmpty() && arr[i] < arr[st.peek()]) {
    st.pop();
}
```
**Problems:** Next Greater Element, Daily Temperatures, Subarray Minimums

### 2. Remove K Elements
```java
while (!st.isEmpty() && k > 0 && curr < st.peek()) {
    st.pop();
    k--;
}
```
**Problems:** Remove K Digits, Remove Duplicate Letters

### 3. Collision/Matching
```java
while (!st.isEmpty() && collisionCondition) {
    st.pop();
}
```
**Problems:** Asteroid Collision, Valid Parentheses

### 4. Histogram/Area
```java
while (!st.isEmpty() && heights[i] < heights[st.peek()]) {
    // Calculate area with popped element
}
```
**Problems:** Largest Rectangle, Trapping Rain Water

## Key Question
"Should I remove previous elements when seeing current element?"
→ If yes, use Monotonic Stack

--------------------------------
--------------------------------


# LRU Cache Pattern
https://leetcode.com/problems/lru-cache/description/

## Core Idea
Combine **HashMap + Doubly LinkedList** for O(1) get/put operations.

## Why This Data Structure?
- **HashMap**: O(1) lookup by key
- **Doubly LinkedList**: O(1) add/remove from both ends
  - Head → Most Recently Used (MRU)
  - Tail → Least Recently Used (LRU)

## Structure
```java
class Node {
    int key, value;
    Node prev, next;
}

class LRUCache {
    HashMap<Integer, Node> map;
    Node head, tail;  // Dummy nodes
    int capacity;
}
```

## Operations

### 1. Get(key)
```java
if (!map.containsKey(key)) return -1;
Node node = map.get(key);
moveToHead(node);  // Mark as recently used
return node.value;
```

### 2. Put(key, value)
```java
if (map.containsKey(key)) {
    // Update existing
    node.value = value;
    moveToHead(node);
} else {
    // Add new
    Node newNode = new Node(key, value);
    map.put(key, newNode);
    addToHead(newNode);
    
    if (map.size() > capacity) {
        removeLRU();  // Remove tail
    }
}
```

## Helper Methods
```java
// Move node to head (mark as MRU)
void moveToHead(Node node) {
    remove(node);
    addToHead(node);
}

// Remove node from list
void remove(Node node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
}

// Add node after head
void addToHead(Node node) {
    node.next = head.next;
    node.prev = head;
    head.next.prev = node;
    head.next = node;
}

// Remove LRU (tail.prev)
void removeLRU() {
    Node lru = tail.prev;
    remove(lru);
    map.remove(lru.key);
}
```

## Key Points
- Use **dummy head & tail** nodes to avoid null checks
- **Always update position** on get/put (move to head)
- **Evict from tail** when capacity exceeded
- Remember to **update both map and list**

## Time Complexity
- get(): O(1)
- put(): O(1)

## Space Complexity
- O(capacity)