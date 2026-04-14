# Security Policy for NicheStream

## Security Principles

We take security seriously. NicheStream implements defense-in-depth with multiple security layers:

1. **Authentication** — BetterAuth for session management
2. **Authorization** — Role-based access control
3. **Data Protection** — Encryption for secrets and sensitive data
4. **Input Validation** — Server-side validation of all requests
5. **CORS** — Explicit allowlist (no wildcard origins with credentials)

## Reporting Security Vulnerabilities

**Do not open public issues for security vulnerabilities.**

Instead, email security issues to: `security@nichestream.com`

Please include:
- Description of the vulnerability
- Affected components/versions
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

We'll respond within 24 hours and work on a fix. Credited fixes will be acknowledged in release notes.

## Security Architecture

### Authentication

**Method:** BetterAuth (email/password) with session-based auth

**Session Management:**
- Sessions stored in PostgreSQL `sessions` table
- Session token in secure HTTP-only cookie
- Automatic expiration after 30 days
- Invalidated on sign-out

**Password Requirements:**
- Minimum 8 characters
- Hashed with bcrypt
- No plaintext storage

```typescript
// apps/worker/src/lib/auth.ts
const password = {
  minLength: 8,
  // bcrypt hashing handled by BetterAuth
};
```

### Authorization

**Access Levels:**

1. **Authenticated User**
   - Can view public videos
   - Can upload and manage own videos
   - Can subscribe to tiers
   - Rate-limited: 100 requests/hour

2. **Creator**
   - Everything above +
   - Can see analytics for own videos
   - Can withdraw earnings
   - Rate-limited: 1000 requests/hour

3. **Admin**
   - Can moderate content
   - Can resolve reports
   - Can manage user accounts
   - Can view system metrics

**Examples:**

```typescript
// Middleware for admin routes
export async function requireAdmin(c: Context) {
  const session = await getSession(c);
  if (session?.user?.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  return undefined;
}

// Protected route
app.delete("/api/admin/reports/:id", requireAdmin, async (c) => {
  // ...
});
```

### CORS

**Explicit Allowlist:**
```
http://localhost:3000 (development)
https://nichestream.com (production)
https://www.nichestream.com (production)
```

**Implementation:**
```typescript
// apps/worker/src/index.ts
const CORS_ALLOWLIST = [
  process.env.APP_BASE_URL,
  "http://localhost:3000",
  "https://nichestream.com",
];

app.use(async (c, next) => {
  const origin = c.req.header("origin");
  if (CORS_ALLOWLIST.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    // credentials allowed only for allowlisted origins
    c.header("Access-Control-Allow-Credentials", "true");
  }
  await next();
});
```

**No wildcard + credentials:** ✅ Secure
**Wildcard + credentials:** ❌ XSS vulnerability

### Data Protection

#### Secrets Management
Never commit secrets. Use environment variables:

```bash
# Good ✅
export STRIPE_SECRET_KEY="sk_live_xxx"
pnpm deploy

# Bad ❌
// apps/worker/src/config.ts
const stripeKey = "sk_live_xxx";  // NEVER!
```

**Secrets Storage:**
- Production: Cloudflare Worker Secrets
- Development: `.dev.vars` (gitignored)
- CI/CD: GitHub Secrets

**Rotation:**
- Monthly for critical keys
- On security incident
- After staff changes

#### Database Security
- TLS encryption for Hyperdrive connections
- Row-level security for PostgreSQL (future)
- Parameterized queries with Drizzle ORM (prevents SQL injection)

#### Payment Data
**Never store:**
- Full credit card numbers
- CVV/CVC codes
- Bank account details

**Always:**
- Use Stripe Tokens (payment processing)
- Store only Stripe customer IDs
- Use Stripe's PCI-compliant checkout

```typescript
// Good: Using Stripe
const paymentIntent = await stripe.paymentIntents.create({
  amount: priceInCents,
  currency: "usd",
  customer: stripeCustomerId,
  confirm: true,
});

// Bad: Storing card directly
const payment = {
  cardNumber: "4111111111111111",  // NEVER STORE THIS
  cvv: "123",                      // NEVER STORE THIS
};
```

