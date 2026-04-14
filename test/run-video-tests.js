#!/usr/bin/env node

/**
 * Interactive Test Runner for Video Functions
 * 
 * Usage: node test/run-video-tests.js [options]
 * 
 * Options:
 *   --generate      Generate test video first
 *   --upload        Run upload tests
 *   --retrieval     Run retrieval tests  
 *   --all          Run all tests (default)
 *   --token TOKEN   Set auth token (or via TEST_AUTH_TOKEN env)
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const TEST_VIDEO_PATH = path.join(__dirname, "fixtures/test-video.mp4");
const args = process.argv.slice(2);

async function runCommand(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: "inherit",
      ...options,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}

async function generateTestVideo() {
  console.log("\n📹 Generating test video...\n");
  
  if (!fs.existsSync(TEST_VIDEO_PATH)) {
    await runCommand("node", [path.join(__dirname, "fixtures/create-minimal-video.js"), TEST_VIDEO_PATH]);
    console.log("✅ Test video generated\n");
  } else {
    console.log("✅ Test video already exists\n");
  }
}

async function runVideoTests() {
  console.log("\n🧪 Running video upload tests...\n");

  const env = process.env;
  
  // Extract --token if provided
  const tokenIdx = process.argv.indexOf("--token");
  if (tokenIdx !== -1) {
    env.TEST_AUTH_TOKEN = process.argv[tokenIdx + 1];
  }

  await runCommand("node", [path.join(__dirname, "video-upload.test.js")], { 
    env,
    stdio: "inherit"
  });
}

async function main() {
  console.log("═".repeat(60));
  console.log("🎬 NicheStream Video Function Test Runner");
  console.log("═".repeat(60));

  try {
    // Check if test video exists, generate if not
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      console.log("\n⚠️  Test video not found. Generating...");
      await generateTestVideo();
    } else {
      console.log("\n✅ Test video found");
    }

    // Run tests
    if (args.includes("--generate")) {
      // Just generate
      console.log("\n✨ Test video is ready!\n");
    } else if (args.includes("--upload") || args.includes("--retrieval") || args.includes("--all")) {
      // Run tests
      await runVideoTests();
    } else {
      // Default: run all
      await runVideoTests();
    }

    console.log("\n" + "═".repeat(60));
    console.log("✨ Done!\n");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.log("\nTroubleshooting:");
    console.log("  1. Ensure Worker API is running: cd apps/worker && pnpm dev");
    console.log("  2. Set TEST_AUTH_TOKEN: export TEST_AUTH_TOKEN='your-token'");
    console.log("  3. Check WORKER_URL: export WORKER_URL='http://localhost:8787'\n");
    process.exit(1);
  }
}

main();
