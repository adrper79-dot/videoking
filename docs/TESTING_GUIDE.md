# Testing Guide for NicheStream

## Running Tests

### Prerequisites
The development servers must be running:
```bash
# Terminal 1: Start the Worker API
cd apps/worker && pnpm dev
# → http://localhost:8787

# Terminal 2: Start the Web Frontend  
cd apps/web && pnpm dev
# → http://localhost:3000
```

### Test Commands

```bash
# Run all tests (requires API running on localhost:8787)
pnpm test

# Run with verbose output
pnpm test:verbose

# Run individual test suites
node test/phase2-api.test.ts
node test/phase2-components.test.ts
```

## Test Suites

### Phase 2 API Tests (`test/phase2-api.test.ts`)
Tests core API endpoints:
- Admin verification endpoints
- Event discovery endpoints
- Asset management endpoints
- Video filtering and querying
- Database schema validation

**Status:** 11 tests
**Expected:** All pass when API is running

**Running:**
```bash
# From project root (with API running on port 8787)
node test/phase2-api.test.ts
```

### Phase 2 Components Tests (`test/phase2-components.test.ts`)
Tests frontend component rendering and interactions.

**Status:** Multiple component tests
**Expected:** Runs against running web frontend

**Running:**
```bash
# From project root (with web app running on port 3000)
node test/phase2-components.test.ts
```

## Adding New Tests

Tests use vanilla Node.js fetch API for maximum portability. To add tests:

1. Create file in `test/` directory: `test/my-feature.test.ts`
2. Use the existing test format as template
3. Add test logic with try/catch blocks
4. Report results with test name, status, and duration

Example structure:
```typescript
/**
 * Test suite for [Feature]
 * Run with: node test/my-feature.test.ts
 */

const BASE_URL = process.env.API_URL || "http://localhost:8787";

async function runTests() {
  const results: TestResult[] = [];
  
  try {
    const response = await fetch(`${BASE_URL}/api/endpoint`);
    results.push({
      name: "Test description",
      passed: response.ok,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    results.push({
      name: "Test description",
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    });
  }
}
```

## CI/CD Integration

Tests can be run in CI/CD pipelines:

```bash
# In GitHub Actions or similar
# 1. Start services in background
pnpm dev &
sleep 5  # Wait for startup

# 2. Run tests
pnpm test

# 3. Check results
echo "Test exit code: $?"
```

## Coverage Reports

To generate coverage reports, install vitest or jest:

```bash
# Not currently installed - add if needed
pnpm add -D vitest @vitest/coverage-v8
```

## Troubleshooting

### Tests fail with "fetch failed"
- Ensure Worker API is running on `localhost:8787`
- Check that `pnpm dev` in `apps/worker` is active
- Verify no port conflicts

### Component tests fail
- Ensure Next.js dev server is running on `localhost:3000`
- Check `apps/web` is not erroring during startup

### Tests timeout
- Check system resources
- Verify database migrations have completed
- Look at server logs for errors

## Next Steps

- Add Vitest/Jest for snapshot testing
- Implement E2E tests with Playwright
- Add performance benchmarks
- Set up automated test reporting
