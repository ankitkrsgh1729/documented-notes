# Complete Guide: TCP/TLS + API Gateway Architecture

## The Full Picture: From User to Microservices

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 7: Application Layer (HTTPS Request)                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ TCP Connection #1 + TLS Handshake                               │
│ User ↔ Load Balancer                                            │
│ - TCP 3-way handshake (~20ms)                                   │
│ - TLS handshake with certificate validation (~60ms)             │
│ - Encrypted tunnel established (AES-256)                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ TLS TERMINATION POINT (Load Balancer)                           │
│ - Decrypts HTTPS → HTTP                                         │
│ - Extracts headers, body                                        │
│ - Adds X-Forwarded-* headers                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ TCP Connection #2 (Plain HTTP)                                  │
│ Load Balancer ↔ API Gateway                                     │
│ - New TCP handshake (~5ms - same VPC)                           │
│ - HTTP request (unencrypted)                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ API GATEWAY PROCESSING                                           │
│ 1. JWT Validation (cryptographic verification)                  │
│ 2. Rate Limiting (check Redis)                                  │
│ 3. Route Determination (which backend service?)                 │
│ 4. Request Transformation                                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
           ┌────────────────┼────────────────┐
           ↓                ↓                ↓
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ TCP Conn #3     │  │ TCP Conn #4     │  │ TCP Conn #5     │
│ Gateway ↔       │  │ Gateway ↔       │  │ Gateway ↔       │
│ URL Service     │  │ Analytics Svc   │  │ User Service    │
│ (HTTP, port     │  │ (HTTP, port     │  │ (HTTP, port     │
│  8081)          │  │  8082)          │  │  8083)          │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Complete Request Timeline

```
0ms     DNS: api.yourapp.com → 52.66.xxx.xxx
20ms    TCP Handshake #1 (User ↔ ALB)
40ms    TLS Handshake starts
80ms    TLS established, encrypted HTTP request sent
85ms    ALB decrypts, TCP Handshake #2 (ALB ↔ Gateway)
90ms    Gateway receives plain HTTP request
92ms    JWT validation (verify signature with public key)
94ms    Rate limit check (Redis lookup)
95ms    Route determination
96ms    Reuse pooled connection (Gateway ↔ Backend)
100ms   Backend receives request
145ms   Backend processes and responds
150ms   Gateway receives response
152ms   Gateway adds metrics/headers
155ms   ALB receives response
160ms   ALB encrypts response (TLS)
165ms   User receives encrypted response
167ms   Browser decrypts and displays
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ~167ms end-to-end
```

**Breakdown:**
- **TCP/TLS setup:** 80ms (48% of total time!)
- **Gateway processing:** 15ms (9%)
- **Backend processing:** 45ms (27%)
- **Network transfers:** 27ms (16%)

**Optimization opportunity:** Connection pooling saves ~10ms per request!

---

## Detailed Flow: Phase by Phase

### Phase 1: User → Load Balancer (HTTPS)

```
Time: 0-80ms | TCP + TLS Handshake
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: DNS Resolution
User resolves api.yourapp.com → 52.66.xxx.xxx (ALB IP)

Step 2: TCP Handshake (Connection #1)
User → ALB:  SYN
ALB → User:  SYN-ACK
User → ALB:  ACK
✅ TCP established

Step 3: TLS Handshake
User → ALB:  ClientHello + client_random
ALB → User:  ServerHello + server_random + Certificate
User:        Validates certificate (domain, expiry, CA)
User → ALB:  [Encrypted pre_master_secret with ALB public key]
Both:        Compute session_key = PRF(pre_master, randoms)
✅ TLS tunnel established (AES-256 encryption)

Step 4: Encrypted HTTP Request
User → ALB:  
[ENCRYPTED]: GET /api/v1/shorten HTTP/1.1
             Authorization: Bearer eyJhbGc...
```

### Phase 2: Load Balancer → API Gateway (HTTP)

```
Time: 80-85ms | TLS Termination + New TCP Connection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Load Balancer Processing:
1. Decrypts TLS (using session_key) 🔓
2. Reads plain HTTP request
3. Checks target group: API-GATEWAY-TG
4. Finds healthy instance: 10.0.1.50:3000

New TCP Handshake (Connection #2):
ALB → Gateway:  SYN (port 3000)
Gateway → ALB:  SYN-ACK
ALB → Gateway:  ACK
✅ TCP established (no TLS!)

Plain HTTP Request:
ALB → Gateway:
[PLAIN TEXT]:
GET /api/v1/shorten HTTP/1.1
Host: api.yourapp.com
Authorization: Bearer eyJhbGc...
X-Forwarded-For: 203.192.1.50
X-Forwarded-Proto: https
X-Forwarded-Port: 443
```

