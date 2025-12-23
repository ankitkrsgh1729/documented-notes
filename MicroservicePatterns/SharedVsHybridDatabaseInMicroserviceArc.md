# Microservices: Database Architecture Patterns

// Reference content : Alex Xu, vol 2 : Hotel Reservation System
## 1. Three Database Approaches

### A. Shared Database (Monolithic)
```
┌─────────────────────────────────────┐
│         Application Layer           │
│  ┌──────────┐      ┌──────────┐    │
│  │Inventory │      │Reservation│    │
│  │ Service  │      │  Service  │    │
│  └────┬─────┘      └─────┬─────┘    │
│       │                  │          │
│       └──────┬───────────┘          │
│              ▼                       │
│    ┌─────────────────────┐          │
│    │  Shared Database    │          │
│    │  ┌────────────────┐ │          │
│    │  │ Inventory Table│ │          │
│    │  │ Reservation Tbl│ │          │
│    │  └────────────────┘ │          │
│    └─────────────────────┘          │
└─────────────────────────────────────┘
```

**Characteristics:**
- Single database, multiple services
- ACID transactions span all tables
- Strong consistency guaranteed
- Services coupled through schema

---

### B. Database Per Service (Pure Microservices)
```
┌──────────────┐         ┌──────────────┐
│  Inventory   │         │ Reservation  │
│   Service    │         │   Service    │
└──────┬───────┘         └──────┬───────┘
       │                        │
       ▼                        ▼
┌─────────────┐          ┌─────────────┐
│ Inventory   │          │ Reservation │
│   Database  │          │  Database   │
└─────────────┘          └─────────────┘
```

**Characteristics:**
- Complete service autonomy
- No direct database access between services
- Communication via APIs/Events
- Eventual consistency

---

### C. Hybrid Approach (Pragmatic)
```
┌─────────────────────────────┐    ┌──────────────┐
│    Core Domain              │    │   User       │
│  ┌──────────┐ ┌──────────┐ │    │  Service     │
│  │Inventory │ │Reservation│ │    └──────┬───────┘
│  │ Service  │ │  Service  │ │           │
│  └────┬─────┘ └─────┬─────┘ │           ▼
│       │             │        │    ┌─────────────┐
│       └──────┬──────┘        │    │    User     │
│              ▼               │    │  Database   │
│    ┌─────────────────┐       │    └─────────────┘
│    │ Shared Database │       │
│    │ (Inventory +    │       │    ┌──────────────┐
│    │  Reservation)   │       │    │   Review     │
│    └─────────────────┘       │    │   Service    │
└─────────────────────────────┘    └──────┬───────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │   Review    │
                                   │  Database   │
                                   └─────────────┘
```

**Characteristics:**
- Tightly coupled services share database
- Loosely coupled services separate databases
- Balance between consistency and autonomy

---

## 2. Strong Consistency Explained

### Shared Database Transaction Flow
```
User Request: Book Room 101
         │
         ▼
┌────────────────────────────────────┐
│  BEGIN TRANSACTION                 │
│                                    │
│  1. Check Inventory                │
│     SELECT * FROM rooms            │
│     WHERE room_id = 101            │
│     FOR UPDATE  🔒 LOCK            │
│                                    │
│  2. Update Inventory               │
│     UPDATE rooms                   │
│     SET available = available - 1  │
│     WHERE room_id = 101            │
│                                    │
│  3. Create Reservation             │
│     INSERT INTO reservations       │
│     (room_id, user_id, ...)        │
│     VALUES (101, 456, ...)         │
│                                    │
│  COMMIT ✓                          │
│  🔓 UNLOCK                         │
└────────────────────────────────────┘
         │
         ▼
   All or Nothing
```

**Why It's Strongly Consistent:**
- ✅ ACID guarantees (Atomicity, Consistency, Isolation, Durability)
- ✅ Locks prevent concurrent modifications
- ✅ Either ALL operations succeed or ALL rollback
- ✅ No intermediate states visible
- ✅ Database enforces consistency automatically

---

### Separate Databases - Lost Consistency
```
Timeline:

T=0    Inventory Service: Reserve room ✓
       (Room 101: available = 4)
       
T=100  Reservation Service: Create booking ✓
       (Booking confirmed)
       
T=200  Payment Service: Charge card ❌ FAILS
       
T=300  Need to rollback...
       ├─ Cancel reservation ✓
       └─ Release room... wait, another booking 
          already took that room! 😱

Problem: No way to guarantee atomicity
```

