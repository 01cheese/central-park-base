import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Central Park",
  description: "Zero-Knowledge encrypted vault ecosystem",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" className={dmMono.variable}>
      <body className="antialiased bg-[#080b0f]">{children}</body>
      </html>
  );
}