### Phase 3: API Gateway Processing

```
Time: 85-95ms | JWT Validation + Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API Gateway (Node.js/Express):

1. JWT Validation Middleware
   ├─ Extract token from Authorization header
   ├─ Decode JWT header to get 'kid'
   ├─ Fetch JWKS from auth server (cached)
   ├─ Get matching public key
   ├─ Verify signature: jwt.verify(token, publicKey)
   └─ Validate claims: exp, iss, aud
   ✅ Valid JWT

2. Rate Limiting Middleware
   ├─ Key: user_id from JWT
   ├─ Check Redis: INCR rate_limit:user_123
   ├─ Current count: 45/100 requests
   └─ TTL: 3600 seconds
   ✅ Within limit

3. Routing Middleware
   ├─ Route: /api/v1/shorten
   ├─ Target: url-shortener-service:8081
   └─ Method: POST
   
4. Connection Pool Check
   ├─ Existing connection to url-shortener:8081? 
   ├─ Yes! Reuse connection (saves TCP handshake)
   └─ Connection from pool: socket #7
```

### Phase 4: API Gateway → Backend Service

```
Time: 95-100ms | Backend Request (Reused Connection)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Connection Reuse (No new TCP handshake!):
Gateway → URL Service (existing socket):
[PLAIN TEXT]:
POST /shorten HTTP/1.1
Host: url-shortener:8081
Content-Type: application/json
X-User-Id: user_123 (extracted from JWT)
X-Request-Id: req_abc123 (tracing)

{
  "url": "https://example.com/very/long/url"
}
```

### Phase 5: Response Flow

```
Time: 100-150ms | Response Path
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend Service → API Gateway:
HTTP/1.1 200 OK
Content-Type: application/json
{
  "short_url": "https://short.ly/abc123"
}

API Gateway Processing:
├─ Response transformation (if needed)
├─ Add metrics (request duration: 55ms)
├─ Add headers (X-Request-Id, X-RateLimit-Remaining)
└─ Log to monitoring system

API Gateway → Load Balancer:
[PLAIN TEXT]:
HTTP/1.1 200 OK
X-Request-Id: req_abc123
X-RateLimit-Remaining: 55
{
  "short_url": "https://short.ly/abc123"
}

Load Balancer → User:
[ENCRYPTED with session_key] 🔒:
HTTP/1.1 200 OK
{
  "short_url": "https://short.ly/abc123"
}

User's Browser:
Decrypts response 🔓
Displays short URL to user
```

---

## TLS vs JWT: Similar Cryptography, Different Purpose

### TLS Key Exchange (Server Identity)

```
Purpose: Establish encrypted channel & verify server identity

Step 1: Browser needs to talk securely to ALB
├─ Problem: How to share encryption key over insecure internet?
└─ Solution: Use ALB's public key from certificate

Step 2: Browser encrypts pre_master_secret
├─ Browser generates: pre_master_secret (48 random bytes)
├─ Encrypts with: ALB's public key (from certificate)
└─ Sends to ALB: [Encrypted pre_master_secret]

Step 3: Only ALB can decrypt
├─ ALB has: Private key (never shared)
├─ Decrypts: pre_master_secret
└─ Now both have the same secret!

Step 4: Both derive session_key
├─ Browser: session_key = PRF(pre_master, client_random, server_random)
├─ ALB: session_key = PRF(pre_master, client_random, server_random)
└─ Same inputs = Same session_key ✅

Result: Symmetric encryption (AES-256) for all future messages
```

**Key Storage (TLS):**
```
ALB Certificate:
├─ Contains: Public key (safe to share)
├─ Issued by: Certificate Authority (Let's Encrypt, DigiCert)
└─ Stored: AWS Certificate Manager

ALB Private Key:
├─ Location: AWS Certificate Manager (encrypted)
├─ Never exposed outside ALB
└─ Used to decrypt pre_master_secret
```

---

### JWT Signature (User Identity)

