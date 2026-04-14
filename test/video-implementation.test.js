#!/usr/bin/env node

/**
 * Video Implementation Verification Test
 * Verifies that all video functions are properly implemented in the codebase
 */

const fs = require("fs");
const path = require("path");

const log = {
  pass: (msg) => console.log(`✅ ${msg}`),
  fail: (msg) => console.log(`❌ ${msg}`),
  test: (msg) => console.log(`⏳ ${msg}`),
};

let passed = 0;
let failed = 0;

function checkFileContains(filePath, patterns, description) {
  if (!fs.existsSync(filePath)) {
    log.fail(`${description}: File not found: ${filePath}`);
    failed++;
    return false;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const missing = [];

  for (const pattern of patterns) {
    if (typeof pattern === "string") {
      if (!content.includes(pattern)) {
        missing.push(pattern);
      }
    } else if (pattern instanceof RegExp) {
      if (!pattern.test(content)) {
        missing.push(pattern.toString());
      }
    }
  }

  if (missing.length === 0) {
    log.pass(description);
    passed++;
    return true;
  } else {
    log.fail(`${description}: Missing patterns: ${missing.join(", ")}`);
    failed++;
    return false;
  }
}

console.log("\n════════════════════════════════════════════════════════════");
console.log("📺 Video Implementation Verification");
console.log("════════════════════════════════════════════════════════════\n");

// Test 1: Videos router exists with all endpoints
console.log("🔍 Checking Videos Router Implementation...\n");

checkFileContains(
  "apps/worker/src/routes/videos.ts",
  [
    "const videosRouter = new Hono",
    'videosRouter.get("/"',
    'videosRouter.get("/:id"',
    'videosRouter.post("/upload-url"',
    'videosRouter.patch("/:id"',
    'videosRouter.delete("/:id"',
    'export { videosRouter as videoRoutes }',
  ],
  "Videos router with all endpoints"
);

// Test 2: Router is mounted in main index
checkFileContains(
  "apps/worker/src/index.ts",
  ['import { videoRoutes } from "./routes/videos"', 'app.route("/api/videos", videoRoutes)'],
  "Videos route mounted in main app"
);

// Test 3: Upload URL endpoint returns correct schema
checkFileContains(
  "apps/worker/src/routes/videos.ts",
  [
    "POST /api/videos/upload-url",
    "getDirectUploadUrl",
    "uploadUrl",
    "streamVideoId",
    "videoId",
  ],
  "Upload URL endpoint with Cloudflare Stream integration"
);

// Test 4: Video metadata endpoints
checkFileContains(
  "apps/worker/src/routes/videos.ts",
  [
    "videos.id",
    "videos.creatorId",
    "videos.cloudflareStreamId",
    "videos.title",
    "videos.status",
    "videos.visibility",
    "videos.viewsCount",
    "videos.likesCount",
  ],
  "Video metadata fields"
);

// Test 5: Authentication checks
checkFileContains(
  "apps/worker/src/routes/videos.ts",
  [
    "auth.api.getSession",
    "session.user",
    "session?.user",
    "401",
  ],
  "Authentication enforcement"
);

// Test 6: Database schema
checkFileContains(
  "packages/db/src/schema/videos.ts",
  [
    "export const videos",
    "id",
    "creatorId",
    "cloudflareStreamId",
    "title",
    "status",
    "visibility",
  ],
  "Database videos table schema"
);

// Test 7: Types definitions
checkFileContains(
  "packages/types/src/index.ts",
  [
    "video",
    "Video",
    "playbackUrl",
    "streamVideoId",
  ],
  "Video types definitions"
);

// Test 8: Stream integration
checkFileContains(
  "apps/worker/src/lib/stream.ts",
  [
    "getDirectUploadUrl",
    "getSignedStreamUrl",
    "STREAM_API_TOKEN",
    "STREAM_ACCOUNT_ID",
  ],
  "Cloudflare Stream API integration"
);

// Test 9: Frontend upload component
checkFileContains(
  "apps/web/src/components/UploadForm.tsx",
  [
    "upload-url",
    "FormData",
    "video",
  ],
  "Frontend upload form component"
);

// Test 10: Auth context in components
checkFileContains(
  "apps/web/src/components/",
  [],
  "Frontend components exist"
);

// Check if auth context exists
if (fs.existsSync("apps/web/src/components/EntitlementsContext.tsx")) {
  log.pass("Entitlements context for video access control");
  passed++;
} else {
  log.fail("Entitlements context for video access control: Not found");
  failed++;
}

// Test 11: Database migrations
if (fs.existsSync("packages/db/src/migrations/")) {
  const migrations = fs.readdirSync("packages/db/src/migrations/", { recursive: true }).length;
  if (migrations > 0) {
    log.pass(`Database migrations (${migrations} files)`);
    passed++;
  } else {
    log.fail("Database migrations: No migration files found");
    failed++;
  }
} else {
  log.fail("Database migrations: Directory not found");
  failed++;
}

// Test 12: Test fixtures
checkFileContains(
  "test/fixtures/test-video.mp4",
  [], // This is a binary file, just check existence
  "Test video fixture"
);

// Test 13: Test scripts exist
const testScripts = [
  "test/video-upload.test.js",
  "test/video-functions.test.js",
  "test/run-video-tests.js",
];

for (const script of testScripts) {
  if (fs.existsSync(script)) {
    log.pass(`Test script: ${script}`);
    passed++;
  } else {
    log.fail(`Test script: ${script}`);
    failed++;
  }
}

// Test 14: Documentation
const docs = [
  "test/VIDEO_QUICK_START.md",
  "test/VIDEO_TEST_GUIDE.md",
];

for (const doc of docs) {
  if (fs.existsSync(doc)) {
    log.pass(`Documentation: ${doc}`);
    passed++;
  } else {
    log.fail(`Documentation: ${doc}`);
    failed++;
  }
}

// Summary
console.log(`\n════════════════════════════════════════════════════════════`);
console.log(`📊 Verification Results\n`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}\n`);

if (failed === 0) {
  console.log(`✨ All implementations verified! Video functions are ready.\n`);
  process.exit(0);
} else {
  console.log(`⚠️  ${failed} verification(s) failed\n`);
  process.exit(1);
}
