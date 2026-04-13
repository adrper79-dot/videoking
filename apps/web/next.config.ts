import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cloudflare/next-on-pages transforms a standard Next.js build for the
  // Cloudflare Pages edge runtime. Do NOT set output: 'export' here — that
  // would break dynamic routes that use notFound() or server-side data fetching.
  images: {
    // Cloudflare Pages does not support Next.js's built-in image optimization
    // (next/image requires serverless function execution). Instead, unoptimized: true
    // relies on Cloudflare's edge caching and CDN compression for optimization.
    // Future: Consider Cloudflare Image Variants via custom fetch handlers for WebP/AVIF.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "assets.nichestream.tv" },
      { protocol: "https", hostname: "customer-*.cloudflarestream.com" },
      { protocol: "https", hostname: "videodelivery.net" },
    ],
  },
  trailingSlash: false,
  experimental: {
    // React Compiler is intentionally disabled; the project relies on
    // standard React memoization patterns for compatibility.
    reactCompiler: false,
  },
};

export default nextConfig;
