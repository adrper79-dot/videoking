/**
 * Dynamic PWA manifest route
 * Returns the manifest as JSON
 */

export const runtime = "edge";

export async function GET() {
  return Response.json(
    {
      name: "NicheStream",
      short_name: "NicheStream",
      description: "Hyper-niche interactive video platform",
      start_url: "/",
      display: "standalone",
      background_color: "#0f0f0f",
      theme_color: "#6366f1",
      icons: [
        {
          src: "/favicon.ico",
          sizes: "32x32",
          type: "image/x-icon",
        },
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      categories: ["entertainment", "video"],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    }
  );
}
