#!/usr/bin/env node
/**
 * Pre-Deployment Validation Script
 * Catches common production issues BEFORE deployment
 * Run: pnpm run pre-deploy-check
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const webDir = path.join(rootDir, "apps", "web");
const workerDir = path.join(rootDir, "apps", "worker");

let errors = [];
let warnings = [];

function error(msg) {
  console.error(`❌ ${msg}`);
  errors.push(msg);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings.push(msg);
}

function success(msg) {
  console.log(`✓ ${msg}`);
}

console.log("🔍 Running pre-deployment checks...\n");

// ====== 1. Check Environment Variables ======
console.log("1️⃣  Environment Variables");
const requiredEnvVars = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_APP_URL",
];

const optionalEnvVars = ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];

requiredEnvVars.forEach((envVar) => {
  if (process.env[envVar]) {
    success(`${envVar} = ${process.env[envVar]}`);
  } else {
    warn(`${envVar} is not set (will default to localhost in build)`);
  }
});

optionalEnvVars.forEach((envVar) => {
  if (process.env[envVar]) {
    success(`${envVar} configured`);
  } else {
    warn(`${envVar} is not set (optional)`);
  }
});
console.log();

// ====== 2. Check Static Files ======
console.log("2️⃣  Static Files (PWA & Icons)");
const requiredFiles = [
  "apps/web/public/manifest.json",
  "apps/web/public/favicon.ico",
  "apps/web/public/icon-192.png",
  "apps/web/public/icon-512.png",
];

requiredFiles.forEach((file) => {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const size = fs.statSync(fullPath).size;
    success(`${file} (${size} bytes)`);
  } else {
    error(`Missing: ${file}`);
  }
});
console.log();

// ====== 3. Check manifest.json (Static File)======
console.log("3️⃣  Manifest.json (Static File)");
const manifestPath = path.join(webDir, "public", "manifest.json");
if (fs.existsSync(manifestPath)) {
  const size = fs.statSync(manifestPath).size;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    success(`manifest.json (${size} bytes) - valid JSON`);
    
    // Verify icons exist
    if (manifest.icons && manifest.icons.length > 0) {
      manifest.icons.forEach((icon, i) => {
        if (icon.src) {
          const iconPath = path.join(webDir, "public", icon.src);
          if (fs.existsSync(iconPath)) {
            success(`  Icon ${i + 1}: ${icon.src} exists`);
          } else {
            error(`  Icon ${i + 1}: ${icon.src} NOT FOUND`);
          }
        }
      });
    }
  } catch (e) {
    error(`Invalid manifest.json JSON: ${e.message}`);
  }
} else {
  error("Missing: apps/web/public/manifest.json");
}
console.log();

// ====== 4. Check for localhost references in source ======
console.log("4️⃣  Source Code Checks (localhost references)");
const sourceFiles = [
  "apps/web/src/lib/api.ts",
  "apps/web/src/hooks/useWebSocket.ts",
  "apps/web/src/app/layout.tsx",
];

sourceFiles.forEach((file) => {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf8");
    if (content.includes("localhost:8787")) {
      warn(`${file} contains localhost:8787 fallback\n       (This is OK if env vars are set during build)`);
    } else {
      success(`${file} - no localhost references`);
    }
  }
});
console.log();

// ====== 5. Check wrangler.toml ======
console.log("5️⃣  Cloudflare Configuration");
const pagesWranglerPath = path.join(webDir, "wrangler.toml");
const workerWranglerPath = path.join(workerDir, "wrangler.toml");

// Check Pages wrangler.toml
try {
  const content = fs.readFileSync(pagesWranglerPath, "utf8");
  if (content.includes('name = "videoking"')) {
    success("Pages project name is correct: videoking");
  } else {
    error('Pages wrangler.toml: name should be "videoking"');
  }

  if (content.includes('NEXT_PUBLIC_API_URL')) {
    success('Pages wrangler.toml: NEXT_PUBLIC_API_URL configured');
  } else {
    warn('Pages wrangler.toml: NEXT_PUBLIC_API_URL not in wrangler.toml');
  }
} catch (e) {
  error(`Cannot read pages wrangler.toml: ${e.message}`);
}

// Check Worker wrangler.toml
try {
  const content = fs.readFileSync(workerWranglerPath, "utf8");
  if (content.includes('name = "nichestream-api"')) {
    success("Worker project name is correct: nichestream-api");
  } else if (content.includes('name =')) {
    const match = content.match(/name\s*=\s*"([^"]+)"/);
    if (match) {
      warn(`Worker project name is: ${match[1]} (expected: nichestream-api)`);
    }
  }

  if (content.includes("APP_BASE_URL")) {
    success("Worker has APP_BASE_URL configured");
  } else {
    warn("Worker missing APP_BASE_URL in wrangler.toml");
  }
} catch (e) {
  error(`Cannot read worker wrangler.toml: ${e.message}`);
}
console.log();

// ====== 6. Check GitHub Actions deployment ======
console.log("6️⃣  GitHub Actions Workflow");
const workflowPath = path.join(rootDir, ".github", "workflows", "deploy.yml");
try {
  const content = fs.readFileSync(workflowPath, "utf8");

  if (content.includes("pnpm build:pages")) {
    if (content.includes("NEXT_PUBLIC_API_URL")) {
      success("Deploy workflow sets NEXT_PUBLIC_API_URL during build");
    } else {
      error(
        "Deploy workflow: Build step doesn't set NEXT_PUBLIC_API_URL\n" +
        "       → Frontend will use localhost fallback in production"
      );
    }

    if (content.includes("NEXT_PUBLIC_APP_URL")) {
      success("Deploy workflow sets NEXT_PUBLIC_APP_URL during build");
    } else {
      error("Deploy workflow: Build step doesn't set NEXT_PUBLIC_APP_URL");
    }
  }
} catch (e) {
  error(`Cannot read deploy workflow: ${e.message}`);
}
console.log();

// ====== Summary ======
console.log("━".repeat(60));
if (errors.length === 0 && warnings.length === 0) {
  console.log("✅ All pre-deployment checks passed!");
  process.exit(0);
} else if (errors.length === 0) {
  console.log(`⚠️  ${warnings.length} warning(s) - safe to deploy`);
  process.exit(0);
} else {
  console.log(`❌ ${errors.length} error(s) found - DO NOT DEPLOY`);
  console.log("\nFix these issues:");
  errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  process.exit(1);
}