```
Purpose: Prove user authentication & prevent token tampering

Step 1: User logs in
User → Auth Server: POST /login {email, password}

Step 2: Auth Server creates JWT
├─ Payload: {user_id: "123", exp: 1699999999}
├─ Signs with: Private key (RS256)
└─ JWT = header.payload.signature

Step 3: Auth Server signs JWT
├─ signature = RSA_SIGN(private_key, header + "." + payload)
├─ Only Auth Server has private key
└─ Returns JWT to user

Step 4: User sends JWT to API Gateway
User → Gateway: Authorization: Bearer eyJhbGc...

Step 5: Gateway verifies JWT
├─ Decodes header: {alg: "RS256", kid: "key-2024"}
├─ Fetches public key from JWKS endpoint (using kid)
├─ Verifies: RSA_VERIFY(public_key, header + payload, signature)
└─ Valid? ✅ User is authenticated!

Result: Stateless authentication (no server-side session storage)
```

**Key Storage (JWT):**
```
Auth Server Private Key:
├─ Location: AWS Secrets Manager / HashiCorp Vault
├─ Environment: JWT_PRIVATE_KEY
├─ Never exposed, never in Git
└─ Used to SIGN tokens

Auth Server Public Key (JWKS):
├─ Published at: https://auth.yourapp.com/.well-known/jwks.json
├─ Cached by Gateway (1 hour TTL)
├─ Safe to share publicly
└─ Used to VERIFY tokens

API Gateway:
├─ Fetches public key on demand
├─ No private key access
└─ Can only verify, cannot create tokens
```

---

### JWT Structure & Verification

```
JWT Format: header.payload.signature

Example JWT:
eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS0yMDI0In0.eyJ1c2VyX2lkIjoiMTIzIn0.dBjftJeZ...

Part 1: Header (base64 encoded, anyone can decode!)
{
  "alg": "RS256",
  "kid": "key-2024"
}

Part 2: Payload (base64 encoded, anyone can decode!)
{
  "user_id": "123",
  "email": "user@example.com",
  "exp": 1699999999
}

Part 3: Signature (RSA signed, cannot forge without private key!)
RSA_SIGN(private_key, base64(header) + "." + base64(payload))
```

**Gateway Verification Code:**
```javascript
async function verifyJWT(token) {
  // 1. Split JWT into parts
  const [header, payload, signature] = token.split('.');
  
  // 2. Decode header (no key needed - just base64!)
  const decodedHeader = JSON.parse(atob(header));
  const kid = decodedHeader.kid; // "key-2024"
  
  // 3. Fetch public key from JWKS endpoint
  const jwks = await fetch('https://auth.yourapp.com/.well-known/jwks.json');
  const publicKey = jwks.keys.find(k => k.kid === kid);
  
  // 4. Verify signature with public key
  const isValid = RSA_VERIFY(
    publicKey,
    header + "." + payload,
    signature
  );
  
  if (!isValid) throw new Error('Invalid signature');
  
  // 5. Decode and validate payload
  const decodedPayload = JSON.parse(atob(payload));
  if (decodedPayload.exp < Date.now()/1000) {
    throw new Error('Token expired');
  }
  
  return decodedPayload; // {user_id: "123", email: ...}
}
```

---

### Critical Differences: Signing vs Encryption vs Base64

```
Base64 Encoding (JWT header & payload):
├─ NOT security! Just encoding for URL-safe transmission
├─ Anyone can decode: atob("eyJhbGc...")
├─ Reversible without any key
└─ Used in JWT for readability

Example:
Original: {"user_id": "123"}
Base64:   eyJ1c2VyX2lkIjoiMTIzIn0
Decode:   {"user_id": "123"}  ← No key needed!

Signing (JWT signature):
├─ Creates tamper-proof signature
├─ Private key signs, public key verifies
├─ Payload is READABLE but PROTECTED
└─ Cannot forge signature without private key

Example:
Payload: {"user_id": "123"}
Signature: dBjftJeZ4CVP... ← Only Auth Server can create
If attacker changes payload → signature verification FAILS ❌

Encryption (TLS):
├─ Makes data UNREADABLE
├─ Encrypts entire HTTP request/response
├─ Requires session_key to decrypt
└─ Used for transit security

Example:
Plaintext:  GET /api/v1/shorten
Encrypted:  8a3f7c2e9d1b4a5f... ← Unreadable without key
Decrypted:  GET /api/v1/shorten  ← Only with session_key
```

---

### Security Scenarios: What If Stolen?