**Consistency Problems:**
- ❌ **Dirty Reads**: Another service sees uncommitted changes
- ❌ **Lost Updates**: Concurrent modifications conflict
- ❌ **Phantom Reads**: Inventory count changes between steps
- ❌ **Partial Failures**: One service succeeds, another fails

---

## 3. Distributed Transaction Solutions

### Two-Phase Commit (2PC)
```
PHASE 1: PREPARE (Can you commit?)
========================================

Coordinator                          Services
    │                                   
    ├──"Prepare"──────────────────────> Inventory
    │                                   - Lock resources 🔒
    │                                   - Write undo log
    │                                   
    ├──"Prepare"──────────────────────> Reservation  
    │                                   - Lock resources 🔒
    │                                   - Write undo log
    │                                   
    ├──"Prepare"──────────────────────> Payment
    │                                   - Lock resources 🔒
    │                                   - Write undo log
    │                                   
    │<──────────────"Yes, ready"──────  All Services
    │               (Vote)              


PHASE 2: COMMIT (Do it!)
========================================

Coordinator                          Services
    │
    ├──"Commit"───────────────────────> Inventory
    │                                   - Commit changes ✓
    │                                   - Unlock 🔓
    │
    ├──"Commit"───────────────────────> Reservation
    │                                   - Commit changes ✓
    │                                   - Unlock 🔓
    │
    ├──"Commit"───────────────────────> Payment
    │                                   - Commit changes ✓
    │                                   - Unlock 🔓
    │
    ▼
  Success!

---

IF ANY VOTES "NO": Send ABORT to all
  - All services rollback
  - All unlock resources
```

**Problems:**
- 🐌 **Slow**: Locks held during both phases
- 🚫 **Blocking**: If coordinator crashes, everyone waits
- 📉 **Low Throughput**: Synchronous, sequential

---

### Saga Pattern - Choreography
```
Event-Driven Flow (No Coordinator)
=====================================

Step 1: Reserve Inventory
┌──────────────┐
│  Inventory   │ 1. Reserve room ✓
│   Service    │ 2. Publish: RoomReserved
└──────┬───────┘
       │ Event Bus
       ▼
Step 2: Create Reservation
┌──────────────┐
│ Reservation  │ 3. Consume: RoomReserved
│   Service    │ 4. Create booking ✓
└──────┬───────┘ 5. Publish: BookingCreated
       │
       ▼
Step 3: Process Payment
┌──────────────┐
│   Payment    │ 6. Consume: BookingCreated
│   Service    │ 7. Charge card...
└──────┬───────┘    └─> ❌ FAILED!
       │         8. Publish: PaymentFailed
       ▼
Step 4: COMPENSATE (Undo)
┌──────────────┐
│ Reservation  │ 9. Consume: PaymentFailed
│   Service    │ 10. Cancel booking ✓
└──────┬───────┘ 11. Publish: BookingCancelled
       │
       ▼
┌──────────────┐
│  Inventory   │ 12. Consume: BookingCancelled
│   Service    │ 13. Release room ✓
└──────────────┘
```

**Characteristics:**
- ✅ No coordinator = No single point of failure
- ✅ Non-blocking = High performance
- ❌ Complex = Many events to manage
- ❌ Eventually consistent = Temporary inconsistencies visible

---

### Saga Pattern - Orchestration
```
Centralized Workflow
=====================================

     ┌─────────────────────┐
     │ Saga Orchestrator   │
     │  (Workflow Engine)  │
     └──────────┬──────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌─────────┐ ┌────────┐
│Inventory│ │Reservation│Payment│
└────────┘ └─────────┘ └────────┘

Flow:
=====
1. Orchestrator → Inventory: Reserve
   ← Success ✓
   
2. Orchestrator → Reservation: Create
   ← Success ✓
   
3. Orchestrator → Payment: Charge
   ← Failed ❌
   
4. Orchestrator → Reservation: Cancel (compensate)
   ← Success ✓
   
5. Orchestrator → Inventory: Release (compensate)
   ← Success ✓
```

**Characteristics:**
- ✅ Centralized control = Easier to reason about
- ✅ Clear compensation logic
- ❌ Orchestrator becomes bottleneck
- ❌ Still eventually consistent

