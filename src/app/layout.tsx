import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Playfair_Display, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/app/mobile-nav";
import { DesktopSidebar } from "@/components/app/desktop-sidebar";

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
        <div className="flex min-h-screen w-full items-stretch justify-center bg-black sm:bg-zinc-950">
          <DesktopSidebar />
          <div className="relative flex h-screen w-full max-w-[390px] flex-col overflow-hidden bg-[#0D0D0F] text-accent-white shadow-2xl sm:h-[844px] sm:max-h-[844px] sm:rounded-[40px] sm:border sm:border-white/10 lg:h-screen lg:max-h-none lg:max-w-none lg:rounded-none lg:border-0 lg:shadow-none lg:ml-72">
            <div className="relative z-0 flex-1 overflow-y-auto pb-[80px] scrollbar-none app-background lg:pb-6">
              {children}
            </div>
            <MobileNav />
          </div>
        </div>
      </body>
    </html>
  );
}
