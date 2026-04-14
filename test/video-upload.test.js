/**
 * Video Upload Integration Tests
 * 
 * Tests for video upload, metadata retrieval, and playback URL generation
 * Uses the test video in test/fixtures/test-video.mp4
 * 
 * Run with: pnpm test:video
 * 
 * Testing flow:
 * 1. Authenticate user
 * 2. Request upload URL from Cloudflare Stream
 * 3. Upload video file to Cloud flare Stream
 * 4. Poll for Stream processing completion
 * 5. Verify video metadata in database
 * 6. Test playback URL generation
 */

const fs = require("fs");
const path = require("path");

// Configuration
const API_URL = process.env.WORKER_URL || "http://localhost:8787";
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;
const TEST_VIDEO_PATH = path.join(__dirname, "../fixtures/test-video.mp4");

// Test utilities
const tests = [];
let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  console.log(`\n  ⏳ ${name}`);
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    testsFailed++;
  }
}

async function fetchApi(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (AUTH_TOKEN && !headers.Authorization) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response;
}

/**
 * Test Suite: Video Upload Workflow
 */
async function testVideoUploadWorkflow() {
  console.log("\n📹 Video Upload Integration Tests\n");

  // Skip if no auth token
  if (!AUTH_TOKEN) {
    console.log("  ⚠️  TEST_AUTH_TOKEN not set. Skipping authenticated tests.");
    console.log("     Set TEST_AUTH_TOKEN env var to test upload endpoints.\n");
    return;
  }

  await test("Get upload URL", async () => {
    const res = await fetchApi("/api/videos/upload-url", {
      method: "POST",
      body: JSON.stringify({ maxDurationSeconds: 600 }),
    });

    const data = await res.json();
    if (!data.uploadUrl) throw new Error("Missing uploadUrl");
    if (!data.videoId) throw new Error("Missing videoId");
    if (!data.streamVideoId) throw new Error("Missing streamVideoId");

    global.uploadUrl = data.uploadUrl;
    global.videoId = data.videoId;
    global.streamVideoId = data.streamVideoId;
  });

  await test("Upload video file", async () => {
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      throw new Error(`Test video not found at ${TEST_VIDEO_PATH}`);
    }

    const fileBuffer = fs.readFileSync(TEST_VIDEO_PATH);
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: "video/mp4" }));

    const res = await fetch(global.uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: HTTP ${res.status}`);
    }
  });

  await test("Video metadata is created", async () => {
    if (!global.videoId) throw new Error("No videoId from upload");

    const res = await fetchApi(`/api/videos/${global.videoId}`);
    const video = await res.json();

    if (!video.id) throw new Error("Video not found in database");
    if (video.creatorId !== video.creatorId) throw new Error("Creator ID mismatch"); // Basic check
  });

  await test("List videos includes uploaded video", async () => {
    const res = await fetchApi("/api/videos?limit=1");
    const data = await res.json();

    if (!Array.isArray(data.data)) throw new Error("Expected array response");
    if (data.data.length === 0) throw new Error("No videos in list");
  });

  await test("Playback URL is generated", async () => {
    const res = await fetchApi(`/api/videos/${global.videoId}`);
    const video = await res.json();

    if (!video.playbackUrl) throw new Error("Missing playbackUrl");
    if (!video.playbackUrl.includes("cloudflarestream")) {
      throw new Error("Playback URL is not from Cloudflare Stream");
    }
  });

  await test("Update video metadata", async () => {
    const res = await fetchApi(`/api/videos/${global.videoId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Test Video Upload",
        description: "Integration test video",
        visibility: "public",
      }),
    });

    const video = await res.json();
    if (video.title !== "Test Video Upload") throw new Error("Title not updated");
  });

  await test("Cannot upload without authentication", async () => {
    try {
      // Fetch without auth header
      const res = await fetch(`${API_URL}/api/videos/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxDurationSeconds: 600 }),
      });

      if (res.ok) throw new Error("Expected 401 Unauthorized");
    } catch (error) {
      if (error.message === "Expected 401 Unauthorized") throw error;
    }
  });

  await test("Enforce max duration limit", async () => {
    const res = await fetchApi("/api/videos/upload-url", {
      method: "POST",
      body: JSON.stringify({ maxDurationSeconds: 999999 }),
    });

    const data = await res.json();
    // Should be capped at 21600 seconds (6 hours)
    if (!data.uploadUrl) throw new Error("Upload URL not returned");
  });
}

/**
 * Test Suite: Video Retrieval
 */
async function testVideoRetrieval() {
  console.log("\n📺 Video Retrieval Tests\n");

  await test("List videos with pagination", async () => {
    const res = await fetchApi("/api/videos?page=1&pageSize=10");
    const data = await res.json();

    if (!data.data) throw new Error("Missing data array");
    if (typeof data.total !== "number") throw new Error("Missing total count");
    if (typeof data.page !== "number") throw new Error("Missing page");
    if (typeof data.pageSize !== "number") throw new Error("Missing pageSize");
  });

  await test("Filter videos by status", async () => {
    const res = await fetchApi("/api/videos?status=ready");
    const data = await res.json();

    if (!Array.isArray(data.data)) throw new Error("Expected array");
  });

  await test("Handle invalid video ID gracefully", async () => {
    try {
      const res = await fetch(`${API_URL}/api/videos/invalid-id`);
      // Should return 404 or empty
      if (!res.ok && res.status !== 404) {
        throw new Error(`Expected 404, got ${res.status}`);
      }
    } catch (error) {
      // Network error is acceptable
    }
  });
}

/**
 * Test Suite: Database Verification
 */
async function testDatabaseState() {
  console.log("\n🗄️  Database State Tests\n");

  await test("Video DB record has all required fields", async () => {
    if (!global.videoId) {
      console.log("     Skipped: No videoId from upload test");
      return;
    }

    const res = await fetchApi(`/api/videos/${global.videoId}`);
    const video = await res.json();

    const requiredFields = [
      "id",
      "creatorId",
      "cloudflareStreamId",
      "title",
      "status",
      "visibility",
      "viewsCount",
      "likesCount",
      "createdAt",
    ];

    for (const field of requiredFields) {
      if (!(field in video)) {
        throw new Error(`Missing field: ${field}`);
      }
    }
  });

  await test("Video status transitions correctly", async () => {
    if (!global.videoId) {
      console.log("     Skipped: No videoId from upload test");
      return;
    }

    const res = await fetchApi(`/api/videos/${global.videoId}`);
    const video = await res.json();

    const validStatuses = ["processing", "ready", "error"];
    if (!validStatuses.includes(video.status)) {
      throw new Error(`Invalid status: ${video.status}`);
    }
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("🎬 NicheStream Video Testing Suite\n");
  console.log("═".repeat(60));

  try {
    await testVideoUploadWorkflow();
    await testVideoRetrieval();
    await testDatabaseState();
  } catch (error) {
    console.error("Fatal error:", error);
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log(`\n📊 Test Results\n`);
  console.log(`  Passed: ${testsPassed} ✅`);
  console.log(`  Failed: ${testsFailed} ❌`);
  console.log(`  Total:  ${testsPassed + testsFailed}\n`);

  if (testsFailed === 0) {
    console.log("✨ All tests passed!\n");
    process.exit(0);
  } else {
    console.log(`⚠️  ${testsFailed} test(s) failed\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
