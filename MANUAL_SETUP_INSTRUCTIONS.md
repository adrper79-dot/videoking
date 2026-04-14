#!/bin/bash
# Manual Cloudflare Domain Setup
# Run this locally after setting up Cloudflare credentials

set -e

echo "🌐 Manual Cloudflare Setup (Local)"
echo "=================================="
echo ""

# Step 1: Authenticate
echo "Step 1: Authenticate with Cloudflare"
echo "Command: cd apps/worker && pnpm exec wrangler login"
echo "This will open your browser to authenticate"
echo ""
read -p "Have you authenticated? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please run: cd apps/worker && pnpm exec wrangler login"
    exit 1
fi

echo ""
echo "Step 2: Deploy Worker"
cd apps/worker
echo "Running: pnpm exec wrangler deploy"
pnpm exec wrangler deploy
echo "✅ Worker deployed with routes"
echo ""

echo "Step 3: Add R2 Custom Domain"
echo "Running: pnpm exec wrangler r2 bucket domain add videoking-r2"
pnpm exec wrangler r2 bucket domain add videoking-r2
echo ""
echo "✅ Setup complete!"
echo ""
echo "Domains should now be active:"
echo "  - api.itsjusus.com → Worker"
echo "  - assets.itsjusus.com → R2"
echo "  - itsjusus.com → Pages"
