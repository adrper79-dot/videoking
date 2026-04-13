# Phase 2 E2E Test Guide

## Overview

This guide covers end-to-end testing for NicheStream Phase 2 (BlerdArt) features. Tests verify the complete flow from creator upload through discovery and verification.

## Test Coverage

### 1. Creator Verification Flow
**Scenario:** Admin verifies a creator, badge appears on profile
- **Setup:** Create test creator account
- **Steps:**
  1. Admin accesses `/dashboard/admin`
  2. Search for test creator
  3. Click "Verify" button
  4. Confirm success message
- **Verify:** Creator profile shows `blerdartVerified` badge
- **Cleanup:** Revoke verification

### 2. Video Metadata Tagging Flow
**Scenario:** Creator uploads video with BlerdArt metadata (style, tool, genre)
- **Setup:** Authenticated creator
- **Steps:**
  1. Navigate to `/dashboard/upload`
  2. Fill video form
  3. Select style: "digital"
  4. Select tool: "Procreate"
  5. Select genre: "animation"
  6. Add custom tags
  7. Upload video
- **Verify:** 
  - Video appears in feed with tags
  - Search filters find video by style/tool/genre
  - JSONB tags stored correctly
- **Cleanup:** Delete test video

### 3. Discovery Filters Flow
**Scenario:** Users discover videos using advanced filters
- **Setup:** Multiple test videos with different metadata
- **Steps:**
  1. Navigate to `/watch` (video feed)
  2. Click "Filters" (if visible)
  3. Select "Style: Digital"
  4. Select "Genre: Animation"
  5. Click search/apply
- **Verify:**
  - Only videos matching filters display
  - Filter UI updates correctly
  - URL reflects filter params (if implemented)
- **Cleanup:** Reset filters

### 4. Event Tagging & Virtual Artist Alley
**Scenario:** Creator tags video with BlerdCon event, appears in event feed
- **Setup:** Event exists (via SQL or admin endpoint)
- **Steps:**
  1. Creator uploads video tagged with `event_id`
  2. Navigate to `/events/blerdcon-2026`
  3. Verify video appears in event feed
- **Verify:**
  - Video shows event banner/context
  - Event detail page loads correctly
  - Related videos display
- **Cleanup:** Remove event tag

### 5. Admin Verification Panel
**Scenario:** Admin interfaces with creator management
- **Setup:** Admin account
- **Steps:**
  1. Login as admin
  2. Navigate to `/dashboard/admin`
  3. Verify panel loads
  4. Search for creators
  5. Toggle verification states
- **Verify:**
  - Only admins see admin panel
  - Creators list displays correctly
  - Toggle success/error messages appear
  - Stats update after verification change
- **Cleanup:** Reset verifications

### 6. Asset Library Management
**Scenario:** Creator manages BlerdArt production assets
- **Setup:** Creator with entitlements
- **Steps:**
  1. Navigate to `/dashboard/assets`
  2. Upload asset (image/brush/resource)
  3. Categorize asset
  4. View asset library
  5. Delete asset
- **Verify:**
  - Asset uploads to R2
  - Asset appears in library
  - Metadata stored correctly
  - Delete removes asset
- **Cleanup:** Clear test assets

## Manual Test Checklist

### Pre-Deployment Tests
- [ ] Creator verification badge visible on profiles
- [ ] Admin panel accessible only to admins
- [ ] Video upload form includes metadata fields
- [ ] Discovery filters functional on feed
- [ ] Event pages render correctly
- [ ] Asset upload/management works end-to-end
- [ ] All TypeScript strict mode checks pass
- [ ] No console errors in browser dev tools
- [ ] Mobile responsive on tested breakpoints

### Data Integrity Tests
- [ ] `videos.style`, `videos.tool`, `videos.genre` enums work
- [ ] JSONB tags serialize/deserialize correctly
- [ ] Creator verification persists across sessions
- [ ] Event video associations maintain referential integrity
- [ ] R2 asset paths correctly stored

### Permission Tests
- [ ] Non-admins cannot access `/dashboard/admin`
- [ ] Non-verified creators can still upload
- [ ] Verified status doesn't affect upload limits
- [ ] Only creator can delete own assets

## Automated Test Setup (Future)

To add automated E2E tests, install testing framework:

