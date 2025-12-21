# TCP & TLS Flow: Load Balancer to Application

## Overview: Two Separate Connections

```
User ──[HTTPS/Encrypted]──→ ALB ──[HTTP/Plain]──→ Container
       Connection 1              Connection 2
```

---

## Phase 1: TCP Handshake (Layer 4)

### User ↔ Load Balancer (Port 443)

```
User        →  SYN           →  ALB
User        ←  SYN-ACK       ←  ALB  
User        →  ACK           →  ALB
✅ TCP Connection Established
```

**Time:** ~20ms

---

## Phase 2: TLS Handshake (Layer 5-6)

### 1. Client Hello
```
Browser → ALB
├─ Supported TLS versions (1.2, 1.3)
├─ Cipher suites (AES-256-GCM, etc.)
└─ Random number (for key generation)
```

### 2. Server Hello + Certificate
```
ALB → Browser
├─ Selected TLS version (1.3)
├─ Selected cipher suite
├─ SSL Certificate for your-app.com
│   ├─ Domain: your-app.com
│   ├─ Public Key (2048-bit RSA or 256-bit ECC)
│   ├─ Issuer: Let's Encrypt / DigiCert
│   ├─ Valid From: 2024-01-01
│   └─ Valid Until: 2025-12-31
└─ Certificate Chain
    ├─ Root CA (trusted by browser)
    └─ Intermediate CA
```

### 3. Certificate Validation (Browser)

Browser checks **4 critical things**:

```
1. Domain Match
   Certificate says: your-app.com
   URL accessed:     your-app.com
   ✅ Match!

2. Expiry Date
   Current date:  2025-11-05
   Valid until:   2025-12-31
   ✅ Not expired!

3. Trusted Issuer
   Browser has built-in list of ~100 trusted CAs
   Certificate issued by: Let's Encrypt
   ✅ Found in trust store!

4. Certificate Chain
   Server Cert → Intermediate CA → Root CA
   ✅ Valid chain!
```

**If ANY check fails:** Browser shows warning ⚠️

### 4. Key Exchange & Session Key Generation

#### Step 4a: Random Values Exchange
```
Browser → ALB (in ClientHello):
└─ client_random: a7f3...8c2d (32 bytes)

ALB → Browser (in ServerHello):
└─ server_random: 2c8f...1a4e (32 bytes)
```

#### Step 4b: Pre-Master Secret
```
Browser generates:
└─ pre_master_secret: 9d2a...7f1c (48 bytes, random)

Browser encrypts it:
└─ Uses ALB's public key (from certificate)

Browser → ALB: [Encrypted pre_master_secret]

ALB decrypts it:
└─ Uses its private key
└─ Now has: pre_master_secret
```

**Important:** Browser does NOT send a public key. Only a random secret!

#### Step 4c: Both Compute Session Key
```
Browser computes:                ALB computes:
┌─────────────────┐             ┌─────────────────┐
│ pre_master      │             │ pre_master      │
│ client_random   │  ──→ PRF    │ client_random   │
│ server_random   │             │ server_random   │
└─────────────────┘             └─────────────────┘
        ↓                               ↓
   session_key                     session_key
   (256-bit AES)                   (256-bit AES)
        └───────────── SAME ──────────┘
```

**Why this works:**
- Only ALB can decrypt pre_master_secret (has private key)
- Man-in-the-middle can't compute session_key (missing pre_master)
- Both randoms prevent replay attacks
- This is **asymmetric encryption** for key exchange only

### 5. Finished (Encrypted Communication)

```
Browser → ALB: "Finished" (encrypted with session_key)
ALB → Browser: "Finished" (encrypted with session_key)

✅ TLS Tunnel Established
```

**From now on:**
- All data encrypted with **symmetric session_key**
- No more asymmetric crypto (too slow for bulk data)
- Browser and ALB both use the SAME key to encrypt/decrypt

**Why Session Key is Crucial:**

1. **Speed:** Symmetric (AES-256) is 100x faster than asymmetric (RSA)
2. **Both sides encrypt/decrypt:** Same key works both ways
3. **Large data:** Can encrypt gigabytes (RSA limited to ~245 bytes)
4. **Security:** 256-bit AES is computationally unbreakable

```
Without session key (using only RSA):
Browser → ALB: [RSA encrypt] = 50ms per message ❌
ALB → Browser: [RSA encrypt] = 50ms per message ❌
Total: 100ms overhead PER REQUEST!

With session key (using AES):
Browser → ALB: [AES encrypt] = 0.5ms per message ✅
ALB → Browser: [AES encrypt] = 0.5ms per message ✅
Total: 1ms overhead - 100x faster!
```

**Time:** ~40-60ms

---

## Phase 3: HTTP Request (Layer 7)

### User → ALB (Encrypted)

```
[Encrypted with TLS session key]:
GET /notification/health/check HTTP/1.1
Host: your-app.com
User-Agent: Mozilla/5.0
```

### ALB Processing

