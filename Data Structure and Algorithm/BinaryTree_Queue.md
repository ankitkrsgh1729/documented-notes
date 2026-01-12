# Binary Tree BFS (Level Order) Pattern

## When to Use This Pattern

**Problem Indicators:**
- Question mentions "level," "depth," or "row"
- Need to process tree **layer by layer**
- Asked about **leftmost/rightmost** nodes at each level
- Need to track **width** or **distance** between nodes
- Process nodes at **same depth** together

**Key Signal:** If you can't solve it by going straight down (DFS), think level-by-level (BFS).

## Problem Types

### 1. Level-Based Queries
- "Return nodes at each level"
- "Find the average/sum/max of each level"
- "Process tree level by level"

### 2. Boundary/View Problems
- "Right side view" - rightmost node per level
- "Left side view" - leftmost node per level
- "Bottom view" - last level nodes

### 3. Width/Distance Problems
- "Maximum width of tree"
- "Distance between nodes at same level"
- "Find leftmost/rightmost node in a level"

### 4. Zigzag/Spiral Traversal
- "Alternate direction at each level"
- "Spiral order traversal"

### 5. Level-Specific Operations
- "Reverse nodes at odd levels"
- "Connect nodes at same level"
- "Find level with maximum sum"

## BFS vs DFS Decision

| Use BFS When | Use DFS When |
|--------------|--------------|
| Need level information | Need path information |
| Process horizontally | Process vertically |
| Width, views, zigzag | Height, diameter, paths |
| "Each level", "row" | "Root to leaf", "ancestors" |

## Core Template
```java
Queue<TreeNode> q = new ArrayDeque<>();
if (root != null) q.add(root);

while (!q.isEmpty()) {
    int size = q.size();  // ⭐ Key: capture level size
    
    for (int i = 0; i < size; i++) {
        TreeNode node = q.poll();
        
        // Process current node
        
        if (node.left != null) q.add(node.left);
        if (node.right != null) q.add(node.right);
    }
    
    // End of level - do level-specific work here
}
```

## Pattern Variations

### 1. Basic Level Order
**Problem:** Return all levels as nested lists
```java
List<List<Integer>> ans = new ArrayList<>();
List<Integer> level = new ArrayList<>();

for (int i = 0; i < size; i++) {
    TreeNode node = q.poll();
    level.add(node.val);
    // add children
}
ans.add(level);
```

### 2. Right/Left Side View
**Problem:** Return rightmost/leftmost node at each level
```java
for (int i = 0; i < size; i++) {
    TreeNode node = q.poll();
    if (i == size - 1) ans.add(node.val);  // Rightmost
    if (i == 0) ans.add(node.val);         // Leftmost
    // add children
}
```

### 3. Zigzag Level Order
**Problem:** Alternate left-to-right and right-to-left
```java
boolean leftToRight = true;
List<Integer> level = new ArrayList<>();

for (int i = 0; i < size; i++) {
    // ... process nodes normally
}

if (!leftToRight) Collections.reverse(level);
leftToRight = !leftToRight;
ans.add(level);
```

### 4. Width of Binary Tree
**Problem:** Maximum width (with null gaps counted)
```java
Queue<Pair<TreeNode, Integer>> q = new ArrayDeque<>();
q.add(new Pair(root, 0));

int first = 0, last = 0;
int minIndex = q.peek().index;  // Normalize indices

for (int i = 0; i < size; i++) {
    Pair<TreeNode, Integer> curr = q.poll();
    int index = curr.index - minIndex;
    
    if (i == 0) first = index;
    if (i == size - 1) last = index;
    
    if (node.left != null) 
        q.add(new Pair(node.left, 2 * index + 1));
    if (node.right != null) 
        q.add(new Pair(node.right, 2 * index + 2));
}

maxWidth = Math.max(maxWidth, last - first + 1);
```

### 5. Average/Max of Each Level
**Problem:** Calculate level statistics
```java
for (int i = 0; i < size; i++) {
    TreeNode node = q.poll();
    sum += node.val;  // or track max/min
    // add children
}
double avg = (double) sum / size;
```

## Key Points
- **Always capture `size` before loop** - queue grows during iteration
- **Use index `i`** to identify first/last nodes in level
- **Track positions** when null gaps matter (width problems)
- **Process level data** after the for-loop ends

## Common Mistakes
- ❌ Not capturing `size` → infinite loop
- ❌ Using `q.size()` in loop condition → wrong level count
- ❌ Adding nulls to queue → exponential growth

## Mental Model
Think of BFS as **peeling an onion layer by layer** - process one complete layer before moving to the next.


# LCA (Lowest Common Ancestor) Pattern

## Core Concept
**LCA** = The deepest node that has both target nodes as descendants (a node can be ancestor of itself)

**Visual**: The "split point" where paths from two nodes diverge when moving toward root.

---

## Pattern Recognition
Use LCA when problem asks for:
- Common ancestor of nodes
- Smallest subtree containing specific nodes
- Distance between two nodes
- Path between two nodes

---

## Standard LCA Template

### Basic Structure
```java
TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    // Base cases
    if (root == null || root == p || root == q) return root;
    
    // Recurse
    TreeNode left = lca(root.left, p, q);
    TreeNode right = lca(root.right, p, q);
    
    // Decision logic
    if (left != null && right != null) return root;  // Split point
    return left != null ? left : right;              // Propagate
}
```

### Key Logic
- **Both found** (left AND right) → current node is LCA
- **One found** → propagate that result up
- **None found** → return null

---

## Common Variations

### 1. **Classic LCA** (LeetCode 236)
- Given: Two nodes p and q
- Return: Their LCA
- Template: Standard template above

### 2. **LCA with Depth** (Deepest Nodes)
- Track: `{depth, lca_node}` pair
- Compare: Left vs right depth
- Logic:
  - `leftDepth == rightDepth` → current is LCA
  - `leftDepth > rightDepth` → use left's result
  - Otherwise → use right's result

```java
class Result {
    int depth;
    TreeNode node;
}

Result helper(TreeNode root) {
    if (root == null) return new Result(-1, null);
    
    Result left = helper(root.left);
    Result right = helper(root.right);
    
    if (left.depth == right.depth) 
        return new Result(left.depth + 1, root);
    return left.depth > right.depth ? 
        new Result(left.depth + 1, left.node) : 
        new Result(right.depth + 1, right.node);
}
```


### 3. **LCA in BST** (LeetCode 235)
- Optimization: Use BST property
- If `p.val < root.val < q.val` → root is LCA
- If both smaller → search left
- If both larger → search right

---

## Mental Models

### Model 1: Path Intersection
```
Node A path to root: A → C → E → ROOT
Node B path to root: B → C → E → ROOT
First common: C ← LCA
```

### Model 2: Split Point
```
         ROOT
        /    \
    Subtree   Subtree
    with A    with B
    
If A and B on different sides → ROOT is LCA
```

### Model 3: Walking Up
Two people walk from nodes toward root → where they meet is LCA

---





## Complexity Analysis

| Metric | Value | Note |
|--------|-------|------|
| Time | O(n) | Visit each node once |
| Space | O(h) | Recursion stack (h = height) |
| Best case | O(log n) | Balanced tree |
| Worst case | O(n) | Skewed tree |

---



*Last Updated: January 2026*
