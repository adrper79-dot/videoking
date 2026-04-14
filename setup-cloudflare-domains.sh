#!/bin/bash
# Cloudflare Custom Domain Setup Script
# This script configures custom domains for Workers, Pages, and R2 using wrangler CLI

set -e  # Exit on error

echo "🌐 Cloudflare Custom Domain Setup"
echo "=================================="
echo ""

# Change to worker directory
cd "$(dirname "$0")/apps/worker"

# Check authentication
echo "Checking Cloudflare authentication..."
if ! pnpm exec wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not authenticated with Cloudflare"
    echo "Run: pnpm exec wrangler login"
    exit 1
fi
echo "✅ Authenticated"
echo ""

# 1. Deploy Worker with routes
echo "1️⃣  Deploying Worker with custom routes..."
echo "   Pattern: api.itsjusus.com/*"
echo "   Zone: itsjusus.com"
pnpm exec wrangler deploy
echo "✅ Worker deployed with routes"
echo ""

# 2. Set up R2 custom domain
echo "2️⃣  Setting up R2 custom domain..."
echo "   Bucket: videoking-r2"
echo "   Domain: assets.itsjusus.com"
echo ""
echo "   Command to run:"
echo "   pnpm exec wrangler r2 bucket domain add videoking-r2"
echo ""
echo "   Then follow the prompts to add: assets.itsjusus.com"
echo ""

# Try to add the domain (may require interactive input)
echo "Running R2 domain command (you may need to confirm in the prompt)..."
pnpm exec wrangler r2 bucket domain add videoking-r2 --domain-name "assets.itsjusus.com" 2>&1 || true
echo ""

# 3. Verify setup
echo "3️⃣  Verifying setup..."
echo ""

echo "Worker routes:"
pnpm exec wrangler routes list 2>&1 || echo "   (May not be available in this wrangler version)"
echo ""

echo "R2 custom domains:"
pnpm exec wrangler r2 bucket domain list videoking-r2 2>&1 || echo "   (May not be available in this wrangler version)"
echo ""

echo "=================================="
echo "✅ Setup commands complete!"
echo ""
echo "Summary:"
echo "- Worker routes configured in wrangler.toml ✅"
echo "- Worker deployed with api.itsjusus.com routing"
echo "- R2 bucket domain setup initiated"
echo ""
echo "Note: Pages domain (itsjusus.com) was already set up in Cloudflare dashboard"
echo ""
echo "If domains aren't active yet:"
echo "1. Go to https://dash.cloudflare.com"
echo "2. Check Workers → nichestream-api → domains status"
echo "3. Check R2 → videoking-r2 → domain status"
echo "4. Allow 5-10 minutes for DNS propagation"
