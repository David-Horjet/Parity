import { config } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Single .env at the repo root, shared with the keeper.
config({ path: resolve(process.cwd(), "../.env"), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@parity/sdk", "@parity/prestocks"],
  env: {
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_API_ID,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT,
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "www.prestocks.com" }] },
};

export default nextConfig;
