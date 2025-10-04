# Keyset Pagination: Why OFFSET Kills Performance at Scale

## The Problem
**OFFSET pagination is a silent killer** at scale. Using `LIMIT 20 OFFSET 10000` forces the database to fetch 10,020 rows, discard 10,000, and return only 20.

## The Solution: Keyset Pagination
Replace OFFSET with WHERE conditions based on the last seen value:

```sql
-- Instead of OFFSET
WHERE user_id = 42 AND created_at < '2024-05-01 10:00:00'
ORDER BY created_at DESC LIMIT 20;
```

**Result:** Query time dropped from 2.6s → 180ms

## Handle Duplicate Timestamps
Add a tie-breaker column (like `id`) to prevent pagination glitches:

```sql
WHERE (created_at, id) < ('2024-05-01 10:00:00', 98765)
ORDER BY created_at DESC, id DESC
```

## Alternative Approaches

1. **Cursor-Based Pagination** - Wrap keyset values in a token (`"next_cursor": "2024-05-01T10:00:00Z_98765"`)
2. **Covering Index for OFFSET** - When you must use OFFSET (e.g., admin dashboards with page jumping), create a covering index
3. **Materialized Views** - For static reports/dashboards with repeated queries

## Key Takeaway
Performance optimization doesn't always require infrastructure changes. Smart SQL rewrites can deliver 10x improvements.