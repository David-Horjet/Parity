/**
 * End-to-end check against devnet and the running app (localhost:3000):
 * faucet -> open long -> read position -> close -> trade history indexed -> open short.
 */
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { acceptablePrice, closePositionIx, fetchMarket, getProgram, marketPda, openPositionIx } from "@parity/sdk";
import { connection, loadKeypair, usdcMint } from "../src/env";
import { send } from "../src/tx";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const conn = connection();
const usdc = usdcMint();

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${APP}${path}`, body ? { method: "POST", body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error}`);
  return json as T;
}

function check(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok  ${msg}`);
}

async function main() {
  const trader = Keypair.generate();
  const admin = loadKeypair("DEPLOYER_KEYPAIR", ".keys/deployer.json");
  await send(conn, admin, [
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: trader.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL }),
  ]);

  const faucet = await api<{ usdc: number }>("/api/faucet", { wallet: trader.publicKey.toBase58() });
  check(faucet.usdc > 0, `faucet sent ${faucet.usdc} USDC`);

  const program = getProgram(conn, trader.publicKey);
  const market = marketPda("ANTHROPIC");
  const m = (await fetchMarket(program, market))!;
  check(m.price > 0n, `ANTHROPIC price ${Number(m.price) / 1e6}`);

  const accounts = { owner: trader.publicKey, market, collateralMint: usdc };
  const ata = createAssociatedTokenAccountIdempotentInstruction(
    trader.publicKey,
    getAssociatedTokenAddressSync(usdc, trader.publicKey),
    trader.publicKey,
    usdc,
  );
  const openSig = await send(conn, trader, [
    ata,
    await openPositionIx(program, {
      ...accounts,
      side: "long",
      margin: 100_000_000n,
      size: 500_000_000n,
      acceptablePrice: acceptablePrice("long", true, m.price, 200),
    }),
  ]);
  await api("/api/index-tx", { signature: openSig });

  const { positions } = await api<{ positions: { side: string; size: string; symbol: string }[] }>(
    `/api/positions/${trader.publicKey.toBase58()}`,
  );
  check(positions.length === 1 && positions[0]!.side === "long" && positions[0]!.size === "500000000", "long 5x visible via API");

  const now = (await fetchMarket(program, market))!;
  const closeSig = await send(conn, trader, [
    await closePositionIx(program, { ...accounts, side: "long", acceptablePrice: acceptablePrice("long", false, now.price, 200) }),
  ]);
  const indexed = await api<{ indexed: number }>("/api/index-tx", { signature: closeSig });
  check(indexed.indexed === 1, "close indexed");

  const { trades } = await api<{ trades: { kind: string; pnl: number | null }[] }>(`/api/trades/${trader.publicKey.toBase58()}`);
  check(trades.length === 2 && trades.some((t) => t.kind === "close"), `history has open+close (pnl ${trades.find((t) => t.kind === "close")?.pnl})`);

  const shortSig = await send(conn, trader, [
    await openPositionIx(program, {
      ...accounts,
      side: "short",
      margin: 50_000_000n,
      size: 100_000_000n,
      acceptablePrice: acceptablePrice("short", true, now.price, 200),
    }),
  ]);
  await api("/api/index-tx", { signature: shortSig });
  const after = await api<{ positions: { side: string }[] }>(`/api/positions/${trader.publicKey.toBase58()}`);
  check(after.positions.some((p) => p.side === "short"), "short 2x open");
  console.log(`\ntrader ${trader.publicKey.toBase58()}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
