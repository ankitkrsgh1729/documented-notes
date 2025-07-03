# Two Pointers Algorithm - Java Quick Reference

## 📋 Pattern Overview
**Time:** O(n) | **Space:** O(1)

Use when: Finding pairs, target sums, palindromes, or optimizing from O(n²) to O(n)

---

## 🔧 Main Variants

### 1. **Opposite Ends**
```java
public int oppositeEnds(int[] arr) {
    int left = 0, right = arr.length - 1;
    
    while (left < right) {
        // Process current pair
        if (condition) {
            left++;
        } else {
            right--;
        }
    }
    return result;
}
```

### 2. **Fast & Slow**
```java
public int fastSlow(int[] arr) {
    int slow = 0;
    
    for (int fast = 0; fast < arr.length; fast++) {
        if (condition) {
            arr[slow++] = arr[fast];
        }
    }
    return slow;
}
```

---

## 💡 Container With Most Water
```java
public int maxArea(int[] height) {
    int left = 0, right = height.length - 1;
    int maxArea = 0;
    
    while (left < right) {
        int area = Math.min(height[left], height[right]) * (right - left);
        maxArea = Math.max(maxArea, area);
        
        if (height[left] < height[right]) {
            left++;
        } else {
            right--;
        }
    }
    return maxArea;
}
```

---

## 🎪 Common Problems

### **Two Sum (Sorted)**
```java
public int[] twoSum(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    
    while (left < right) {
        int sum = nums[left] + nums[right];
        if (sum == target) return new int[]{left, right};
        else if (sum < target) left++;
        else right--;
    }
    return new int[]{};
}
```

### **Valid Palindrome**
```java
public boolean isPalindrome(String s) {
    int left = 0, right = s.length() - 1;
    
    while (left < right) {
        if (s.charAt(left) != s.charAt(right)) return false;
        left++;
        right--;
    }
    return true;
}
```

### **Remove Duplicates**
```java
public int removeDuplicates(int[] nums) {
    int slow = 0;
    
    for (int fast = 1; fast < nums.length; fast++) {
        if (nums[fast] != nums[slow]) {
            nums[++slow] = nums[fast];
        }
    }
    return slow + 1;
}

// It's returning the length of non duplicate array
```
### nums[++slow] vs nums[slow++]

#### Pre-increment (++slow):
// This:

nums[++slow] = nums[fast];

// Is equivalent to:

slow = slow + 1;

nums[slow] = nums[fast];

#### Post-increment (slow++):
// This:

nums[slow++] = nums[fast];

// Is equivalent to:

nums[slow] = nums[fast];

slow = slow + 1;

### **3Sum**
```java
public List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> result = new ArrayList<>();
    
    for (int i = 0; i < nums.length - 2; i++) {
        if (i > 0 && nums[i] == nums[i-1]) continue;
        
        int left = i + 1, right = nums.length - 1;
        
        while (left < right) {
            int sum = nums[i] + nums[left] + nums[right];
            if (sum == 0) {
                result.add(Arrays.asList(nums[i], nums[left], nums[right]));
                while (left < right && nums[left] == nums[left + 1]) left++;
                while (left < right && nums[right] == nums[right - 1]) right--;
                left++;
                right--;
            } else if (sum < 0) {
                left++;
            } else {
                right--;
            }
        }
    }
    return result;
}
```

---

## 📚 Practice Problems

**Easy:** Two Sum II, Valid Palindrome, Remove Duplicates  
**Medium:** Container With Most Water, 3Sum, Trapping Rain Water  
**Hard:** Minimum Window Substring, Sliding Window Maximum

---

## 🔑 Key Insights

### **Why Container With Most Water Works:**
- Start with **maximum width** (both ends)
- Water level = **min(left_height, right_height)**
- Moving the **taller line** inward = same height, less width = worse result
- Moving the **shorter line** inward = potential for taller line = better result

### **Fast & Slow Pointer Logic:**
- **Slow** = position for next valid element
- **Fast** = scanning pointer
- `arr[slow++] = arr[fast]` = **overwrite** invalid elements with valid ones
- We **reuse the same array** instead of creating new one (in-place)

### **General Strategy:**
- **Opposite Ends:** Eliminate impossible solutions early
- **Fast & Slow:** Compact array by overwriting unwanted elements
- **Always move the "worse" pointer** to find better solutions

---

## 🎯 Quick Recognition

✅ **Use when:** "Find pair that...", "Maximum area", "Palindrome", "Remove duplicates"  
❌ **Don't use for:** Unsorted data, All pairs needed, DP problems