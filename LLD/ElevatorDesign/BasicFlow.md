# Elevator System Design - Complete LLD Guide

## 🎯 Core System Architecture

### Essential Classes (4 Core Components)

```java
// 1. REQUEST - What users want
class Request {
    int sourceFloor;          // Where user is
    int destinationFloor;     // Where user wants to go (-1 for external)
    Direction direction;      // UP/DOWN/IDLE
    RequestType type;         // EXTERNAL (floor button) / INTERNAL (elevator panel)
}

// 2. ELEVATOR - The moving car
class Elevator {
    int currentFloor;
    Direction currentDirection;           // UP/DOWN/IDLE
    PriorityQueue<Integer> upRequests;    // Min heap - closest floor first
    PriorityQueue<Integer> downRequests;  // Max heap - closest floor first  
    Queue<Request> pendingRequests;       // For incompatible external requests
    
    int getNextFloor() { /* LOOK algorithm implementation */ }
}

// 3. ELEVATOR CONTROLLER - The brain
class ElevatorController {
    List<Elevator> elevators;
    ScheduledExecutorService scheduler;   // Timer for processing
    
    int assignElevator(Request request) { /* Cost-based selection */ }
    void processAllElevators() { /* Called every 2 seconds */ }
}

// 4. BUILDING - Entry point
class Building {
    ElevatorController controller;
    
    // User presses floor button
    int requestElevator(int floor, Direction direction);
    
    // User presses elevator button inside
    void selectFloor(int elevatorId, int destinationFloor);
}
```

## 🧠 Request Processing Logic

### Request Flow Overview
```
User Action → Request Creation → Elevator Selection → Queue Assignment → LOOK Processing → Movement
```

### 1. Elevator Selection (Cost-Based Algorithm)

```java
int calculateCost(Elevator elevator, Request request) {
    int distance = Math.abs(elevator.currentFloor - request.sourceFloor);
    int queueLoad = elevator.getTotalRequests() * 2;
    int directionBonus = (elevator.currentDirection == request.direction) ? -5 : 0;
    
    return distance + queueLoad + directionBonus;
}

// Select elevator with minimum cost
Elevator bestElevator = findMinCostElevator(request);
```

**Example Selection:**
| Elevator | Floor | Direction | Queue Size | Distance | Load Penalty | Direction Bonus | **Total Cost** |
|----------|-------|-----------|------------|----------|--------------|-----------------|----------------|
| E1 | 3 | UP | 2 | 4 | 4 | -5 | **3** ✅ |
| E2 | 9 | DOWN | 1 | 2 | 2 | 0 | **4** |
| E3 | 1 | IDLE | 0 | 6 | 0 | 0 | **6** |

### 2. Queue Assignment (Corrected Logic)

#### External Requests (Floor Button)
```java
void addExternalRequest(Request request) {
    int sourceFloor = request.sourceFloor;
    Direction requestDirection = request.direction;
    
    // Direction compatibility check
    if (requestDirection == UP && sourceFloor > currentFloor) {
        upRequests.add(sourceFloor);        // Can pick up going UP
    } 
    else if (requestDirection == DOWN && sourceFloor < currentFloor) {
        downRequests.add(sourceFloor);      // Can pick up going DOWN
    } 
    else {
        pendingRequests.add(request);       // Incompatible with current journey
    }
}
```

#### Internal Requests (Elevator Panel)
```java
void addInternalRequest(int destinationFloor) {
    // Person already inside - MUST serve (no pending queue)
    if (destinationFloor > currentFloor) {
        upRequests.add(destinationFloor);
    } else if (destinationFloor < currentFloor) {
        downRequests.add(destinationFloor);
    }
}
```

### 3. Queue Structure Example

```
Elevator at Floor 5, Direction: UP

upRequests: [6, 8, 10]           // Sorted automatically (min heap)
downRequests: [4, 2, 1]          // Will process after UP journey  
pendingRequests: [Floor8-DOWN]   // Floor 8 wants DOWN (incompatible now)

Processing: 5→6→8→10 (UP), then 10→4→2→1 (DOWN), then handle pending
```

## ⚙️ LOOK Algorithm Implementation

