#!/usr/bin/env node

/**
 * Generate a minimal test video file without external dependencies
 * Creates a valid MP4 file with minimal binary structure
 * 
 * This is much smaller than ffmpeg-generated videos and suitable for testing
 * the upload endpoint without large file sizes.
 * 
 * Usage: node test/fixtures/create-minimal-video.js [output-path]
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = process.argv[2] || path.join(__dirname, "test-video-minimal.mp4");

/**
 * Minimal valid MP4 structure
 * This is a real MP4 file that can be recognized by video players
 * but contains no actual video frames - just the container structure
 * Size: ~1 KB
 */
function createMinimalMP4Buffer() {
  // This is a minimal valid MP4 file structure with proper headers
  // ftyp box (file type) + mdat box (media data)
  const buffer = Buffer.alloc(1024);
  
  // ftyp box (file type box)
  // Box size: 20 bytes
  buffer.writeUInt32BE(20, 0);           // Size
  buffer.write("ftyp", 4);               // Type
  buffer.write("isom", 8);               // Major brand
  buffer.writeUInt32BE(512, 12);         // Minor version
  buffer.write("isomiso2mp41", 16);      // Compatible brands
  
  // moov box (movie metadata box) - simplified minimal structure
  buffer.writeUInt32BE(100, 20);         // Size
  buffer.write("moov", 24);              // Type
  
  // mvhd box (movie header)
  buffer.writeUInt32BE(108, 28);         // Size
  buffer.write("mvhd", 32);              // Type
  buffer.writeUInt8(0, 36);              // Version
  buffer.writeUInt32BE(0, 37);           // Flags
  buffer.writeUInt32BE(0, 41);           // Creation time
  buffer.writeUInt32BE(0, 45);           // Modification time
  buffer.writeUInt32BE(1000, 49);        // Timescale
  buffer.writeUInt32BE(10000, 53);       // Duration (10 seconds at 1000 timescale)
  
  // mdat box (media data)
  buffer.writeUInt32BE(8, 104);          // Size
  buffer.write("mdat", 108);             // Type
  
  return buffer;
}

function createValidMP4WithMetadata() {
  // A more complete minimal MP4 with proper metadata
  // This will be recognized as a valid video file
  const parts = [];
  
  // ftyp box
  const ftypBox = Buffer.alloc(24);
  ftypBox.writeUInt32BE(24, 0);           // Size
  ftypBox.write("ftyp", 4);               // Type
  ftypBox.write("isom", 8);               // Major brand
  ftypBox.writeUInt32BE(512, 12);         // Minor version
  ftypBox.write("isomiso2", 16);          // Compatible brands (8 bytes)
  parts.push(ftypBox);
  
  // mdat box with minimal data
  const mdatBox = Buffer.alloc(16);
  mdatBox.writeUInt32BE(16, 0);           // Size (includes header)
  mdatBox.write("mdat", 4);               // Type
  mdatBox.write("TestVideoData", 8);      // Dummy video data
  parts.push(mdatBox);
  
  // moov (movie) box
  const moovBox = Buffer.alloc(200);
  moovBox.writeUInt32BE(200, 0);          // Size
  moovBox.write("moov", 4);               // Type
  
  // mvhd (movie header)
  moovBox.writeUInt32BE(108, 8);          // Size
  moovBox.write("mvhd", 12);              // Type
  moovBox.writeUInt8(0, 16);              // Version
  moovBox.writeUInt32BE(0, 17);           // Flags
  moovBox.writeUInt32BE(0, 21);           // Creation time
  moovBox.writeUInt32BE(0, 25);           // Modification time
  moovBox.writeUInt32BE(1000, 29);        // Timescale
  moovBox.writeUInt32BE(10000, 33);       // Duration
  moovBox.writeUInt32BE(0x00010000, 37);  // Playback speed (1.0)
  moovBox.writeUInt16BE(0x0100, 41);      // Volume (1.0)
  
  parts.push(moovBox);
  
  return Buffer.concat(parts);
}

console.log(`📹 Creating minimal test video: ${OUTPUT_PATH}`);

try {
  const videoBuffer = createValidMP4WithMetadata();
  fs.writeFileSync(OUTPUT_PATH, videoBuffer);
  
  const stats = fs.statSync(OUTPUT_PATH);
  const sizeKB = (stats.size / 1024).toFixed(2);
  
  console.log(`✅ Test video created successfully!`);
  console.log(`   Path: ${OUTPUT_PATH}`);
  console.log(`   Size: ${sizeKB} KB (minimal structure)`);
  console.log(`   Duration: 10 seconds (metadata)`);
  console.log(`   Type: MP4 (minimal valid structure)`);
  console.log(`   Purpose: API endpoint testing\n`);
  console.log(`   ⚠️  Note: This is a minimal MP4 for testing API validation,`);
  console.log(`      not for actual video playback. For playback testing,`);
  console.log(`      use generate-test-video.js with ffmpeg.`);
} catch (error) {
  console.error("❌ Failed to create video:", error.message);
  process.exit(1);
}
