# Dynamic Programming - Quick Reference

## Core Concepts

**Dynamic Programming** = Recursion + Memoization/Tabulation

### Why Recursion First?
- Helps identify overlapping subproblems
- Natural way to think about problem breakdown
- Easier to convert to DP once recursive solution is clear

### Three Approaches

#### 1. Recursion (Exponential Time)
Solve problem by breaking into subproblems - recalculates same subproblems multiple times
```
Example: fib(5)
                    fib(5)
                   /      \
              fib(4)        fib(3)
             /     \        /     \
        fib(3)   fib(2)  fib(2)  fib(1)
        /    \    /   \   /   \
    fib(2) fib(1) ...  ... ...
    /   \
fib(1) fib(0)

Notice: fib(3) calculated 2 times, fib(2) calculated 3 times!
Time: O(2^n) - Exponential due to overlapping subproblems
```

#### 2. Memoization (Top-Down DP)
Start from top, store results in cache as you solve - prevents recalculation
```
Example: fib(5) with cache
                    fib(5)
                   /      \
              fib(4)        fib(3) ← fetched from cache!
             /     \              
        fib(3)   fib(2)           
        /    \    /   \          
    fib(2) fib(1) fib(1) fib(0) ← all cached
    /   \
fib(1) fib(0)

Cache: {fib(0)=0, fib(1)=1, fib(2)=1, fib(3)=2, fib(4)=3, fib(5)=5}

Flow: Top → Down (start from main problem, break down)
Time: O(n) - Each subproblem solved only once
Space: O(n) cache + O(n) recursion stack
```

#### 3. Tabulation (Bottom-Up DP)
Build solution from base cases iteratively - no recursion needed
```
Example: fib(5) table building
Step by step table filling:

Initial: dp = [0, 1, _, _, _, _]
                ↑  ↑
            base cases

Step 1:  dp = [0, 1, 1, _, _, _]  (dp[2] = dp[0] + dp[1])
Step 2:  dp = [0, 1, 1, 2, _, _]  (dp[3] = dp[1] + dp[2])
Step 3:  dp = [0, 1, 1, 2, 3, _]  (dp[4] = dp[2] + dp[3])
Step 4:  dp = [0, 1, 1, 2, 3, 5]  (dp[5] = dp[3] + dp[4])
                              ↑
                          answer!

Flow: Bottom → Up (start from base cases, build up)
Time: O(n) - Single pass through table
Space: O(n) - Only table, no recursion stack
```

#### Visual Comparison
```
RECURSION:        Top
                   ↓ (breaks down)
                 Middle
                   ↓
                 Bottom
                   ↓ (returns up)
                 Answer
                 
MEMOIZATION:      Top (start)
                   ↓ (breaks down)
                 Middle ← cache hit!
                   ↓
                 Bottom
                   ↓ (returns cached)
                 Answer
                 
TABULATION:       Bottom (base cases)
                   ↑ (builds up)
                 Middle
                   ↑
                  Top
                   ↑
                 Answer
```

---

## Pattern 1: 0/1 Knapsack (Bounded)

### Problem Identification
- Choice to include or exclude item
- Constraint on capacity/weight
- Maximize/minimize value

### Recursive Template
```java
public int knapsack(int[] wt, int[] val, int W, int n) {
    // Base case
    if (n == 0 || W == 0) {
        return 0;
    }
    
    // Choice diagram
    if (wt[n-1] <= W) {
        // Include or exclude
        return Math.max(
            val[n-1] + knapsack(wt, val, W - wt[n-1], n-1),
            knapsack(wt, val, W, n-1)
        );
    } else {
        // Can't include
        return knapsack(wt, val, W, n-1);
    }
}
```

### Memoization Template
```java
int[][] dp = new int[n+1][W+1];

// Initialize with -1 to mark uncomputed states
// 0 is a valid answer, so we can't use 0 to check if computed
for (int i = 0; i <= n; i++) {
    Arrays.fill(dp[i], -1);
}

public int knapsackMemo(int[] wt, int[] val, int W, int n) {
    if (n == 0 || W == 0) {
        return 0;
    }
    
    // Return cached result if already computed
    if (dp[n][W] != -1) {
        return dp[n][W];
    }
    
    if (wt[n-1] <= W) {
        dp[n][W] = Math.max(
            val[n-1] + knapsackMemo(wt, val, W - wt[n-1], n-1),
            knapsackMemo(wt, val, W, n-1)
        );
    } else {
        dp[n][W] = knapsackMemo(wt, val, W, n-1);
    }
    
    return dp[n][W];
}
```

### Tabulation Template
```java
int[][] dp = new int[n+1][W+1];

// Base cases already 0 by default in Java
// dp[i][0] = 0 -> no capacity means 0 value
// dp[0][j] = 0 -> no items means 0 value

// Fill table bottom-up
for (int i = 1; i <= n; i++) {
    for (int j = 1; j <= W; j++) {
        if (wt[i-1] <= j) {
            dp[i][j] = Math.max(
                val[i-1] + dp[i-1][j - wt[i-1]],
                dp[i-1][j]
            );
        } else {
            dp[i][j] = dp[i-1][j];
        }
    }
}

return dp[n][W];
```

