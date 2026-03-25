import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Playfair_Display, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "@/components/app/desktop-sidebar";
import { MainColumn } from "@/components/app/main-column";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MYLI | Lifestyle Intelligence",
  description: "A premium, minimalist-luxury platform for lifestyle intelligence.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0A0A0A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${playfair.variable} antialiased selection:bg-accent-gold/30 selection:text-accent-white`}
      >
        <div className="flex min-h-screen w-full items-stretch justify-center bg-[#0D0D0F] sm:bg-zinc-950">
          <DesktopSidebar />
          <MainColumn>{children}</MainColumn>
        </div>
      </body>
    </html>
  );
}