```
1. Decrypt TLS 🔓
2. Read HTTP request
3. Check target group health
4. Select healthy target: EC2-A:32768
```

### ALB → EC2 (New TCP Handshake)

```
ALB         →  SYN           →  EC2:32768
ALB         ←  SYN-ACK       ←  EC2:32768
ALB         →  ACK           →  EC2:32768
✅ Second TCP Connection
```

### ALB → Container (Plain HTTP)

```
[NO ENCRYPTION - Plain text]:
GET /notification/health/check HTTP/1.1
Host: your-app.com
X-Forwarded-For: 203.192.1.50        ← Real user IP
X-Forwarded-Proto: https             ← Original protocol
X-Forwarded-Port: 443                ← Original port
```

**Time:** ~10-20ms

---

## Complete Timeline

```
0ms     DNS Resolution
20ms    TCP Handshake (User ↔ ALB)
40ms    TLS Handshake starts
100ms   TLS Tunnel established ✅
105ms   Encrypted HTTP request → ALB
110ms   ALB decrypts, new TCP to EC2
120ms   Plain HTTP → Container:8080
125ms   Application processes
130ms   Response (plain) → ALB
135ms   ALB encrypts response
140ms   Encrypted response → User
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ~140ms
```

---

## Security Architecture

```
┌─────────────────────────────┐
│   PUBLIC INTERNET           │  🔒 HTTPS (TLS 1.3)
│   (Untrusted Network)       │     Encrypted
└─────────────────────────────┘
            ↓
    ┌───────────────┐
    │ Load Balancer │  🛡️ TLS Termination Point
    │  (Port 443)   │     - Validates certificates
    └───────────────┘     - Decrypts traffic
            ↓              - Encrypts responses
┌─────────────────────────────┐
│   PRIVATE VPC               │  🔓 HTTP (Plain)
│   (Trusted Network)         │     No encryption needed
│   └─ Security Groups        │     (Already isolated)
│   └─ Private IPs only       │
└─────────────────────────────┘
```

---

## Key Concepts

### TLS Termination
- ALB handles **all** TLS complexity
- Application receives **plain HTTP**
- Simplifies backend code

### Why Plain HTTP in VPC is Safe
1. **Network Isolation** - VPC is not accessible from internet
2. **Security Groups** - Only ALB can reach EC2:32768
3. **Private IPs** - 10.0.x.x range not routable publicly
4. **AWS Infrastructure** - Physical security

### Headers Your App Sees
```javascript
// Your application code
const realUserIP = req.headers['x-forwarded-for'];
const wasHTTPS = req.headers['x-forwarded-proto'] === 'https';

// Even though you receive HTTP, you know original was HTTPS
```

---

## Certificate Location

```
Load Balancer (fl-production-alb)
└── Listener: Port 443
    └── SSL Certificate
        ├── Domain: *.your-app.com
        ├── Issued by: AWS Certificate Manager
        ├── Auto-renewal: Enabled
        └── Security Policy: TLS 1.2+
```

**Your application:** No certificate needed! 🎉

---

## Encryption Details

### Two Types of Encryption Used

#### 1. Asymmetric (During Handshake Only)
```
Purpose: Securely exchange the pre-master secret

RSA Example:
├─ ALB has: Private key (secret) + Public key (in certificate)
├─ Browser encrypts pre_master with ALB's public key
├─ Only ALB can decrypt with private key
└─ Used ONCE per connection

Why not use for everything?
❌ Very slow (10-100x slower than symmetric)
❌ Can only encrypt small data (max ~245 bytes for 2048-bit RSA)
❌ Would need browser to send public key too (complexity)
```

#### 2. Symmetric (After Handshake)
```
Purpose: Encrypt all HTTP traffic

AES-256 Example:
├─ Both have same session_key (derived from pre_master)
├─ Same key encrypts AND decrypts
├─ Used for EVERY message after handshake
└─ Fast and secure

Browser encrypts request:
  plaintext + session_key → ciphertext → ALB

ALB decrypts request:
  ciphertext + session_key → plaintext

ALB encrypts response:
  plaintext + session_key → ciphertext → Browser

Browser decrypts response:
  ciphertext + session_key → plaintext
```

### What is AES Encryption?

**AES = Advanced Encryption Standard**

```
Government-approved encryption standard (since 2001)
├─ Used by: Banks, Military, Governments, HTTPS
├─ Block cipher: Encrypts data in 128-bit blocks
├─ Key sizes: 128-bit, 192-bit, or 256-bit
└─ Algorithm: Substitution-Permutation Network
```

**How AES Works (Simplified):**

```
Input: "Hello World" + session_key (256-bit)
       ↓
    ┌─────────────────┐
    │  AES Algorithm  │
    │  (14 rounds)    │
    ├─────────────────┤
    │ 1. SubBytes     │ → Substitute bytes using S-box
    │ 2. ShiftRows    │ → Shift rows cyclically
    │ 3. MixColumns   │ → Mix column data
    │ 4. AddRoundKey  │ → XOR with round key
    │    (repeat 14x) │
    └─────────────────┘
       ↓
Output: "8a3f7c2e9d..." (ciphertext - looks random)
```

