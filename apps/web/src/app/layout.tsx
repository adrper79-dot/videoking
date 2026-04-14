import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { NotificationBanner } from "@/components/NotificationBanner";
import { EntitlementsProvider } from "@/components/EntitlementsContext";

export const metadata: Metadata = {
  title: {
    default: "NicheStream – Hyper-Niche Video Platform",
    template: "%s | NicheStream",
  },
  description:
    "Discover and watch hyper-niche interactive videos. Live chat, polls, watch parties, and creator monetization.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://nichestream.tv"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "NicheStream",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0f0f0f] text-neutral-100 antialiased">
        <EntitlementsProvider>
          <Navbar />
          <NotificationBanner />
          <main className="pt-16">{children}</main>
        </EntitlementsProvider>
      </body>
    </html>
  );
}
