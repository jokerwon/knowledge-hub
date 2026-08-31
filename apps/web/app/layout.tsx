import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "knowledge-hub",
  description: "knowledge-hub",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
