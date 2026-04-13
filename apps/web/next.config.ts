import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Cloudflare Pages via @cloudflare/next-on-pages
  output: "export",
  images: {
    // Cloudflare Image Resizing handles optimization
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "assets.nichestream.tv" },
      { protocol: "https", hostname: "customer-*.cloudflarestream.com" },
      { protocol: "https", hostname: "videodelivery.net" },
    ],
  },
  // Ensure trailing slashes are consistent
  trailingSlash: false,
  experimental: {
    // React Compiler is intentionally disabled; the project relies on
    // standard React memoization patterns for compatibility.
    reactCompiler: false,
  },
};

export default nextConfig;
