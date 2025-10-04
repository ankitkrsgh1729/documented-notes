# Copy-on-Write vs Merge-on-Read

## Why Should You Know This?

These concepts are **fundamental to how data systems handle updates**. Understanding them helps you:
- **Performance tune** databases (understand why VACUUM exists in PostgreSQL)
- **Design data lakes** (configure Iceberg, Hudi, Delta Lake tables)
- **Troubleshoot** slow queries and storage bloat
- **Make architecture decisions** for data pipelines

## Where You'll Encounter These Concepts

| System | Relevance | Details |
|--------|-----------|---------|
| **PostgreSQL** | High | Uses MVCC (MOR-like), requires VACUUM for compaction |
| **MongoDB** | Medium | WiredTiger engine uses COW for snapshots |
| **MySQL InnoDB** | Medium | MVCC with undo logs, cleaner cleanup than PostgreSQL |
| **Data Lakes** | **Very High** | Iceberg, Hudi, Delta Lake - you explicitly configure COW/MOR |
| **Traditional SQL** | Low | Hidden implementation detail, same SQL syntax |
| **File Systems** | High | ZFS, Btrfs use COW for snapshots and integrity |

**Key Point**: In traditional databases, this is hidden. In modern data lakes, **you choose and configure** the strategy!

## Core Concepts

**Copy-on-Write (COW)**: Rewrite entire data structure when modifications occur
**Merge-on-Read (MOR)**: Store changes separately, merge during read operations

## Trade-offs

| Aspect | Copy-on-Write (COW) | Merge-on-Read (MOR) |
|--------|---------------------|---------------------|
| **Write Performance** | Slower (rewrites data) | Faster (appends changes) |
| **Read Performance** | Faster (direct read) | Slower (merge required) |
| **Storage** | More efficient (no deltas) | Less efficient (base + deltas) |
| **Maintenance** | Minimal (auto cleanup) | Requires compaction |
| **Use Case** | Read-heavy workloads | Write-heavy workloads |

## How They Work

### Copy-on-Write
```
UPDATE row → Rewrite entire file with changes
Original: file1.parquet [A, B, C, D]
Update C → Create file2.parquet [A, B, C', D]
Cleanup → Delete file1.parquet
Result: Only file2.parquet exists (space efficient)
```

### Merge-on-Read
```
UPDATE row → Write delta/delete file
Original: file1.parquet [A, B, C, D]
Update C → Keep original + Delta: delta1.parquet [C']
Read → Merge file1 + delta1 = [A, B, C', D]
Problem: Files accumulate over time!

After many updates:
file1.parquet [A, B, C, D]
delta1.parquet [C']
delta2.parquet [B']
delta3.parquet [A']
→ Reads become slower, storage grows
→ Solution: Run COMPACTION
```

## Common Use Cases

### COW Examples
- Operating systems (memory pages, process forking)
- File systems (ZFS, Btrfs snapshots)
- Version control systems (Git)
- Data lakes with infrequent updates

### MOR Examples
- High-throughput streaming pipelines
- Real-time analytics with frequent updates
- Log-structured merge trees (LSM trees)
- Apache Hudi, Iceberg, Delta Lake

## When to Choose

**Choose COW when:**
- Reads >> Writes
- Query performance is critical
- Simpler architecture preferred
- Storage is not constrained

**Choose MOR when:**
- Writes >> Reads  
- Write latency is critical
- Frequent small updates
- Can tolerate complex reads

## Key Insight

Both are optimization strategies that **defer work** - COW defers copying until write, MOR defers merging until read. Pick based on your workload pattern.

## Compaction: The Hidden Cost of MOR

**What is Compaction?**
Compaction is the process of merging base files with accumulated delta/delete files to create new optimized base files.

**Why is it Needed?**
In MOR, delta files accumulate over time:
```
Time 0: base.parquet [A, B, C, D, E]
Time 1: + delta1.parquet [C']
Time 2: + delta2.parquet [B', E']  
Time 3: + delta3.parquet [A']
→ Reads must merge 4 files! Storage waste!
```

**What Compaction Does:**
```
Before Compaction:
  base.parquet [A, B, C, D, E]
  delta1.parquet [C']
  delta2.parquet [B', E']
  delta3.parquet [A']

Run Compaction →

After Compaction:
  new_base.parquet [A', B', C', D, E']
  (old files deleted)
```

**Compaction Trade-offs:**

| Aspect | Details |
|--------|---------|
| **When to Run** | Scheduled (hourly/daily) or threshold-based (e.g., 10 delta files) |
| **Cost** | CPU and I/O intensive, similar to COW write cost |
| **Benefit** | Faster reads, reduced storage, fewer small files |
| **Downside** | Adds operational complexity, requires scheduling |

**Key Point**: MOR trades immediate write cost for deferred compaction cost. You're not avoiding the rewrite - just postponing it!

**Comparison:**
- **COW**: Pays rewrite cost on every update (distributed cost)
- **MOR**: Pays rewrite cost during compaction (batched cost)

Choose MOR if you can tolerate: slower reads, periodic compaction jobs, and temporary storage bloat.