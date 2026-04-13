/**
 * Phase 2 API Integration Tests (Node.js / Deno compatible)
 * 
 * Run with: node test/phase2-api.test.js
 * 
 * Tests verify Phase 2 API endpoints are functional.
 * This is a lightweight test suite for CI/CD validation.
 */

const BASE_URL = process.env.API_URL || "http://localhost:8787";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "test-admin-token";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Fetch helper with error handling
 */
async function fetchApi(
  path: string,
  options: RequestInit & { adminAuth?: boolean } = {}
): Promise<Response> {
  const { adminAuth, ...init } = options;
  const url = `${BASE_URL}${path}`;
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...init.headers,
  };

  if (adminAuth) {
    headers["Authorization"] = `Bearer ${ADMIN_TOKEN}`;
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });
}

/**
 * Test runner utility
 */
async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Test Suite: Creator Verification Endpoints
 */
async function testCreatorVerification() {
  console.log("\n📋 Creator Verification Tests\n");

  await test("POST /admin/verify-creator should accept valid request", async () => {
    const res = await fetchApi("/admin/verify-creator", {
      method: "POST",
      body: JSON.stringify({ userId: "test-user-id" }),
      adminAuth: true,
    });
    
    // Should return 200 or 404 (user not found) - both are valid
    if (res.status === 404) {
      return; // Expected: test user doesn't exist
    }
    
    if (!res.ok) {
      throw new Error(`Expected 2xx or 404, got ${res.status}`);
    }
  });

  await test("DELETE /admin/verify-creator/:userId should accept valid request", async () => {
    const res = await fetchApi("/admin/verify-creator/test-user-id", {
      method: "DELETE",
      adminAuth: true,
    });
    
    // Should return 200 or 404
    if (res.status === 404) {
      return;
    }
    
    if (!res.ok) {
      throw new Error(`Expected 2xx or 404, got ${res.status}`);
    }
  });
}

/**
 * Test Suite: Event Endpoints
 */
async function testEventEndpoints() {
  console.log("\n📅 Event Endpoints Tests\n");

  await test("GET /events should return events list", async () => {
    const res = await fetchApi("/events");
    
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
    
    const data = await res.json() as unknown;
    if (!Array.isArray(data)) {
      throw new Error("Expected array response");
    }
  });

  await test("GET /events/:slug should handle event requests", async () => {
    const res = await fetchApi("/events/test-slug");
    
    // 404 is OK - event might not exist
    if (res.status === 404) {
      return;
    }
    
    if (!res.ok) {
      throw new Error(`Expected 2xx or 404, got ${res.status}`);
    }
  });
}

/**
 * Test Suite: Asset Endpoints
 */
async function testAssetEndpoints() {
  console.log("\n📦 Asset Endpoints Tests\n");

  await test("GET /assets should accept requests", async () => {
    const res = await fetchApi("/assets");
    
    // Should succeed - returns empty array or asset list
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
    
    const data = await res.json() as unknown;
    if (!Array.isArray(data)) {
      throw new Error("Expected array response");
    }
  });

  await test("GET /assets?category=brushes should accept category filter", async () => {
    const res = await fetchApi("/assets?category=brushes");
    
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
  });
}

/**
 * Test Suite: Video Endpoints
 */
async function testVideoEndpoints() {
  console.log("\n🎥 Video Endpoints Tests\n");

  await test("GET /videos should support style filter", async () => {
    const res = await fetchApi("/videos?style=digital");
    
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
    
    const data = await res.json() as unknown;
    if (!Array.isArray(data) && typeof data !== "object") {
      throw new Error("Expected object or array response");
    }
  });

  await test("GET /videos should support genre filter", async () => {
    const res = await fetchApi("/videos?genre=animation");
    
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
  });

  await test("GET /videos should support tool filter", async () => {
    const res = await fetchApi("/videos?tool=procreate");
    
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
  });

  await test("GET /videos should support combined filters", async () => {
    const res = await fetchApi("/videos?style=digital&genre=animation&tool=procreate");
    
    if (!res.ok) {
      throw new Error(`Expected 2xx, got ${res.status}`);
    }
  });
}

/**
 * Test Suite: Database Schema Validation
 */
async function testDatabaseSchema() {
  console.log("\n🗄️  Database Schema Tests\n");

  await test("Video metadata fields should be queryable", async () => {
    // This test verifies the API can handle the new metadata fields
    const res = await fetchApi("/videos?limit=1&style=digital");
    
    if (!res.ok) {
      throw new Error("Video metadata filtering not working");
    }
  });

  // Note: More comprehensive schema tests would require DB access
}

/**
 * Report Generation
 */
function generateReport(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const duration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal:    ${total} tests`);
  console.log(`Passed:   ${passed} tests ✓`);
  console.log(`Failed:   ${failed} tests ✗`);
  console.log(`Duration: ${duration}ms`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log("\n✓ All tests passed!");
  process.exit(0);
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log("🧪 Phase 2 API Integration Tests\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    await testCreatorVerification();
    await testEventEndpoints();
    await testAssetEndpoints();
    await testVideoEndpoints();
    await testDatabaseSchema();
  } catch (error) {
    console.error("Test suite error:", error);
    process.exit(1);
  }

  generateReport();
}

// Run tests
runAllTests().catch(console.error);
