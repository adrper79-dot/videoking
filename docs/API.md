# NicheStream API Documentation

**Base URL:** `https://api.nichestream.com` (production) or `http://localhost:8787` (development)

## Authentication

All protected endpoints require a valid session from BetterAuth.

### Session Cookie
Requests to protected endpoints must include the session cookie set by the auth server.

```bash
# Example: authenticated request
curl -b "session=<token>" https://api.nichestream.com/api/dashboard/earnings
```

## API Endpoints

### Videos

#### `GET /api/videos`
List videos with filtering and pagination.

**Query Parameters:**
- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 20) - Items per page
- `creatorId` (uuid) - Filter by creator
- `status` (string) - "published" | "draft" | "archived"
- `visibility` (string) - "public" | "unlisted" | "private"

**Response:**
```json
{
  "videos": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "creatorId": "uuid",
      "status": "published",
      "visibility": "public",
      "streamId": "string",
      "thumbnailUrl": "string",
      "unlockPriceCents": 500,
      "publishedAt": "2026-04-14T00:00:00Z",
      "createdAt": "2026-04-14T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

**Example:**
```bash
GET /api/videos?status=published&visibility=public&limit=10
```

---

#### `GET /api/videos/:id`
Get single video details.

**Response:**
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "creatorId": "uuid",
  "status": "published",
  "visibility": "public",
  "streamId": "string",
  "thumbnailUrl": "string",
  "unlockPriceCents": 500,
  "viewCount": 1000,
  "publishedAt": "2026-04-14T00:00:00Z"
}
```

---

#### `POST /api/videos/upload-url`
Get a direct upload URL for Cloudflare Stream. **Requires authentication.**

**Request:**
```json
{
  "title": "My Video",
  "description": "Video description"
}
```

**Response:**
```json
{
  "uploadUrl": "https://upload.cloudflarestream.com/...",
  "videoId": "uuid"
}
```

---

#### `PATCH /api/videos/:id`
Update video metadata. **Requires authentication + ownership.**

**Request:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "visibility": "public",
  "unlockPriceCents": 1000
}
```

---

#### `DELETE /api/videos/:id`
Soft-delete a video. **Requires authentication + ownership.**

**Response:** 204 No Content

---

### Channels

#### `GET /api/channels/:username`
Get creator channel profile and videos.

**Response:**
```json
{
  "creator": {
    "id": "uuid",
    "username": "string",
    "displayName": "string",
    "bio": "string",
    "avatarUrl": "string",
    "subscriberCount": 100
  },
  "videos": [
    {
      "id": "uuid",
      "title": "string",
      "thumbnailUrl": "string",
      "viewCount": 1000,
      "publishedAt": "2026-04-14T00:00:00Z"
    }
  ]
}
```

---

### Authentication

#### `POST /api/auth/sign-up`
Create a new account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  },
  "sessionToken": "string"
}
```

---

#### `POST /api/auth/sign-in`
Sign in with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "sessionToken": "string"
}
```

---

#### `POST /api/auth/sign-out`
Sign out the current session. **Requires authentication.**

**Response:** 204 No Content

---

### Subscriptions & Payments

#### `POST /api/stripe/subscriptions`
Create a subscription checkout session.

**Request:**
```json
{
  "tier": "citizen",
  "plan": "monthly"
}
```

**Supported Tiers/Plans:**
- `citizen` + `monthly`: $1/month
- `citizen` + `annual`: $10/year
- `vip` + `monthly`: $5-9/month (configurable)
- `vip` + `annual`: $50-90/year (configurable)

**Response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "string"
}
```

---

#### `POST /api/stripe/unlock`
Create a one-time payment for video unlock. **Requires authentication.**

**Request:**
```json
{
  "videoId": "uuid"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "string"
}
```

---

#### `POST /api/stripe/tip`
Send a tip to a creator. **Requires authentication.**

**Request:**
```json
{
  "creatorId": "uuid",
  "amountCents": 5000,
  "message": "Great content!"
}
```

**Response:**
```json
{
  "transactionId": "string",
  "status": "succeeded"
}
```

---

### Webhooks

#### `POST /api/webhooks/stripe`
Stripe webhook endpoint for payment events.

