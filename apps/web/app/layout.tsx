import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

const heading = Manrope({
  subsets: ["latin"],
  variable: "--font-heading"
});

export const metadata: Metadata = {
  title: "TimesheetPlus",
  description: "Tenant-aware activity management"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body
        style={{
          fontFamily: "var(--font-body), sans-serif"
        }}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
