/**
 * One-time devnet setup: USDC mint, protocol, one market per eligible PreStocks
 * asset, and seed LP liquidity. Safe to re-run; existing state is skipped.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { fetchPreStocksAssets, toMarkets } from "@parity/prestocks";
import {
  DEFAULT_MARKET_CONFIG,
  createMarketIx,
  depositLiquidityIx,
  fetchMarket,
  getProgram,
  initializeProtocolIx,
  marketPda,
  protocolPda,
} from "@parity/sdk";
import { connection, loadKeypair, rootDir } from "./env";
import { log, send } from "./tx";

const SEED_LIQUIDITY = 100_000n * 1_000_000n;

function ensureKeypair(file: string): Keypair {
  const path = resolve(rootDir, file);
  if (existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  log("bootstrap", `created ${file} ${kp.publicKey.toBase58()}`);
  return kp;
}

async function main() {
  const conn = connection();
  const admin = loadKeypair("DEPLOYER_KEYPAIR", ".keys/deployer.json");
  const keeper = ensureKeypair(".keys/keeper.json");
  const faucet = ensureKeypair(".keys/faucet.json");
  const program = getProgram(conn, admin.publicKey);

  // Fund service wallets from the deployer.
  for (const [name, kp, target] of [
    ["keeper", keeper, 2],
    ["faucet", faucet, 3],
  ] as const) {
    const bal = await conn.getBalance(kp.publicKey);
    if (bal < LAMPORTS_PER_SOL) {
      await send(conn, admin, [
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: kp.publicKey,
          lamports: target * LAMPORTS_PER_SOL,
        }),
      ]);
      log("bootstrap", `funded ${name} with ${target} SOL`);
    }
  }

  // Devnet USDC: 6 decimals, minted by the faucet key.
  const statePath = resolve(rootDir, ".keys/devnet.json");
  const state: { usdcMint?: string } = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  if (!state.usdcMint) {
    const mint = await createMint(conn, admin, faucet.publicKey, null, 6);
    state.usdcMint = mint.toBase58();
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    log("bootstrap", `created USDC mint ${state.usdcMint}`);
  }
  const usdc = new PublicKey(state.usdcMint);

  if (!(await conn.getAccountInfo(protocolPda()))) {
    await send(conn, admin, [
      await initializeProtocolIx(program, { admin: admin.publicKey, keeper: keeper.publicKey, collateralMint: usdc }),
    ]);
    log("bootstrap", "initialized protocol");
  }

  const markets = toMarkets(await fetchPreStocksAssets());
  const adminAta = getAssociatedTokenAddressSync(usdc, admin.publicKey);
  await send(
    conn,
    admin,
    [
      createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, adminAta, admin.publicKey, usdc),
      createMintToInstruction(usdc, adminAta, faucet.publicKey, SEED_LIQUIDITY * BigInt(markets.length)),
    ],
    [faucet],
  );

  for (const m of markets) {
    const address = marketPda(m.symbol);
    let onchain = await fetchMarket(program, address);
    if (!onchain) {
      await send(conn, admin, [
        await createMarketIx(program, {
          admin: admin.publicKey,
          symbol: m.symbol,
          assetMint: new PublicKey(m.mint),
          collateralMint: usdc,
          config: DEFAULT_MARKET_CONFIG,
        }),
      ]);
      log("bootstrap", `created market ${m.symbol} ${address.toBase58()}`);
      onchain = await fetchMarket(program, address);
    }
    if (onchain && onchain.lpShares === 0n) {
      await send(conn, admin, [
        await depositLiquidityIx(program, {
          owner: admin.publicKey,
          market: address,
          collateralMint: usdc,
          amount: SEED_LIQUIDITY,
        }),
      ]);
      log("bootstrap", `seeded ${m.symbol} with 100k USDC`);
    }
  }

  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_USDC_MINT=${usdc.toBase58()}`);
  console.log(`NEXT_PUBLIC_PROGRAM_ID=${program.programId.toBase58()}`);
  console.log(`KEEPER_PUBKEY=${keeper.publicKey.toBase58()}`);
  console.log(`FAUCET_PUBKEY=${faucet.publicKey.toBase58()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