```
Scenario 1: Attacker intercepts JWT
├─ Can decode and read payload (just base64)
├─ Can use token until expiry (15 min typical)
├─ Cannot modify token (signature fails)
├─ Cannot create new tokens (no private key)
└─ Mitigation: HTTPS, short expiry, token revocation

Scenario 2: Attacker intercepts TLS Certificate
├─ Certificate only has PUBLIC key (already public!)
├─ Cannot decrypt past traffic (needs private key)
├─ Cannot impersonate server (needs private key)
└─ No security risk

Scenario 3: JWT stolen + Attacker modifies payload

Step 1: Original JWT (created by Auth Server)
header:  {"alg": "RS256", "kid": "key-2024"}
payload: {"user_id": "123", "role": "user"}

Auth Server creates signature:
signature = RSA_SIGN(private_key, header + "." + payload)
signature = RSA_SIGN(private_key, "eyJhbGc...eyJ1c2Vy...")
signature = "dBjftJeZ4CVP..."

Complete JWT sent to user:
eyJhbGc...eyJ1c2Vy...dBjftJeZ4CVP


Step 2: Attacker intercepts and modifies
Attacker decodes payload (just base64):
Original: {"user_id": "123", "role": "user"}
Modified: {"user_id": "123", "role": "admin"}  ← Changed!

Attacker re-encodes to base64:
Modified payload: "eyJ1c2VyX2lkIjoiMTIzIiwicm9sZSI6ImFkbWluIn0"

Attacker creates fake JWT:
header (unchanged) + modified_payload + old_signature
eyJhbGc...eyJ1c2VyX2lkIjoiMTIzIiwicm9sZSI6ImFkbWluIn0...dBjftJeZ4CVP


Step 3: API Gateway verification process

Gateway receives fake JWT and verifies:

1. Extract parts:
   header_part = "eyJhbGc..."
   payload_part = "eyJ1c2VyX2lkIjoiMTIzIiwicm9sZSI6ImFkbWluIn0" (modified!)
   signature_part = "dBjftJeZ4CVP..." (old, unchanged)

2. Fetch public key from JWKS (using kid from header)

3. Verify signature (THIS IS WHERE IT FAILS):
   
   Gateway tries to verify:
   RSA_VERIFY(
     public_key,
     header_part + "." + payload_part,  ← Modified data!
     signature_part                     ← Old signature!
   )
   
   What RSA_VERIFY does internally:
   a) Decrypt signature using public_key:
      decrypted = RSA_DECRYPT_WITH_PUBLIC_KEY(signature)
      decrypted = hash("eyJhbGc...eyJ1c2Vy...") ← Original data hash!
   
   b) Hash the current data:
      current_hash = hash(header + "." + modified_payload)
      current_hash = hash("eyJhbGc...eyJ1c2VyX2lkIjoiMTIzIiwicm9sZSI6ImFkbWluIn0")
   
   c) Compare:
      Original hash (from signature): 7a3f2c9e...  ← Based on "role": "user"
      Current hash (modified data):   9d1b4a5f...  ← Based on "role": "admin"
      
      7a3f2c9e... ≠ 9d1b4a5f...
      
   Result: ❌ HASHES DON'T MATCH → SIGNATURE INVALID!


Why attacker cannot fix this:

To create valid signature for modified payload, attacker would need:
new_signature = RSA_SIGN(private_key, header + "." + modified_payload)
                         ↑
                    Only Auth Server has this!

Without private key:
├─ Cannot create signature that matches modified data
├─ Old signature only matches original data
└─ Gateway rejects any mismatch

Result: Token rejected! Attack failed! 🛡️
```

---

## Key Insights: Where TCP/TLS Meets API Gateway

### 1. TLS Terminates BEFORE Gateway (Usually)

```
Most Common Setup:
User → ALB [TLS ends here] → Gateway → Services
       🔒                    🔓         🔓

Less Common (End-to-End TLS):
User → ALB [pass-through] → Gateway [TLS ends] → Services
       🔒                   🔒                    🔓
```

**Why terminate at Load Balancer?**
- Certificate management in one place
- Gateway doesn't need SSL certificate
- Faster gateway processing (no decryption)
- Easier to scale gateway instances

### 2. Multiple TCP Connections

```
One user request = Multiple TCP connections:

Connection #1: User ↔ Load Balancer (HTTPS)
Connection #2: Load Balancer ↔ API Gateway (HTTP)
Connection #3: API Gateway ↔ Backend Service (HTTP)

Each connection has:
├─ TCP handshake overhead (~5-20ms)
├─ Network latency
└─ Connection management overhead
```