```java
int getNextFloor() {
    // Continue current direction until exhausted
    if (currentDirection == UP) {
        if (!upRequests.isEmpty()) {
            return upRequests.poll();           // Get closest UP floor
        } else {
            currentDirection = DOWN;            // Switch direction
            processPendingRequests();           // Move compatible pending to active
            return downRequests.isEmpty() ? -1 : downRequests.poll();
        }
    } 
    else if (currentDirection == DOWN) {
        if (!downRequests.isEmpty()) {
            return downRequests.poll();         // Get closest DOWN floor
        } else {
            currentDirection = UP;              // Switch direction  
            processPendingRequests();
            return upRequests.isEmpty() ? -1 : upRequests.poll();
        }
    }
    else { // IDLE
        // Pick any available request
        if (!upRequests.isEmpty()) {
            currentDirection = UP;
            return upRequests.poll();
        } else if (!downRequests.isEmpty()) {
            currentDirection = DOWN;
            return downRequests.poll();
        }
        return -1; // No requests
    }
}
```

## 🔄 System Processing Flow

### Timer-Based Processing
```java
class ElevatorController {
    public ElevatorController() {
        scheduler = Executors.newScheduledThreadPool(1);
        // Process every 2 seconds
        scheduler.scheduleAtFixedRate(this::processAllElevators, 0, 2, TimeUnit.SECONDS);
    }
    
    private void processAllElevators() {
        for (Elevator elevator : elevators) {
            if (elevator.hasRequests()) {
                int nextFloor = elevator.getNextFloor();
                if (nextFloor != -1) {
                    elevator.moveToFloor(nextFloor);
                }
            }
        }
    }
}
```

### Pending Request Processing
```java
void processPendingRequests() {
    Iterator<Request> iterator = pendingRequests.iterator();
    while (iterator.hasNext()) {
        Request req = iterator.next();
        
        // Check if now compatible with current direction
        boolean canServeNow = (req.direction == UP && req.sourceFloor > currentFloor) ||
                             (req.direction == DOWN && req.sourceFloor < currentFloor);
        
        if (canServeNow) {
            addToAppropriateQueue(req.sourceFloor, req.direction);
            iterator.remove();
        }
    }
}
```

## 🚀 Missing Core Functions Implementation

### Key Functions from Phase 1 & 2

#### 1. assignElevator() - Heart of the System
```java
int assignElevator(Request request) {
    Elevator bestElevator = null;
    int minCost = Integer.MAX_VALUE;
    
    for (Elevator elevator : elevators) {
        // Skip if elevator is at capacity
        if (elevator.getCurrentLoad() >= MAX_CAPACITY) continue;
        
        // Use our cost calculation from Phase 2
        int cost = calculateCost(elevator, request);
        if (cost < minCost) {
            minCost = cost;
            bestElevator = elevator;
        }
    }
    
    // Add request using our queue logic from Phase 2
    if (request.type == EXTERNAL) {
        bestElevator.addExternalRequest(request);
    } else {
        bestElevator.addInternalRequest(request.destinationFloor);
    }
    
    return bestElevator.getId();
}
```

#### 2. selectFloor() - Internal Request Handler
```java
void selectFloor(int elevatorId, int destinationFloor) {
    Elevator elevator = getElevatorById(elevatorId);
    int currentFloor = elevator.getCurrentFloor();
    
    // Create internal request - uses our Direction logic from Phase 1
    Direction direction = (destinationFloor > currentFloor) ? UP : DOWN;
    Request request = new Request(currentFloor, destinationFloor, direction, INTERNAL);
    
    // Internal requests always added directly (no pending queue)
    elevator.addInternalRequest(destinationFloor);
}
```

#### 3. moveToFloor() - Physical Movement
```java
void moveToFloor(int targetFloor) {
    if (targetFloor == currentFloor) return;
    
    // Update direction based on target - uses our Direction enum
    currentDirection = (targetFloor > currentFloor) ? UP : DOWN;
    
    // Simulate movement (in real system, this would be hardware control)
    System.out.println("Elevator " + id + " moving " + currentDirection + " to floor " + targetFloor);
    currentFloor = targetFloor;
    
    // Notify observers (from our design pattern)
    notifyObservers(new FloorReachedEvent(id, currentFloor));
}
```

## 🎨 Design Patterns Applied to Our Core System

### 1. **Strategy Pattern** - Swappable Elevator Selection
```java
// Makes our assignElevator() method flexible
interface ElevatorSelectionStrategy {
    Elevator selectBestElevator(List<Elevator> elevators, Request request);
}

class CostBasedStrategy implements ElevatorSelectionStrategy {
    public Elevator selectBestElevator(List<Elevator> elevators, Request request) {
        // Our cost calculation from Phase 2
        return findMinCostElevator(elevators, request);
    }
}

// Usage in ElevatorController
class ElevatorController {
    private ElevatorSelectionStrategy strategy;
    
    int assignElevator(Request request) {
        Elevator best = strategy.selectBestElevator(elevators, request);
        best.addRequest(request);  // Uses our queue logic from Phase 2
        return best.getId();
    }
}
```

