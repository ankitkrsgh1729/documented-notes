# RDBMS vs DynamoDB for URL Shortening Service

## URL Shortening Service Requirements

### **Core Operations**
- **Write**: Store short_url → long_url mapping
- **Read**: Retrieve long_url by short_url (HIGH frequency)
- **Analytics**: Track clicks, user stats (optional)
- **Scale**: Handle millions of URLs, billions of redirects

## RDBMS vs DynamoDB Comparison

### **RDBMS (MySQL/PostgreSQL)**

#### ✅ **Pros**
- **ACID transactions** for consistency
- **Complex queries** for analytics
- **Joins** for user management + URL data
- **Familiar SQL** for team
- **Strong consistency** by default

#### ❌ **Cons**
- **Scaling challenges** at massive scale
- **Sharding complexity** for horizontal scale
- **Higher latency** under extreme load
- **More operational overhead**

### **DynamoDB**

#### ✅ **Pros**
- **Massive scale** - handles millions of requests/second
- **Low latency** - single-digit millisecond response
- **No operational overhead** - fully managed
- **Auto-scaling** based on traffic
- **Global tables** for multi-region
- **Cost-effective** for read-heavy workloads

#### ❌ **Cons**
- **Limited query patterns** - no joins, limited filtering
- **Eventual consistency** (unless strongly consistent reads)
- **No complex analytics** without additional tools
- **Learning curve** for NoSQL concepts

## When to Choose DynamoDB

### **Perfect For URL Shortening When:**
- **Scale > 1M URLs/day**
- **Read-heavy workload** (10:1 or higher read:write ratio)
- **Simple access patterns** (lookup by short_url)
- **Global distribution** needed
- **Low operational overhead** preferred
- **Budget-conscious** (pay per usage)

### **Not Ideal When:**
- **Complex reporting** needed
- **Strong consistency** critical for all operations
- **Team lacks NoSQL experience**
- **Multi-table joins** required frequently

## DynamoDB Design for URL Shortening

### **Table Structure**

```json
{
  "TableName": "URLMappings",
  "PartitionKey": "short_code",
  "SortKey": None,  // Single-item per partition
  "Attributes": {
    "short_code": "abc123",      // Partition Key
    "long_url": "https://...",
    "created_at": "2024-01-15T10:30:00Z",
    "user_id": "user_456",       // For analytics
    "click_count": 0,
    "expires_at": "2025-01-15T10:30:00Z"
  }
}
```

### **Partition Key Selection**

#### **Why `short_code` as Partition Key?**
- **Even distribution** - Random short codes spread across partitions
- **Hot partition avoidance** - No single partition gets overloaded
- **Direct lookup** - Perfect for primary use case

#### **Alternative: Composite Key Design**

```json
{
  "PartitionKey": "short_code",
  "SortKey": "metadata",
  "Items": [
    {
      "short_code": "abc123",
      "sort_key": "url",
      "long_url": "https://example.com",
      "created_at": "2024-01-15"
    },
    {
      "short_code": "abc123", 
      "sort_key": "stats",
      "click_count": 150,
      "last_clicked": "2024-01-20"
    }
  ]
}
```

## Access Patterns & Implementation

### **1. Create Short URL**
```python
# Write to DynamoDB
dynamodb.put_item(
    TableName='URLMappings',
    Item={
        'short_code': 'abc123',
        'long_url': 'https://example.com/very/long/url',
        'created_at': '2024-01-15T10:30:00Z',
        'user_id': 'user_456',
        'click_count': 0
    }
)
```

### **2. Redirect (Most Critical)**
```python
# Read from DynamoDB
response = dynamodb.get_item(
    TableName='URLMappings',
    Key={'short_code': 'abc123'}
)
long_url = response['Item']['long_url']
# HTTP 301 redirect to long_url
```

### **3. Analytics (Update Click Count)**
```python
# Atomic counter update
dynamodb.update_item(
    TableName='URLMappings',
    Key={'short_code': 'abc123'},
    UpdateExpression='ADD click_count :inc',
    ExpressionAttributeValues={':inc': 1}
)
```

## Advanced DynamoDB Features

### **Global Secondary Index (GSI)**
For user-based queries:
```json
{
  "IndexName": "UserIndex",
  "PartitionKey": "user_id",
  "SortKey": "created_at",
  "Purpose": "Get all URLs by user"
}
```

### **TTL (Time To Live)**
```python
# Auto-delete expired URLs
'expires_at': int(time.time()) + (30 * 24 * 3600)  # 30 days
```

### **DynamoDB Streams**
For real-time analytics:
```python
# Stream changes to Lambda for analytics processing
```

## Hybrid Architecture

### **Best of Both Worlds**
```
Write Path: App → DynamoDB (fast writes)
Read Path: App → DynamoDB (fast reads)
Analytics: DynamoDB Streams → Lambda → Data Warehouse
```

## Performance Comparison

### **DynamoDB**
- **Latency**: 1-2ms average
- **Throughput**: Millions of requests/second
- **Scaling**: Automatic, instant

### **RDBMS**
- **Latency**: 5-50ms depending on load
- **Throughput**: Thousands to tens of thousands/second
- **Scaling**: Manual sharding, complex

## Cost Considerations

### **DynamoDB**
- **On-Demand**: $1.25 per million reads, $6.25 per million writes
- **Provisioned**: Lower cost for predictable traffic

### **RDBMS**
- **Fixed costs** regardless of usage
- **Higher operational overhead**

## DynamoDB Duplicate Key Handling

### **How DynamoDB Handles Duplicates**
- **Default behavior**: `put_item()` **OVERWRITES** existing items with same key
- **No error thrown** - silently replaces the item
- **Application must handle** duplicate prevention

### **Solutions for URL Shortening**
- **Conditional writes** - Only write if key doesn't exist
- **Read-before-write** - Check existence first (has race conditions)
- **Atomic counters** - Use incrementing IDs for guaranteed uniqueness
- **Retry logic** - Generate new short_code on collision

### **Best Practice**
- Use `ConditionExpression='attribute_not_exists(short_code)'`
- Implement retry mechanism with new short_codes
- Monitor collision rates and adjust short_code length accordingly

## Secondary Indexes in DynamoDB

### **Global Secondary Index (GSI)**
- **Purpose**: Query data using different partition key than main table
- **Example**: Query URLs by `user_id` instead of `short_code`
- **New partition key**: Can be any attribute from main table
- **Cost**: Additional storage + read/write capacity

### **Local Secondary Index (LSI)**  
- **Purpose**: Alternative sort key for same partition key
- **Example**: Same `short_code` but sort by `created_at` vs `click_count`
- **Limitation**: Must use same partition key as main table
- **Benefit**: Strong consistency available

### **"Secondary Partition Key" Concept**
- **No direct concept** - but GSI effectively provides this
- **GSI creates new partitioning** based on different attribute
- **Each GSI can have different partition + sort key combination**
- **Up to 20 GSIs per table**

## Recommendation

**Choose DynamoDB for URL shortening when:**
- Scale > 100K requests/second
- Read:Write ratio > 10:1  
- Simple access patterns
- Global distribution needed
- Minimal ops overhead preferred

**Choose RDBMS when:**
- Complex analytics required
- Strong consistency critical
- Team expertise in SQL
- Multi-table relationships needed