---

## 4. Decision Matrix

### When to Use Shared Database
```
✅ Use When:
┌─────────────────────────────────────┐
│ • Tightly coupled business logic    │
│ • Need ACID transactions            │
│ • Strong consistency required       │
│ • Small/Medium team                 │
│ • Services change together          │
│ • Same scaling requirements         │
└─────────────────────────────────────┘

Example: Hotel Inventory + Reservation
  → Always updated together
  → Overbooking is unacceptable
  → Consistency > Autonomy
```

### When to Use Separate Databases
```
✅ Use When:
┌─────────────────────────────────────┐
│ • Loosely coupled services          │
│ • Different data models needed      │
│ • Independent scaling required      │
│ • Different teams/deployment cycles │
│ • Can tolerate eventual consistency │
└─────────────────────────────────────┘

Example: User Service, Review Service
  → Independent lifecycles
  → Different access patterns
  → Autonomy > Consistency
```

### When to Use Hybrid
```
✅ Use When:
┌─────────────────────────────────────┐
│ You have BOTH:                      │
│ • Core domain (shared DB)           │
│ • Supporting services (separate DB) │
└─────────────────────────────────────┘

Hotel System Example:
  Shared DB:
  ├─ Inventory Service
  └─ Reservation Service
  
  Separate DBs:
  ├─ User Service (PostgreSQL)
  ├─ Review Service (MongoDB)
  ├─ Analytics Service (ClickHouse)
  └─ Notification Service (Redis)
```

---

## 5. Comparison Table

| Aspect | Shared DB | 2PC | Saga | Hybrid |
|--------|-----------|-----|------|--------|
| **Consistency** | Strong | Strong | Eventual | Mixed |
| **Performance** | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Complexity** | Low | Medium | High | Medium |
| **Autonomy** | None | None | High | Partial |
| **Failure Handling** | Automatic | Blocking | Manual Compensation | Mixed |
| **Scalability** | Limited | Poor | Excellent | Good |
| **Use Case** | Monoliths, Tight Coupling | Legacy Integration | Modern Microservices | Pragmatic Choice |

---

## 6. Key Takeaways

```
┌─────────────────────────────────────────────────────┐
│  "Don't blindly follow 'one DB per service' dogma"  │
│                                                      │
│  Choose based on:                                   │
│  1. Consistency requirements                        │
│  2. Team structure                                  │
│  3. Scaling needs                                   │
│  4. Complexity tolerance                            │
│                                                      │
│  Start simple → Scale when needed                   │
└─────────────────────────────────────────────────────┘
```

### The Alex Xu Principle
> "Addressing data inconsistency between microservices requires complicated mechanisms that greatly increase complexity. Decide if the added complexity is worth it."

**For Hotel Reservations:**
- Inventory + Reservation = **Shared Database** (pragmatic)
- User/Review/Analytics = **Separate Databases** (autonomous)

---

## 7. Common Pitfalls

### ❌ Anti-Pattern: Distributed Monolith
```
┌──────────┐    ┌──────────┐    ┌──────────┐
│Service A │◄──►│Service B │◄──►│Service C │
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     └───────────────┼───────────────┘
                     ▼
            ┌─────────────────┐
            │  Shared Schema  │
            │  (Tight Coupling)│
            └─────────────────┘

Problem: Microservice boundaries but monolithic database
  → Worst of both worlds
  → No autonomy, distributed complexity
```

### ✅ Better: Clear Boundaries
```
Core Domain (Shared):          Supporting (Separate):
┌──────────────────┐          ┌──────────┐
│ ┌────┐  ┌──────┐│          │ Service  │
│ │Svc1│  │Svc 2 ││          │    D     │
│ └─┬──┘  └──┬───┘│          └────┬─────┘
│   └────┬───┘    │               │
│        ▼        │               ▼
│    ┌──────┐    │          ┌─────────┐
│    │  DB  │    │          │   DB    │
│    └──────┘    │          └─────────┘
└──────────────────┘
```

---

## Quick Reference

**Need strong consistency?** → Shared Database  
**Need high throughput?** → Saga Pattern  
**Need simplicity?** → Start with Shared Database  
**Need autonomy?** → Separate Databases  
**Not sure?** → Use Hybrid Approach

**Remember:** Architecture is about trade-offs, not absolutes.