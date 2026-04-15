# API Configuration Issue - Root Cause & Fix

**Issue:** Browser console showed `net::ERR_NAME_NOT_RESOLVED` when frontend tried to reach `https://api.itsjusus.com/api/auth/entitlements`

**Root Cause:** Environment variable naming mismatch

| File | Defines | Code Expects | Result |
|------|---------|--------------|--------|
| `.env.local` | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787` | `NEXT_PUBLIC_API_URL` | ❌ Undefined, falls back to localhost |
| GitHub Actions | Sets `NEXT_PUBLIC_API_URL: "https://api.itsjusus.com"` | — | ✓ Works in CI/CD |
| Source Code | — | `process.env.NEXT_PUBLIC_API_URL` | ❌ Undefined in production static build |

**The Fix:** Standardized all references to use `NEXT_PUBLIC_API_BASE_URL` consistently

**Files Changed:**
1. `apps/web/src/lib/api.ts` - Changed env var reference
2. `apps/web/src/app/sitemap.ts` - Changed env var reference
3. `apps/web/src/app/api/auth/[...all]/route.ts` - Changed env var reference
4. `apps/web/src/hooks/useWebSocket.ts` - Changed env var reference
5. `apps/web/wrangler.toml` - Changed env var definition
6. `.github/workflows/deploy.yml` - Updated GitHub Actions env var names
7. `scripts/pre-deploy-checks.js` - Updated validation script

**Status:** ✅ Fixed and committed (a824e24)

---

## Next Steps for Development

### Local Development
```bash
# Ensure your .env.local has the correct variable name:
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787

# Start both Worker and Web:
pnpm dev

# The frontend will now correctly reach http://localhost:8787
```

### Production Deployment
For production, the GitHub Actions workflow now correctly sets:
```yaml
env:
  NEXT_PUBLIC_API_BASE_URL: "https://api.itsjusus.com"
```

This will be baked into the static build and the frontend will reach the correct API endpoint.

---

## Additional Notes

**DNS Resolution:** The subdomain `api.itsjusus.com` requires proper Cloudflare DNS configuration:
- Verify the custom domain route in `apps/worker/wrangler.toml` (already configured)
- Ensure the Worker is deployed with: `wrangler deploy`
- Check Cloudflare dashboard for routing rules

**Environment Variables Summary:**
- **Development:** `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787` (in `.env.local`)
- **Staging/Production:** Set via GitHub Actions secrets → `NEXT_PUBLIC_API_BASE_URL=https://api.itsjusus.com`

---

**Issue Resolved.** The API client now uses the correct environment variable and will properly resolve to the configured endpoint.
