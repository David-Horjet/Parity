import type { Metadata, Viewport } from "next";
import { Playfair_Display, Roboto } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Parity: pre-IPO perpetuals",
  description: "Trade private companies with leverage, 24/7, on Solana. Long or short PreStocks with up to 5x.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#081231" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${playfair.variable}`}>
      <body className="overflow-x-hidden">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