#### Video Uploads
Files uploaded to Cloudflare Stream (not stored directly):
- Stream handles CDN delivery
- DRM available for premium content (future)
- No raw access to video files

### Input Validation

**Every endpoint validates:**
- Data types (strings, numbers, UUIDs)
- Required fields
- Length limits
- Enum values

```typescript
// Example: Validating video creation
const validateVideoInput = (body: unknown) => {
  const schema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000),
    visibility: z.enum(["public", "unlisted", "private"]),
  });
  return schema.parse(body);
};

app.post("/api/videos", async (c) => {
  const body = await c.req.json();
  const validated = validateVideoInput(body);  // Throws if invalid
  // ...
});
```

### Rate Limiting

**Per User Tier:**

| Tier | API Requests | Chat Messages |
|------|--------------|---------------|
| Free | 100/hour | 1 per 10 seconds |
| Citizen | 1000/hour | 1 per second |
| VIP | 10000/hour | 1 per 0.5 seconds |

**Implementation:**
```typescript
// apps/worker/src/routes/chat.ts
const RATE_LIMITS = {
  free: { interval: 10000, maxMessages: 1 },
  citizen: { interval: 1000, maxMessages: 1 },
  vip: { interval: 500, maxMessages: 1 },
};

// Checks user's last message timestamp before allowing new message
```

### Error Handling

**Sensitive Errors:**
Never expose system details to users.

```typescript
// Bad: Exposes too much ❌
catch (error) {
  return c.json({
    error: `Database query failed: ${error.message}`,
    stack: error.stack,  // NEVER expose stack traces
  }, 500);
}

// Good: Generic user message ✅
catch (error) {
  logger.error("Database error", { error, userId: session.userId });
  return c.json({
    error: "An error occurred. Please try again.",
  }, 500);
}
```

### Logging

**What to Log:**
- Authentication attempts (success/failure)
- Authorization failures
- Payment transactions
- Admin actions
- Errors and exceptions

**Never Log:**
- Passwords
- API keys/secrets
- Credit card numbers
- Personal identification numbers

```typescript
// Good: Safe logging ✅
logger.info("User logged in", {
  userId: user.id,
  timestamp: new Date(),
  ip: c.req.header("x-forwarded-for"),
});

// Bad: Logs secrets ❌
logger.debug("Config loaded", { stripeSecretKey, databasePassword });
```

## Security Checklist

### Before Deployment

- [ ] All secrets in environment variables (not code)
- [ ] CORS allowlist configured correctly
- [ ] Input validation on all endpoints
- [ ] Rate limiting enabled
- [ ] Error messages don't expose internals
- [ ] Logging doesn't contain secrets
- [ ] Dependencies scanned for vulnerabilities
- [ ] Admin endpoints have requireAdmin middleware
- [ ] Payment data uses Stripe, not stored locally
- [ ] Database uses parameterized queries

### Dependencies

Keep dependencies updated:

```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update --latest
```

**Vulnerable packages:**
Report using `pnpm audit` or email security@nichestream.com

## Incident Response

If a security issue is discovered:

1. **Do not** publish details publicly
2. **Email** security@nichestream.com immediately
3. **We will** acknowledge within 24 hours
4. **Together** we'll develop and test a fix
5. **We will** deploy the fix and credit you in notes

## Security Updates

Security patches are released as-needed with CRITICAL priority.

Subscribe to updates:
- Watch GitHub repo releases
- Join security mailing list (email security@nichestream.com)

## Future Security Enhancements

Planned features:
- Two-factor authentication (2FA)
- Row-level security in PostgreSQL
- DRM for premium video content
- Audit logging for sensitive operations
- Bug bounty program

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Cloudflare Security Best Practices](https://developers.cloudflare.com/workers/platform/security/)
- [Stripe Security Documentation](https://stripe.com/docs/security)

## Contact

Security concerns: security@nichestream.com

Thank you for helping keep NicheStream secure! 🔒
