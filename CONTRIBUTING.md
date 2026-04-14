# Contributing to NicheStream

Thank you for your interest in contributing to NicheStream! This guide explains how to contribute code, report issues, and participate in development.

## Code of Conduct

Be respectful, inclusive, and constructive. We're building a community-driven platform.

## Getting Started

### 1. Clone and Setup

```bash
git clone https://github.com/adrper79-dot/videoking.git
cd videoking
pnpm install
```

### 2. Read the Documentation

- [README.md](../README.md) - Project overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [LOCAL_DEVELOPMENT_SETUP.md](./LOCAL_DEVELOPMENT_SETUP.md) - Dev environment
- [ENGINEERING.md](./ENGINEERING.md) - Code standards
- [API.md](./API.md) - API reference

### 3. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

## Development Workflow

### Starting Development Servers

```bash
# Terminal 1: Worker API
cd apps/worker && pnpm dev

# Terminal 2: Web Frontend
cd apps/web && pnpm dev

# Terminal 3: Database UI (optional)
cd packages/db && pnpm db:studio
```

### Making Changes

#### Follow Code Conventions

- **TypeScript:** Strict mode only. No `any` types without comments.
- **File Structure:** Keep related code together (routes, components, utilities)
- **Naming:** Use camelCase for variables/functions, PascalCase for components/classes
- **Comments:** Add JSDoc for public APIs and complex logic

#### Example: Adding a New Route

1. Create file in `apps/worker/src/routes/my-feature.ts`:
```typescript
import { Hono } from "hono";
import type { Env } from "../types";

const router = new Hono<{ Bindings: Env }>();

/**
 * GET /api/my-feature
 * Description of what this endpoint does
 */
router.get("/", async (c) => {
  try {
    // Your implementation
    return c.json({ data: "result" });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default router;
```

2. Register in `apps/worker/src/index.ts`:
```typescript
import myFeatureRouter from "./routes/my-feature";

app.route("/api/my-feature", myFeatureRouter);
```

3. Add tests in `test/my-feature.test.ts`
4. Run tests: `pnpm test`

#### Example: Adding a New Component

1. Create component in `apps/web/src/components/MyFeature.tsx`:
```typescript
"use client";

import React from "react";

export interface MyFeatureProps {
  title: string;
  onAction?: () => void;
}

/**
 * MyFeature component
 * 
 * @example
 * <MyFeature title="Example" onAction={() => console.log("clicked")} />
 */
export function MyFeature({ title, onAction }: MyFeatureProps) {
  return (
    <div className="my-feature">
      <h2>{title}</h2>
      {onAction && <button onClick={onAction}>Action</button>}
    </div>
  );
}
```

2. Use in pages or other components
3. Test functionality manually during dev

#### Example: Database Schema Change

1. Update schema in `packages/db/src/schema/my-table.ts`
2. Generate migration: `pnpm db:generate`
3. Review generated migration SQL
4. Test locally: `pnpm db:migrate`
5. Document changes in migration comments

### Type Safety

All TypeScript must pass strict mode:

```bash
pnpm typecheck
```

Before submitting, ensure:
- All packages compile without errors
- No `any` types (except with `// @ts-ignore` comments)
- All imports are used
- Function signatures are complete

### Testing

Run tests with the API running:

```bash
# Terminal with API and Web running
pnpm test
```

Add tests for new features:
- Create `test/your-feature.test.ts`
- Follow existing test format
- Add to `pnpm test` script in `package.json`

## Submitting Changes

### Before Committing

1. **Format code** (if prettier is configured)
2. **Run typecheck:** `pnpm typecheck`
3. **Run tests:** `pnpm test` (with dev servers running)
4. **Update docs** if behavior changes

### Commit Message Format

Use clear, descriptive commit messages:

```
feat: Add new feature
docs: Update documentation
fix: Resolve issue with component
refactor: Improve code structure
test: Add test coverage for feature
chore: Update dependencies
```

