import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Geist Sans / Geist Mono (self-hosted) — the DESIGN.md-endorsed substitutes
// for the proprietary Linear Display / Text / Mono families.
// Both expose the CSS variables --font-geist-sans / --font-geist-mono.

export const metadata: Metadata = {
  title: "Knowledge Hub — Your team's knowledge, in order",
  description:
    "Knowledge Hub turns docs, decisions, and discussion into a structured system — searchable in milliseconds and linked to every issue and PR.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#010102" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

// Re-applies a stored light preference before first paint (no flash).
// Dark is the default; the ThemeToggle persists "light" | "dark".
const themeInitScript = `try{if(localStorage.getItem("theme")==="light"){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {children}
      </body>
    </html>
  );
}
