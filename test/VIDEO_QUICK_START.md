# Quick Start: Video Testing

## 📹 Generate Test Videos

### Minimal test video (no ffmpeg required)
```bash
cd /workspaces/videoking
node test/fixtures/create-minimal-video.js test/fixtures/test-video.mp4
```

### Full-quality test video (requires ffmpeg)
```bash
# Option 1: Install ffmpeg first
# macOS: brew install ffmpeg
# Ubuntu: apt-get install ffmpeg

# Then generate
node test/fixtures/generate-test-video.js test/fixtures/test-video-10s.mp4 10
```

---

## 🧪 Run Video Upload Tests

### Before testing, start the development server:
```bash
# Terminal 1: Start Worker API
cd apps/worker
pnpm dev

# Terminal 2: Start Web frontend
cd apps/web
pnpm dev
```

### Run tests:
```bash
# With test token
WORKER_URL=http://localhost:8787 \
TEST_AUTH_TOKEN="your-auth-token" \
node test/video-upload.test.js

# Or with environment file
source .env.test
node test/video-upload.test.js
```

---

## 🎯 Testing Scenarios

### Test 1: Basic Upload & Retrieval
```bash
# 1. Generate test video
node test/fixtures/create-minimal-video.js

# 2. Run upload test
TEST_AUTH_TOKEN="xxx" node test/video-upload.test.js
```

Expected output:
```
✅ Get upload URL
✅ Upload video file
✅ Video metadata is created
✅ List videos includes uploaded video
✅ Playback URL is generated
```

### Test 2: Authentication Tests
No setup needed—these tests verify that unauthenticated requests are rejected.

### Test 3: Database Verification
After upload test, verify:
```bash
psql $DATABASE_URL

SELECT id, title, status, creatorId 
FROM videos 
ORDER BY createdAt DESC 
LIMIT 1;
```

---

## 🛠️ Manual Testing with curl

### Get authenticated session
```bash
# Sign in (or use existing token)
COOKIE=$(curl -s -c /tmp/cookies.txt \
  -X POST http://localhost:8787/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}' \
  | jq -r '.sessionId')

AUTH_HEADER="Authorization: Bearer $COOKIE"
```

### Upload workflow
```bash
# Step 1: Get upload URL
curl -X POST http://localhost:8787/api/videos/upload-url \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"maxDurationSeconds": 600}' \
  > upload.json

UPLOAD_URL=$(jq -r '.uploadUrl' upload.json)
VIDEO_ID=$(jq -r '.videoId' upload.json)

# Step 2: Upload file
curl -X POST "$UPLOAD_URL" \
  -F "file=@test/fixtures/test-video.mp4"

# Step 3: Retrieve video metadata
curl http://localhost:8787/api/videos/$VIDEO_ID | jq '.

# Step 4: Get playback URL
curl http://localhost:8787/api/videos/$VIDEO_ID | jq '.playbackUrl'
```

---

## 📊 File Inventory

| File | Purpose | Size |
|------|---------|------|
| `test/fixtures/test-video.mp4` | Minimal MP4 for API testing | ~0.2 KB |
| `test/fixtures/create-minimal-video.js` | Generator (no deps) | - |
| `test/fixtures/generate-test-video.js` | Generator (requires ffmpeg) | - |
| `test/video-upload.test.js` | Automated test suite | - |
| `test/VIDEO_TEST_GUIDE.md` | Detailed guide | - |

---

## ✅ Verification Checklist

After running tests, verify:

- [ ] Test video file created successfully
- [ ] Upload endpoint returns valid URL and videoId
- [ ] Video uploaded to Cloudflare Stream
- [ ] Video metadata stored in database
- [ ] Playback URL is generated
- [ ] Video appears in list endpoint
- [ ] Authentication is enforced
- [ ] Video update (PATCH) works

---

## 🐛 Troubleshooting

### "TEST_AUTH_TOKEN not set"
You need a valid auth token. Run with:
```bash
# Get token from your deployed instance or local auth
TEST_AUTH_TOKEN="eyJ..." node test/video-upload.test.js
```

### "Upload failed: HTTP 401"
The auth token is invalid or expired. Get a fresh one.

### "Cloudflare Stream error"
Verify env vars in `apps/worker/.env.local`:
- `STREAM_API_TOKEN`
- `STREAM_ACCOUNT_ID`
- `STREAM_CUSTOMER_DOMAIN`

### "Test video file not found"
Generate it first:
```bash
node test/fixtures/create-minimal-video.js test/fixtures/test-video.mp4
```

---

## 📚 Related Docs

- [VIDEO_TEST_GUIDE.md](./VIDEO_TEST_GUIDE.md) — Comprehensive testing guide
- [API.md](../docs/API.md) — API endpoint documentation
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) — System architecture

---

## 🚀 Next Steps

1. **Generate test video**: `node test/fixtures/create-minimal-video.js`
2. **Start dev server**: `cd apps/worker && pnpm dev`
3. **Run tests**: `TEST_AUTH_TOKEN=xxx node test/video-upload.test.js`
4. **Verify in DB**: `psql $DATABASE_URL` and query videos table
5. **Integration tests**: Extend `test/video-upload.test.js` with Playwright

---

## Integration with CI/CD

Add to `.github/workflows/test.yml`:

```yaml
- name: Generate test video
  run: node test/fixtures/create-minimal-video.js

- name: Run video upload tests
  env:
    WORKER_URL: http://localhost:8787
    TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
  run: node test/video-upload.test.js
```