### 2. **State Pattern** - Enhanced Direction Management
```java
// Our Direction enum from Phase 1
enum Direction { UP, DOWN, IDLE }

// Our getNextFloor() method IS the state management
int getNextFloor() {
    switch(currentDirection) {
        case UP -> return processUpDirection();      // Continue UP journey
        case DOWN -> return processDownDirection();  // Continue DOWN journey  
        case IDLE -> return processIdleState();     // Pick any request
    }
}

// These methods use our queue logic from Phase 2
private int processUpDirection() {
    if (!upRequests.isEmpty()) return upRequests.poll();
    // Switch to DOWN, process pending - exactly our LOOK algorithm
    currentDirection = DOWN;
    processPendingRequests();
    return downRequests.isEmpty() ? -1 : downRequests.poll();
}
```

### 3. **Observer Pattern** - Building Notifications
```java
// Extends our Building class from Phase 1
class Building implements ElevatorObserver {
    public int requestElevator(int floor, Direction direction) {
        // Our Phase 1 implementation
        Request request = new Request(floor, -1, direction, EXTERNAL);
        return controller.assignElevator(request);
    }
    
    // Observer methods using our core data
    public void onFloorReached(int elevatorId, int floor) {
        // Reset floor buttons, update displays
        // Uses our elevator selection and queue processing results
    }
}
```

### 4. **Command Pattern** - Request Processing
```java
// Our Request class from Phase 1 becomes a Command
abstract class Request {
    abstract void execute(Elevator elevator);
}

class InternalRequest extends Request {
    void execute(Elevator elevator) {
        elevator.addInternalRequest(destinationFloor);  // Uses Phase 2 logic
    }
}

class ExternalRequest extends Request {
    void execute(Elevator elevator) {
        elevator.addExternalRequest(this);  // Uses Phase 2 queue assignment
    }
}
```

## 🔄 Scalability Considerations

### 1. **Horizontal Scaling** 
```java
// Multiple elevator banks for large buildings
class ElevatorBank {
    List<Elevator> lowRiseElevators;    // Floors 1-15
    List<Elevator> midRiseElevators;    // Floors 16-30  
    List<Elevator> highRiseElevators;   // Floors 31-50
    
    // Route request to appropriate bank using our cost calculation
    ElevatorController getControllerForFloor(int floor) {
        if (floor <= 15) return lowRiseController;
        // ... bank selection logic
    }
}
```

### 2. **Vertical Scaling**
```java
// Handle increased load per elevator
class Elevator {
    private static final int DEFAULT_CAPACITY = 10;
    private static final int HIGH_TRAFFIC_CAPACITY = 15;
    
    // Dynamic capacity affects our assignElevator() cost calculation
    void adjustCapacityForTraffic(TrafficLevel level) {
        this.maxCapacity = (level == HIGH) ? HIGH_TRAFFIC_CAPACITY : DEFAULT_CAPACITY;
    }
}
```

### 3. **Performance Optimizations**
```java
// Cache frequently accessed data
class ElevatorController {
    private Map<Integer, Integer> floorDistanceCache;  // Pre-calculated distances
    private Queue<Request> priorityRequests;           // VIP/Emergency requests
    
    // Load balancing using our cost function
    void redistributeLoad() {
        if (someElevatorOverloaded()) {
            moveRequestsToLessLoadedElevators();
        }
    }
}
```

### 4. **Database Integration for Large Systems**
```java
// Persist elevator state and analytics
class ElevatorRepository {
    void saveElevatorState(Elevator elevator);
    List<Request> getHistoricalRequests(int elevatorId);
    void logPerformanceMetrics(ElevatorMetrics metrics);
}

// Usage pattern analysis for predictive scheduling
class TrafficAnalyzer {
    void analyzeUsagePatterns() {
        // Morning rush: pre-position elevators at ground floor
        // Evening rush: distribute elevators across floors
    }
}
```

## 🚨 Edge Cases & Error Handling

