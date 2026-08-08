import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/api/auth";
import "./globals.css";

const spaceGrotesk = localFont({
  variable: "--font-space-grotesk",
  src: [
    { path: "../public/fonts/SpaceGrotesk-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/SpaceGrotesk-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/SpaceGrotesk-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/SpaceGrotesk-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kudimata Desk",
  description: "Kudimata Securities — internal operations desk",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
