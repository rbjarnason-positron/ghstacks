import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Stacks — Your work, in order",
  description:
    "Your GitHub stacks, pull requests, checks, and reviews. A clear path from a stack of changes to a shipped idea.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