```bash
# Option 1: Playwright (recommended)
pnpm add -D -w @playwright/test

# Option 2: Cypress
pnpm add -D -w cypress
```

Example Playwright test structure:

```typescript
// apps/web/__tests__/creator-verification.e2e.ts
import { test, expect } from '@playwright/test';

test('Creator verification flow', async ({ page }) => {
  // Login as admin
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', 'admin@test.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Navigate to admin panel
  await page.goto('/dashboard/admin');
  await expect(page.locator('h2')).toContainText('Creator Management');
  
  // Verify a creator
  await page.fill('input[placeholder*="Search"]', 'testcreator');
  await page.click('button:has-text("Verify")');
  await expect(page.locator('text=verified successfully')).toBeVisible();
});
```

## Performance Test Checklist

- [ ] Discovery filter search completes <500ms for 1000+ videos
- [ ] Event page loads in <2s
- [ ] Admin panel search responsive with 10,000+ creators
- [ ] Asset upload progress visible for large files (>50MB)

## Browser Compatibility

Test on:
- [ ] Chrome 120+
- [ ] Firefox 120+
- [ ] Safari 17+
- [ ] Mobile Safari (iOS 15+)
- [ ] Chrome Mobile (Android 10+)

## Known Limitations

1. **E2E Framework Not Yet Installed**
   - Playwright/Cypress not in dependencies
   - Manual testing required for now
   - See "Automated Test Setup" section above for integration steps

2. **Admin Panel Pre-Population**
   - Currently loads empty creator list
   - In production, needs dedicated `/api/admin/creators` endpoint
   - See PHASE_2_ROADMAP.md for full scope

3. **Event Management**
   - Event creation requires direct SQL or admin endpoint
   - No UI form for creating events yet
   - Can seed via `packages/db/src/migrations/` or Neon console

## Test Data Setup

### SQL Seed for Testing

```sql
-- Create test event
INSERT INTO events (id, name, slug, start_date, end_date, description)
VALUES (
  'test-event-id',
  'BlerdCon 2026 Test',
  'blerdcon-2026-test',
  NOW(),
  NOW() + INTERVAL '30 days',
  'Test event for E2E testing'
);

-- Create test creator
INSERT INTO users (id, email, username, display_name, role, blerdart_verified)
VALUES (
  'test-creator-id',
  'testcreator@example.com',
  'testcreator',
  'Test Creator',
  'creator',
  false
);

-- Create test video with metadata
INSERT INTO videos (
  id, creator_id, title, description, status,
  style, tool, genre, tags, event_id
)
VALUES (
  'test-video-id',
  'test-creator-id',
  'Test Digital Art Animation',
  'A test video',
  'ready',
  'digital',
  'procreate',
  'animation',
  '["blerdart", "digital-art", "test"]'::jsonb,
  'test-event-id'
);
```

## Troubleshooting

### Admin panel shows "Access Denied"
- Verify user role is `admin` in database: `SELECT role FROM users WHERE id = '...';`
- Check session is properly established: `GET /api/auth/session`
- Clear browser cache/cookies

### Videos don't appear in event feed
- Verify event exists: `SELECT * FROM events WHERE slug = 'blerdcon-2026';`
- Verify video has correct `event_id`: `SELECT event_id FROM videos WHERE id = '...';`
- Check `status` is 'ready': `SELECT status FROM videos WHERE id = '...';`

### Discovery filters not working
- Verify metadata enum values are correct (style/tool/genre)
- Check filter params in query string: `?style=digital&genre=animation`
- Inspect network request to `/api/videos` endpoint

### Asset uploads fail
- Verify R2 bucket configured in Worker environment
- Check file size limits (typically 500MB for R2)
- Verify MIME type is allowed

## Continuous Integration

When CI/CD is configured, run tests:

```bash
# In .github/workflows/test.yml
- name: Run E2E tests
  run: |
    npm install -g @playwright/test
    playwright test
  
- name: Upload test results
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Next Steps

1. **Immediate:** Use manual checklist for pre-deployment verification
2. **Short-term:** Implement Playwright suite for CI/CD
3. **Medium-term:** Add performance benchmarks for critical flows
4. **Long-term:** Expand to mobile app E2E tests (if applicable)