**Solution: Connection Pooling**
```javascript
// Gateway maintains persistent connections
const agent = new Agent({
  keepAlive: true,
  maxSockets: 100
});

// Reuses TCP connections
// Saves ~5-10ms per request
```

### 3. Security Layers

```
Layer 1: TLS (Transport Security)
├─ Encrypts data in transit
├─ Validates server identity (certificate)
└─ Terminates at Load Balancer

Layer 2: JWT (Application Security)
├─ Authenticates user identity
├─ Validates at API Gateway
└─ Stateless (no session storage)

Layer 3: Network Security
├─ VPC isolation (private network)
├─ Security Groups (firewall rules)
└─ Only Load Balancer can reach Gateway
```

### 4. Why Plain HTTP Inside VPC is Safe

```
┌────────────────────────────────────┐
│ PUBLIC INTERNET (Untrusted)        │
│ - Encrypted (TLS required)         │
└────────────────────────────────────┘
              ↓ TLS
┌────────────────────────────────────┐
│ LOAD BALANCER (Security Boundary)  │
│ - TLS termination                  │
│ - Certificate validation           │
└────────────────────────────────────┘
              ↓ HTTP (Plain)
┌────────────────────────────────────┐
│ PRIVATE VPC (Trusted)              │
│ - Gateway → Services (HTTP)        │
│ - Isolated network                 │
│ - Security Groups enforce access   │
│ - Private IPs (10.x.x.x)           │
│ - Not routable from internet       │
└────────────────────────────────────┘
```

**Security Groups Example:**
```
API Gateway Security Group:
├─ Inbound: Port 3000 from Load Balancer SG only
├─ Outbound: Ports 8081-8083 to Backend SGs only
└─ Result: Only authorized traffic allowed

Hacker tries to connect:
├─ Source IP: 203.0.113.5
├─ Security Group checks: Not from Load Balancer SG
└─ Result: ❌ Connection refused
```

---

## AWS Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Route 53 (DNS)                                              │
│ api.yourapp.com → ALB DNS name                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Application Load Balancer                                    │
│ - Listener: HTTPS:443 (TLS termination)                     │
│ - Certificate: ACM certificate for *.yourapp.com            │
│ - Target Group: api-gateway-tg                              │
│ - Health Check: GET /health every 30s                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ECS Cluster: API Gateway Service                            │
│ - Tasks: 3 instances (auto-scaling 2-10)                    │
│ - Container: api-gateway:latest                             │
│ - Port: 3000 (mapped to dynamic host port)                  │
│ - Environment: REDIS_URL, JWT_PUBLIC_KEY_URL                │
└─────────────────────────────────────────────────────────────┘
                    ↓           ↓           ↓
         ┌──────────┴─────┬────┴────┬──────┴──────┐
         ↓                ↓         ↓              ↓
┌────────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────┐
│ URL Service    │  │ Analytics  │  │ User        │  │ Payment  │
│ ECS Service    │  │ Service    │  │ Service     │  │ Service  │
│ Port: 8081     │  │ Port: 8082 │  │ Port: 8083  │  │ Port: 8084│
└────────────────┘  └────────────┘  └─────────────┘  └──────────┘
         ↓                ↓              ↓                ↓
┌─────────────────────────────────────────────────────────────┐
│ RDS PostgreSQL (separate DB per service)                    │
└─────────────────────────────────────────────────────────────┘
         
┌─────────────────────────────────────────────────────────────┐
│ ElastiCache Redis (shared state: rate limits, sessions)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: Integration Points

| Concept | TCP/TLS | JWT | Integration |
|---------|---------|-----|-------------|
| **Purpose** | Transport security | Application security | TLS encrypts, JWT authenticates |
| **Encryption** | AES-256 symmetric | Not encrypted (signed) | TLS protects JWT in transit |
| **Keys** | Session key (temporary) | Public/Private (persistent) | Different key types |
| **Validation** | Certificate validates server | Signature validates user | Both use asymmetric crypto |
| **Storage** | Session key in memory | Private key in Secrets Manager | Different security models |
| **Performance** | Connection pooling | Stateless validation | Both optimize repeated operations |

**The Big Picture:**
```
TLS: "Is this the real server I'm talking to?" (Server identity)
JWT: "Is this user allowed to make this request?" (User identity)
API Gateway: Bridges both security layers!
```