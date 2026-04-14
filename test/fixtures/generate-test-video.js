#!/usr/bin/env node

/**
 * Generate a minimal test video file (MP4 format)
 * This creates a small, valid video file for testing upload endpoints
 * 
 * Usage: node test/fixtures/generate-test-video.js [output-path] [duration-seconds]
 * 
 * Prerequisites: ffmpeg must be installed
 *   macOS: brew install ffmpeg
 *   Ubuntu: sudo apt-get install ffmpeg
 *   Windows: choco install ffmpeg or download from ffmpeg.org
 */

const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const OUTPUT_PATH = process.argv[2] || path.join(__dirname, "test-video-10s.mp4");
const DURATION = process.argv[3] || "10";

console.log(`🎬 Generating test video: ${OUTPUT_PATH}`);
console.log(`   Duration: ${DURATION} seconds`);

try {
  // Check if ffmpeg is available
  execSync("ffmpeg -version > /dev/null 2>&1");
} catch {
  console.error(
    "❌ ffmpeg not found. Install it with:\n" +
    "   macOS: brew install ffmpeg\n" +
    "   Ubuntu: sudo apt-get install ffmpeg\n" +
    "   Windows: choco install ffmpeg"
  );
  process.exit(1);
}

try {
  // Create a minimal colorful video with sound
  const cmd = [
    "ffmpeg",
    "-f lavfi",
    "-i color=c=blue:s=1280x720:d=" + DURATION,    // Blue background, 1280x720
    "-f lavfi",
    "-i sine=f=440:d=" + DURATION,                   // 440Hz sine wave
    "-vcodec libx264",
    "-preset ultrafast",                              // Fastest encoding
    "-crf 28",                                         // Lower quality = smaller file
    "-acodec aac",
    "-y",                                             // Overwrite without asking
    OUTPUT_PATH,
  ].join(" ");

  console.log("Running ffmpeg...");
  execSync(cmd, { stdio: "inherit" });

  const stats = fs.statSync(OUTPUT_PATH);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log(`✅ Test video created successfully!`);
  console.log(`   Path: ${OUTPUT_PATH}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`   Duration: ${DURATION}s`);
  console.log(`   Codec: H.264 (libx264)`);
  console.log(`   Audio: AAC 440Hz sine wave`);
  console.log(`   Resolution: 1280x720`);
} catch (error) {
  console.error("❌ Failed to generate video:", error.message);
  process.exit(1);
}
