import { Connection, PublicKey } from "@solana/web3.js";

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT || "9nfRPucZzZjTpKXniuQpf7hij5LYKEYaur687MZCmV3w");
export const CLUSTER = "devnet" as const;
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

let conn: Connection | null = null;
export function getConnection() {
  conn ??= new Connection(RPC_URL, "confirmed");
  return conn;
}

export const explorerTx = (sig: string) => `https://solscan.io/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAccount = (a: string) => `https://solscan.io/account/${a}?cluster=${CLUSTER}`;