### Choice Diagram
```
         Item i with weight wt[i] and value val[i]
                          |
                  Can it fit? (wt[i] <= W)
                          |
            +-------------+-------------+
           YES                         NO
            |                           |
      Two choices:                 Must skip
      1. Include item              (no choice)
      2. Skip item                      |
            |                      Solve(i-1, W)
   +--------+--------+
   |                 |
Include           Skip
   |                 |
val[i] +       Solve(i-1, W)
Solve(i-1, 
  W - wt[i])
   |
Take MAX of both choices
```

### Variations
- Subset Sum
- Equal Sum Partition
- Count of Subset Sum
- Minimum Subset Sum Difference
- Target Sum
- Number of Subsets with Given Difference

---

## Pattern 2: Unbounded Knapsack

### Problem Identification
- Unlimited supply of items (can use item multiple times)
- Similar to 0/1 but **can reuse items**

### Key Difference from 0/1 Knapsack
```java
// When including item, stay at same index (n) instead of (n-1)
// WHY? Because we have unlimited supply - after using item i,
// we can use it again, so don't move to (n-1)
if (wt[n-1] <= W) {
    return Math.max(
        val[n-1] + knapsack(wt, val, W - wt[n-1], n),  // n, not n-1 - can reuse!
        knapsack(wt, val, W, n-1)
    );
}
```

### Choice Diagram
```
         Item i with weight wt[i] and value val[i]
                          |
                  Can it fit? (wt[i] <= W)
                          |
            +-------------+-------------+
           YES                         NO
            |                           |
      Two choices:                 Must skip
      1. Include item              (no choice)
      2. Skip item                      |
            |                      Solve(i-1, W)
   +--------+--------+
   |                 |
Include           Skip
   |                 |
val[i] +       Solve(i-1, W)
Solve(i,           ← Key difference: 
  W - wt[i])         We move to (i-1) here
      ↑              not when including
Can use item 
again! Stay 
at index i
```

### Variations
- Rod Cutting Problem
- Coin Change (Max ways)
- Coin Change (Min coins)
- Maximum Ribbon Cut

---

## Pattern 3: Longest Common Subsequence (LCS)

### Problem Identification
- Two sequences/strings
- Find common pattern (not necessarily contiguous)

### Recursive Template
```java
public int lcs(String s1, String s2, int m, int n) {
    // Base case
    if (m == 0 || n == 0) {
        return 0;
    }
    
    // Choice
    if (s1.charAt(m-1) == s2.charAt(n-1)) {
        return 1 + lcs(s1, s2, m-1, n-1);
    } else {
        return Math.max(
            lcs(s1, s2, m-1, n),
            lcs(s1, s2, m, n-1)
        );
    }
}
```

### Tabulation Template
```java
int[][] dp = new int[m+1][n+1];

// Base case: empty strings have LCS = 0
// dp[i][0] = 0 -> s1 vs empty string
// dp[0][j] = 0 -> empty string vs s2
// (Already 0 by default in Java)

for (int i = 1; i <= m; i++) {
    for (int j = 1; j <= n; j++) {
        if (s1.charAt(i-1) == s2.charAt(j-1)) {
            dp[i][j] = 1 + dp[i-1][j-1];
        } else {
            dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
        }
    }
}

return dp[m][n];
```

### Choice Diagram
```
    Comparing s1[i] with s2[j]
              |
        Do they match?
              |
      +-------+-------+
      |               |
    MATCH           NO MATCH
      |               |
s1[i] == s2[j]   s1[i] != s2[j]
      |               |
   Include           Can't include both
   both in LCS       Two options:
      |               |
   1 + LCS          +--+--+
   (i-1, j-1)       |     |
                    |     |
               LCS(i-1,j) LCS(i,j-1)
               Skip s1[i] Skip s2[j]
                    |     |
                    +--+--+
                       |
                   Take MAX

Example: s1 = "ABCD", s2 = "AEBD"
         A matches A -> include both, move (i-1,j-1)
         B != E -> max(skip B, skip E)
```

### Variations
- Longest Common Substring (must be contiguous)
- Shortest Common Supersequence (SCS)
- Minimum Insertions/Deletions to convert s1 to s2
- Longest Palindromic Subsequence (LCS with reversed string)
- Minimum Deletions to make Palindrome
- Print LCS (backtrack from dp table)
- Sequence Pattern Matching
- Distinct Subsequences (count ways)

---

## Pattern 4: Matrix Chain Multiplication (MCM) - TODO

### Problem Identification
- Breaking problem into subproblems using different partitions
- Finding optimal partition point (k)
- Format: `solve(i, k) + solve(k+1, j) + cost`

### Variations
- Palindrome Partitioning
- Evaluate Expression to True (Boolean Parenthesization)
- Scrambled String
- Egg Dropping Problem
- Burst Balloons

---

## Pattern 5: DP on Trees - TODO

### Problem Identification
- Binary tree structure
- Need to make decisions at each node
- Combine results from children

### Variations
- Diameter of Binary Tree
- Maximum Path Sum
- House Robber III

---

## Key Tips

### Identifying DP Problems
- Problem asks for optimal value (max/min)
- Problem asks for count of ways
- Choices at each step
- Overlapping subproblems

### Converting Recursion to DP
1. Write recursive solution
2. Identify changing parameters
3. Create dp array with those dimensions
4. Add memoization (store and return cached results)
5. Convert to tabulation (bottom-up)

### Space Optimization
- If dp[i] only depends on dp[i-1], use 1D array
- Rolling array technique for 2D problems

---

## Practice Strategy
1. Master one pattern at a time
2. Solve 5-6 problems per pattern
3. First write recursion, then memoization, then tabulation
4. Recognize pattern before coding