### Common Scenarios Using Our Core Logic
```java
// 1. All elevators busy - use our cost function
if (allElevatorsBusy()) {
    // Still use cost calculation, but accept higher costs
    Elevator leastBusy = findElevatorWithMinimalQueue();
    leastBusy.addExternalRequest(request);  // Uses our Phase 2 queue logic
}

// 2. Elevator capacity check - before assignElevator()
if (elevator.getCurrentLoad() >= MAX_CAPACITY) {
    // Skip this elevator in our cost calculation loop
    continue;
}

// 3. Emergency handling using our direction system
if (emergencyDetected()) {
    currentDirection = IDLE;  // Stop processing normal requests
    moveToNearestFloor();     // Use our moveToFloor() method
    redistributeRequests();   // Move pending/active requests to other elevators
}

// 4. No requests scenario in getNextFloor()
if (upRequests.isEmpty() && downRequests.isEmpty() && pendingRequests.isEmpty()) {
    currentDirection = IDLE;  // From our Direction enum
    return -1;               // Our standard "no work" indicator
}
```

## ⚡ Performance Optimizations

### 1. **Request Batching**
- Group nearby floor requests together using our PriorityQueue structure
- Process multiple requests in single direction sweep (our LOOK algorithm)

### 2. **Predictive Scheduling**  
- Analyze usage patterns (morning rush, evening rush)
- Pre-position elevators using our cost calculation for anticipated requests

### 3. **Load Balancing**
- Distribute requests across elevators using our cost function
- Consider elevator queue size in cost calculation (already implemented)

## 🎯 Key Data Structures & Rationale

| Data Structure | Usage | Why This Choice |
|---------------|-------|-----------------|
| `PriorityQueue<Integer>` | Store floors to visit | Auto-sorts by distance, O(log n) insertion |
| `List<Elevator>` | All elevators | Simple iteration for selection |
| `Queue<Request>` | Pending requests | FIFO processing ensures fairness |
| `HashMap<Integer, Elevator>` | Quick elevator lookup | O(1) access by elevator ID |

## 🎪 Interview Response Templates

### **"How do you handle multiple requests?"**
*"I use separate UP and DOWN queues with PriorityQueue for automatic sorting. LOOK algorithm processes current direction completely before switching, preventing inefficient zigzag movement."*

### **"What if elevator is at capacity?"**
*"Check current load before assignment in assignElevator(). If full, skip this elevator in cost calculation loop and select next best option."*

### **"How do you optimize wait times?"**
*"Cost function considers distance, current queue load, and direction compatibility. Elevators moving in same direction as request get -5 bonus in cost calculation."*

### **"Explain your scheduling algorithm choice."**
*"LOOK algorithm is optimal because it's efficient (doesn't waste time going to building ends), fair (no request starvation), and prevents zigzag movement by completing one direction before switching."*

## 🎯 Quick Implementation Checklist

### **Phase 1: Core Structure (10 mins)**
- [ ] Define 4 main classes with key attributes
- [ ] Implement basic request flow using Direction enum
- [ ] Add simple elevator assignment logic

### **Phase 2: Smart Processing (10 mins)**
- [ ] Implement LOOK algorithm with queue switching
- [ ] Add cost-based elevator selection with direction bonus
- [ ] Handle pending requests for external incompatible requests

### **Phase 3: Design Patterns & Scalability (5 mins)**
- [ ] Apply Strategy pattern to make assignElevator() flexible
- [ ] Use Observer pattern for Building notifications  
- [ ] Add scalability considerations (elevator banks, load balancing)
- [ ] Implement missing core functions (moveToFloor, selectFloor)

## 💡 Key Interview Points to Emphasize

1. **"Separate queues for UP/DOWN prevent inefficient zigzag movement"**
2. **"PriorityQueue automatically maintains optimal floor ordering"**  
3. **"Cost function balances distance, load, and direction for fairness"**
4. **"Pending queue ensures external requests don't interfere with current journey efficiency"**
5. **"Timer-based processing allows realistic elevator movement simulation"**
6. **"Design is extensible - can easily swap scheduling algorithms using Strategy pattern"**

## ⚠️ What NOT to Overcomplicate

**Avoid Unless Asked:**
- Complex threading/synchronization details
- Detailed UI/display implementations  
- Advanced optimizations (ML-based prediction, etc.)
- Multiple inheritance hierarchies

**Focus On:**
- Clean separation of concerns
- Working algorithms with proper edge cases
- Logical request flow from user action to elevator movement
- Extensible design using common patterns

---

*This system efficiently handles elevator requests using proven algorithms while maintaining code clarity and extensibility for real-world applications.*