**Good examples:**
- ✅ `feat: Add video search with filters`
- ✅ `fix: Resolve race condition in WebSocket handler`
- ✅ `docs: Add API documentation for payments`

**Bad examples:**
- ❌ `update` 
- ❌ `fix stuff`
- ❌ `asdf`

### Creating a Pull Request

1. Push your branch: `git push origin feature/your-feature`
2. Go to GitHub and create a PR
3. Fill in the PR template:
   - **Description:** What does this change?
   - **Type:** Feature/Bug/Docs/Refactor
   - **Related Issues:** Link to issues
   - **Testing:** How was this tested?
4. Request review
5. Address feedback

## Architecture Overview

### Frontend (`apps/web`)
- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS
- **State:** React Context (Entitlements, Auth)
- **API Client:** `lib/api.ts` for Worker communication

### Worker API (`apps/worker`)
- **Framework:** Cloudflare Workers with Hono
- **Realtime:** Durable Objects for WebSocket management
- **Database:** Drizzle ORM + Neon PostgreSQL via Hyperdrive
- **Auth:** BetterAuth sessions in database
- **Payments:** Stripe webhooks for subscription management

### Database (`packages/db`)
- **ORM:** Drizzle ORM  
- **Database:** Neon PostgreSQL
- **Migrations:** SQL-based with Drizzle Kit
- **Schema:** Documented in `packages/db/src/schema/`

### Shared Types (`packages/types`)
- All TypeScript interfaces live here
- Imported by Worker and Web apps
- Keep types synchronized

## Common Tasks

### Add a Database Field

```bash
# 1. Edit schema
# packages/db/src/schema/users.ts - add new column

# 2. Generate migration
cd packages/db
pnpm db:generate

# 3. Review migration SQL
# Edit packages/db/src/migrations/XXXX_name.sql if needed

# 4. Run locally
pnpm db:migrate
```

### Add a New Environment Variable

```bash
# 1. Document in .dev.vars.example
echo "MY_NEW_VAR=description" >> apps/worker/.dev.vars.example

# 2. Add to types.ts
// packages/db/src/types.ts
export interface Env {
  MY_NEW_VAR: string;
}

# 3. Add to wrangler.toml documentation
# [vars]
# MY_NEW_VAR = "default value"

# 4. Use in code
const value = env.MY_NEW_VAR;
```

### Fix a Bug

1. Create branch: `git checkout -b fix/bug-description`
2. Write failing test (if applicable)
3. Fix the bug
4. Verify test passes
5. Create PR with clear description

### Performance Optimization

1. Profile the bottleneck (DevTools, log analysis)
2. Implement optimization
3. Measure improvement (before/after)
4. Document changes
5. Add regression tests if applicable

## Code Review Process

Reviewers will check:
- **Correctness:** Does the code work?
- **Tests:** Is it tested?
- **Performance:** Are there concerns?
- **Security:** Any vulnerabilities?
- **Documentation:** Is it clear?
- **Style:** Does it follow conventions?

Be open to feedback and iterate quickly.

## Deployment

Production deployments are done by maintainers:

```bash
# Worker
cd apps/worker && pnpm deploy

# Web
cd apps/web && pnpm build:pages && pnpm deploy
```

See [PHASE_3_DEPLOYMENT_READY.md](./PHASE_3_DEPLOYMENT_READY.md) for details.

## Need Help?

- **Questions:** Open a Discussion on GitHub
- **Bugs:** Report issues with reproduction steps
- **Ideas:** Propose features in Discussions
- **Chat:** Join our community Slack (link in README)

## Resources

- [Architecture Decisions](./ARCHITECTURE.md)
- [Engineering Standards](./ENGINEERING.md) 
- [API Reference](./API.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Local Dev Setup](./LOCAL_DEVELOPMENT_SETUP.md)
- [Project Status](./improvement-tracker.md)

## Recognition

Contributors are recognized:
- Merged PRs listed in release notes
- Major contributors mentioned in README
- Profile featured on community page

Thank you for contributing to NicheStream! 🎬
