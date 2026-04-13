# Security & Secrets Management

**Last updated:** April 13, 2026

---

## ⚠️ Never Commit Secrets

The following files should NEVER be committed:

```
.env
.env.local
.dev.vars
.secrets
*.key
*.secret
secrets.txt
```

**Why?** If credentials leak into git history, they stay forever (even if deleted).

---

## Local Development Setup

### For Worker (`apps/worker`)

1. Copy the template:
   ```bash
   cp apps/worker/.dev.vars.example apps/worker/.dev.vars
   ```

2. Fill in your actual values:
   ```bash
   BETTER_AUTH_SECRET=your-32-char-secret
   STREAM_API_TOKEN=your-token
   STRIPE_SECRET_KEY=sk_test_xxxx
   # ... etc
   ```

3. Never commit `.dev.vars`

### For Frontend (`apps/web`)

1. Copy the template:
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```

2. Fill in public values:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8787
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
   ```

3. Never commit `.env.local`

---

## Getting Secrets (First Time)

### Contact the team for:
- `BETTER_AUTH_SECRET` (shared with team lead)
- `STRIPE_SECRET_KEY` and webhook secret
- `STREAM_API_TOKEN` (from Cloudflare dashboard)
- Other env var values from 1Password or secrets manager

### Never ask for secrets in:
- Slack messages
- Email
- GitHub issues
- Pull requests

Use your team's password manager (1Password, Keybase, Vault) instead.

---

## If You Accidentally Commit Secrets

**Immediate action:**
1. Do NOT push the branch to GitHub
2. Notify the team lead immediately
3. The commit will be force-removed from history
4. Rotate the exposed credentials (reset API tokens, passwords, etc.)

**Prevention:**
- Git hooks can auto-prevent commits with `.env` files
- Enable branch protection: "Require status checks before merging"
- Use AWS Secrets Manager or similar for production secrets

---

## Production Secrets (Cloudflare)

For production deployment, secrets are stored in **Cloudflare Workers Secrets**:

```bash
# Set a secret
wrangler secret put STRIPE_SECRET_KEY

# List secrets (never shows values)
wrangler secret list

# Delete a secret
wrangler secret delete STRIPE_SECRET_KEY
```

Never paste production keys into `.dev.vars` locally.

---

## Environment File Reference

| File | Type | Committed? | Usage |
|---|---|---|---|
| `.dev.vars` | Worker secrets | ❌ NO | Local development only |
| `.env.local` | Frontend secrets | ❌ NO | Local development only |
| `.dev.vars.example` | Template | ✅ YES | Example for new developers |
| `.env.local.example` | Template | ✅ YES | Example for new developers |
| `wrangler.toml` | Config | ✅ YES | Build config (no secrets) |
| `.gitignore` | Git rules | ✅ YES | Prevents secret commits |

---

## Checklist for New Team Members

- [ ] Read this file
- [ ] Copy `.dev.vars.example` → `.dev.vars`
- [ ] Copy `.env.local.example` → `.env.local`
- [ ] Get secrets from team lead / 1Password
- [ ] Verify `pnpm dev` works locally
- [ ] Confirm `.gitignore` prevents `.dev.vars` commits
- [ ] Run `git status` and verify no `.dev.vars` or `.env.local` listed

---

## Best Practices

✅ **DO:**
- Use strong, unique secrets (32+ chars for BETTER_AUTH_SECRET)
- Rotate secrets quarterly
- Store backups in password manager only
- Use different keys for dev, staging, production
- Log secret access in audit trail

❌ **DON'T:**
- Paste secrets in chat or email
- Share `.dev.vars` files
- Commit environment files to git
- Use the same secret in multiple environments
- Log secret values (only log "SECRET_PROVIDED")

---

## Slack Channel for Security Issues

Post security concerns in `#security` or DM the team lead immediately.

Examples:
- Suspected credential leak
- Suspicious account activity
- New vulnerability discovery
- Questions about secret rotation

---

## References

- [OWASP Secret Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Git Security Best Practices](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)
