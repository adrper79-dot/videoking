# 🚀 Deploy Worker to Cloudflare — Two Options

**Current Status:** Worker code is ready, needs authentication to deploy  
**Latest Attempt:** Failed (Pages auto-build issue - already fixed)  
**Next Step:** Deploy via one of two methods below

---

## Option 1: Manual Deploy (Fastest - 2 minutes)

Use this if you want to deploy right now from your dev machine.

### Step 1: Authenticate with Cloudflare
```bash
cd /workspaces/videoking/apps/worker
pnpm exec wrangler login
```

This opens a browser window. Follow the prompt to authorize.

### Step 2: Deploy Worker
```bash
pnpm deploy
```

Expected output:
```
⛅️ wrangler 3.114.17
Uploading...
Success: Uploaded nichestream-api
```

### Step 3: Verify
```bash
curl https://nichestream-api.YOUR_ACCOUNT.workers.dev/health
# Expected: 200 OK with JSON
```

**Done!** Worker is live.

---

## Option 2: GitHub Actions Deploy (Recommended - Automatic)

This is already set up. Just push to main and it deploys automatically.

### How it works:
```
1. You run: git push origin main
2. GitHub Actions automatically:
   - Type checks code
   - Builds Worker
   - Uses CLOUDFLARE_API_TOKEN from GitHub Secrets
   - Deploys to Cloudflare
3. Done! Live within 2-3 minutes
```

### Why this is better:
- ✅ No local authentication needed
- ✅ Credentials never in your shell history
- ✅ Every push is automatically deployed
- ✅ Build logs visible in GitHub Actions
- ✅ Easy to troubleshoot failures

### To use GitHub Actions:

Just make any commit and push:
```bash
git push origin main
```

Monitor at: https://github.com/adrper79-dot/videoking/actions

---

## Which One Should You Use?

| Situation | Use |
|-----------|-----|
| "I want it deployed RIGHT NOW" | Option 1 (Manual) |
| "I want automatic deployment on every push" | Option 2 (GitHub Actions) |
| "I'm going to keep tweaking code" | Option 2 (GitHub Actions) |
| "I just want to verify it works" | Option 1 (Manual) |

**Recommendation:** Use Option 1 now to verify it works, then push to main for future deployments via Option 2.

---

## Troubleshooting

### Q: "Command 'pnpm' not found"
```bash
cd /workspaces/videoking
pnpm install  # Install dependencies
```

### Q: "wrangler login" hangs
- Kill with Ctrl+C
- Use Option 2 (GitHub Actions) instead

### Q: "Invalid account ID"
Check your wrangler.toml has the account_id field, or add:
```toml
[env.production]
account_id = "YOUR_ACCOUNT_ID"
```

### Q: Deployment succeeds but Worker doesn't work
Check:
1. Visit dashboard to verify deployment: https://dash.cloudflare.com/workers
2. Enable observability: Settings → Workers Logs (toggle on)
3. Test endpoint: `curl https://nichestream-api.ACCOUNT.workers.dev/health`
4. Check logs in dashboard

---

## After Deployment

### 1. Verify it's live
Test the health endpoint:
```bash
curl https://nichestream-api.YOUR_ACCOUNT.workers.dev/health
```

### 2. Enable monitoring
In Cloudflare dashboard:
- Workers & Pages → nichestream-api → Settings
- Enable "Workers Logs"
- Enable "Workers Traces"

### 3. For next deployments
Just push to main:
```bash
git push origin main
# GitHub Actions handles the rest automatically
```

---

## Need Your Account ID?

1. Go to: https://dash.cloudflare.com
2. Look at the URL in your browser: `dash.cloudflare.com/ACCOUNT_ID/...`
3. Copy that ACCOUNT_ID

Or from wrangler:
```bash
pnpm exec wrangler whoami  # After login
```

---

**Pick one option above and follow the steps. Worker will be live in 2 minutes.**
