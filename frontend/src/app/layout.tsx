import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const preloaderBootstrap = `
try {
  if (window.location.pathname === "/" && window.sessionStorage.getItem("novamart-preloader-seen") !== "1") {
    document.documentElement.dataset.preloader = "pending";
  }
} catch (error) {
  if (window.location.pathname === "/") {
    document.documentElement.dataset.preloader = "pending";
  }
}
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NovaMart | Everyday finds, fast checkout",
  description: "Shop curated electronics, home, fitness, kitchen, and travel essentials at NovaMart.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preloaderBootstrap }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
