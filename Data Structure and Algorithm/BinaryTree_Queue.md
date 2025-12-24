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