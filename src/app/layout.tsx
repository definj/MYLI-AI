import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Playfair_Display, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

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
        {children}
      </body>
    </html>
  );
}
