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