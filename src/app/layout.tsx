import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AP Exception Resolution Agent",
    template: "%s | AP Exception Resolution Agent",
  },
  description:
    "Demo of agentic accounts-payable exception resolution: deterministic matching, a bounded AI agent, deterministic governance, human review and evaluation.",
};

// Pages read the in-memory demo state, which changes when a review is
// submitted, so they render per request rather than at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
