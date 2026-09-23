import type { Metadata, Viewport } from "next";
import { Playfair_Display, Roboto } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--font-roboto" });
// Accent face only: reserved for a word or two in hero-level headings.
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Parity: pre-IPO perpetuals",
  description: "Trade private companies with leverage, 24/7, on Solana. Long or short PreStocks with up to 5x.",
  icons: { icon: "/images/logos/1.png", apple: "/images/logos/1.png" },
};

export const viewport: Viewport = { themeColor: "#050505" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${playfair.variable}`}>
      <body className="overflow-x-hidden font-sans">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