**Events Handled:**
- `payment_intent.succeeded` - Payment completed
- `customer.subscription.created` - Subscription started
- `customer.subscription.updated` - Subscription tier change
- `customer.subscription.deleted` - Subscription cancelled

**Security:** Webhook signature verification required (SHA256 HMAC)

---

### Dashboard (Requires Authentication)

#### `GET /api/dashboard/earnings`
Get creator earnings summary.

**Response:**
```json
{
  "totalEarnings": {
    "grossCents": 100000,
    "feeCents": 20000,
    "netCents": 80000
  },
  "earningsByType": {
    "subscription_share": 60000,
    "unlock_purchase": 30000,
    "tip": 10000,
    "ad_impression": 0
  },
  "recentEarnings": [
    {
      "type": "subscription_share",
      "amountCents": 100,
      "createdAt": "2026-04-14T00:00:00Z"
    }
  ]
}
```

---

#### `GET /api/dashboard/analytics`
Get video analytics (Cloudflare Stream metrics).

**Response:**
```json
{
  "videos": [
    {
      "videoId": "uuid",
      "title": "string",
      "viewCount": 1000,
      "uniqueViewers": 500,
      "averageViewDurationSeconds": 120,
      "engagementRate": 0.45
    }
  ]
}
```

---

### Real-Time (WebSocket)

#### `GET /api/ws/:videoId`
Upgrade to WebSocket for real-time video interaction.

**Messages:**

**Chat:**
```json
{
  "type": "chat",
  "message": "Hello everyone!",
  "userId": "uuid",
  "username": "string",
  "userTier": "citizen"
}
```

**Poll:**
```json
{
  "type": "poll",
  "question": "What's your favorite feature?",
  "options": ["Option 1", "Option 2"]
}
```

**Reaction:**
```json
{
  "type": "reaction",
  "emoji": "❤️",
  "userId": "uuid"
}
```

---

## Error Responses

All errors return JSON with status code and message.

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "details": "Missing required field: title"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required",
  "message": "Please sign in to access this resource"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

**404 Not Found:**
```json
{
  "error": "Not found",
  "message": "Video with ID xyz not found"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limited",
  "retryAfter": 60
}
```

**500 Internal Server Error:**
```json
{
  "error": "Server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

Rate limits apply per user tier:

| Tier | Chat Messages | Requests |
|------|---------------|----------|
| Free | 1 per 10s | 100/hour |
| Citizen | 1 per 1s | 1000/hour |
| VIP | 1 per 500ms | 10000/hour |

---

## Examples

### Create and Publish a Video

```bash
# 1. Get upload URL
curl -X POST http://localhost:8787/api/videos/upload-url \
  -H "Content-Type: application/json" \
  -b "session=<token>" \
  -d '{"title": "My Video", "description": "Video description"}'

# Response: { "uploadUrl": "...", "videoId": "..." }

# 2. Upload video to Cloudflare Stream (using uploadUrl from step 1)
curl -X POST "https://upload.cloudflarestream.com/..." \
  -F "file=@video.mp4"

# 3. Update video metadata
curl -X PATCH http://localhost:8787/api/videos/<videoId> \
  -H "Content-Type: application/json" \
  -b "session=<token>" \
  -d '{"visibility": "public", "unlockPriceCents": 500}'
```

### Subscribe to a Tier

```bash
# Create checkout session
curl -X POST http://localhost:8787/api/stripe/subscriptions \
  -H "Content-Type: application/json" \
  -b "session=<token>" \
  -d '{"tier": "citizen", "plan": "monthly"}'

# Response: { "url": "https://checkout.stripe.com/..." }
# Redirect user to URL to complete payment
```

---

## Changelog

### Phase 3 (April 2026)
- Added VIP tier endpoints
- Added ad impression tracking
- Added structured logging to all requests
- Added retry logic for transient failures

### Phase 2 (March 2026)
- Initial API release
- Video upload and management
- Subscription and payment handling
- Real-time chat and polls

---

## Support

For API issues or questions:
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Review [ENGINEERING.md](./ENGINEERING.md) for code conventions
- See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for API testing
- Open an issue on GitHub