**Real Example:**
```
Plaintext:  "GET /api/users"
Session Key: d7a2...8f3c (256-bit)
           ↓ AES-256 Encrypt
Ciphertext: 8a3f7c2e9d1b4a5f... (unreadable gibberish)
           ↓ Send over network
           ↓ AES-256 Decrypt (with same key)
Plaintext:  "GET /api/users" (recovered!)
```

### How is AES Secure with Same Key on Both Sides?

#### The Key Question:
```
🤔 If attacker intercepts the encrypted message + knows the algorithm...
   Can they decrypt it without the key?
```

**Answer: NO! Here's why:**

#### 1. **Brute Force is Impossible**

```
AES-256 Key Space:
├─ 2^256 possible keys
├─ = 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,936 keys
└─ If you tried 1 trillion keys per second:
   Time needed: 3.67 × 10^51 years
   (Universe age: 1.38 × 10^10 years)

Even with every computer on Earth:
└─ Still takes billions of years ❌
```

#### 2. **No Mathematical Shortcuts**

```
Unlike RSA (factoring large primes):
├─ No known mathematical weakness
├─ No pattern in encrypted output
└─ Each bit change in key → 50% output change (avalanche effect)

Example:
Key 1: d7a2...8f3c → Cipher: 8a3f7c2e...
Key 2: d7a2...8f3d (1 bit different!)
       ↓
       → Cipher: 91c4e8af... (completely different!)
```

#### 3. **Perfect Forward Secrecy**

```
Each TLS session = New random session_key
├─ Session 1: key_abc123 → used for 5 minutes → discarded
├─ Session 2: key_xyz789 → used for 3 minutes → discarded
└─ Session 3: key_def456 → used for 7 minutes → discarded

Even if attacker records ALL traffic:
└─ Cannot decrypt old sessions (keys are destroyed)
```

#### 4. **The Attacker's Problem**

```
What Attacker Has:
├─ Encrypted message: 8a3f7c2e9d1b4a5f...
├─ Knowledge of algorithm: AES-256-GCM
└─ Knowledge that Browser & ALB have same key

What Attacker Needs:
└─ The actual session_key

How to get session_key?
❌ Intercept handshake → pre_master is RSA encrypted
❌ Brute force → takes billions of years
❌ Decrypt old messages → session keys already deleted
❌ Break AES → no known vulnerability after 20+ years

Result: Attacker is stuck! 🔒
```

#### 5. **Why Attacker Can't Get Session Key**

```
Session Key Derivation:
session_key = PRF(pre_master_secret, client_random, server_random)

Attacker can see:
├─ ✅ client_random (sent in plaintext)
├─ ✅ server_random (sent in plaintext)
└─ ❌ pre_master_secret (encrypted with ALB's public key)

Without pre_master_secret:
└─ Cannot compute session_key
└─ Cannot decrypt any messages
```

**The chain of security:**
```
1. pre_master_secret encrypted with RSA (2048-bit or higher)
   └─ Breaking RSA-2048 = also billions of years

2. session_key derived using cryptographic hash (SHA-256)
   └─ One-way function, cannot reverse

3. AES-256 encryption for all messages
   └─ No known attacks on AES-256

All three layers must be broken simultaneously → Practically impossible
```

### Why This Hybrid Approach?

```
┌────────────────────────────────────────────┐
│ Asymmetric (RSA/ECDHE)                     │
├────────────────────────────────────────────┤
│ ✅ Secure key exchange (no pre-shared key) │
│ ✅ Each side proves identity               │
│ ❌ Slow for bulk data                      │
│ ❌ Limited data size                       │
└────────────────────────────────────────────┘
              Used for: Handshake only
                        
┌────────────────────────────────────────────┐
│ Symmetric (AES-256)                        │
├────────────────────────────────────────────┤
│ ✅ Very fast (hardware accelerated)        │
│ ✅ Can encrypt gigabytes                   │
│ ✅ Same security level as asymmetric       │
│ ✅ Secure even with same key both sides    │
│ ❌ Requires pre-shared key (solved by RSA!)│
└────────────────────────────────────────────┘
              Used for: All HTTP traffic
```

**TLS combines the best of both worlds!**

### Real-World Security

```
Your bank transaction:
├─ Uses same AES principle
├─ Trusted by governments & military
├─ Never been broken in 20+ years
└─ NSA approved for TOP SECRET data

If AES-256 was breakable:
└─ Every HTTPS site would be vulnerable
└─ All online banking would collapse
└─ Governments wouldn't use it for classified data
```

---

## Mental Model

Think of ALB as a **Security Checkpoint**:

```
Airport Security:
Passenger → Security Gate → Domestic Terminal → Airplane
            (shows passport)  (already secure)

Web Traffic:
User → ALB → VPC → Application
       (shows certificate) (already secure)
```

Once past security, no need for constant re-checking inside the secure zone.