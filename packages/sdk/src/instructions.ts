import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import type { Side } from "./constants";
import { lpPda, marketPda, positionPda, protocolPda, symbolBytes, vaultPda } from "./pda";
import { bn, sideArg, type MarketConfigView, type ParityProgram } from "./program";

const U64_MAX = (1n << 64n) - 1n;

export interface TradeAccounts {
  owner: PublicKey;
  market: PublicKey;
  collateralMint: PublicKey;
}

function common(a: TradeAccounts) {
  return {
    protocol: protocolPda(),
    market: a.market,
    vault: vaultPda(a.market),
    ownerToken: getAssociatedTokenAddressSync(a.collateralMint, a.owner),
    collateralMint: a.collateralMint,
    tokenProgram: TOKEN_PROGRAM_ID,
  };
}

/** Slippage bound: worst price the trader accepts, or no bound. */
export function acceptablePrice(side: Side, opening: boolean, price?: bigint, slippageBps = 100) {
  const buying = (side === "long") === opening;
  if (price === undefined) return buying ? U64_MAX : 0n;
  const band = (price * BigInt(slippageBps)) / 10_000n;
  return buying ? price + band : price - band;
}

export function openPositionIx(
  program: ParityProgram,
  a: TradeAccounts & { side: Side; margin: bigint; size: bigint; acceptablePrice: bigint },
): Promise<TransactionInstruction> {
  return program.methods
    .openPosition(sideArg(a.side), bn(a.margin), bn(a.size), bn(a.acceptablePrice))
    .accountsPartial({
      owner: a.owner,
      position: positionPda(a.market, a.owner, a.side),
      systemProgram: SystemProgram.programId,
      ...common(a),
    })
    .instruction();
}

export function closePositionIx(
  program: ParityProgram,
  a: TradeAccounts & { side: Side; acceptablePrice: bigint },
): Promise<TransactionInstruction> {
  return program.methods
    .closePosition(bn(a.acceptablePrice))
    .accountsPartial({
      owner: a.owner,
      position: positionPda(a.market, a.owner, a.side),
      ...common(a),
    })
    .instruction();
}

export function liquidateIx(
  program: ParityProgram,
  a: { liquidator: PublicKey; owner: PublicKey; market: PublicKey; side: Side; collateralMint: PublicKey },
): Promise<TransactionInstruction> {
  return program.methods
    .liquidate()
    .accountsPartial({
      liquidator: a.liquidator,
      owner: a.owner,
      protocol: protocolPda(),
      market: a.market,
      position: positionPda(a.market, a.owner, a.side),
      vault: vaultPda(a.market),
      liquidatorToken: getAssociatedTokenAddressSync(a.collateralMint, a.liquidator),
      collateralMint: a.collateralMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export function updatePriceIx(program: ParityProgram, keeper: PublicKey, market: PublicKey, price: bigint) {
  return program.methods
    .updatePrice(bn(price))
    .accountsPartial({ keeper, protocol: protocolPda(), market })
    .instruction();
}

export function depositLiquidityIx(program: ParityProgram, a: TradeAccounts & { amount: bigint }) {
  return program.methods
    .depositLiquidity(bn(a.amount))
    .accountsPartial({
      owner: a.owner,
      lpPosition: lpPda(a.market, a.owner),
      systemProgram: SystemProgram.programId,
      ...common(a),
    })
    .instruction();
}

export function withdrawLiquidityIx(program: ParityProgram, a: TradeAccounts & { shares: bigint }) {
  return program.methods
    .withdrawLiquidity(bn(a.shares))
    .accountsPartial({
      owner: a.owner,
      lpPosition: lpPda(a.market, a.owner),
      ...common(a),
    })
    .instruction();
}

export function initializeProtocolIx(
  program: ParityProgram,
  a: { admin: PublicKey; keeper: PublicKey; collateralMint: PublicKey },
) {
  return program.methods
    .initializeProtocol(a.keeper)
    .accountsPartial({
      admin: a.admin,
      protocol: protocolPda(),
      collateralMint: a.collateralMint,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function configArg(c: MarketConfigView) {
  return {
    maxLeverage: c.maxLeverage,
    maintenanceMarginBps: c.maintenanceMarginBps,
    tradingFeeBps: c.tradingFeeBps,
    liquidationFeeBps: c.liquidationFeeBps,
    minMargin: bn(c.minMargin),
    maxPositionSize: bn(c.maxPositionSize),
    maxOpenInterest: bn(c.maxOpenInterest),
    maxOiToLiquidityBps: c.maxOiToLiquidityBps,
    maxPriceAgeSecs: c.maxPriceAgeSecs,
    maxPriceMoveBps: c.maxPriceMoveBps,
    maxFundingRateBpsPerHour: c.maxFundingRateBpsPerHour,
  };
}

export function createMarketIx(
  program: ParityProgram,
  a: { admin: PublicKey; symbol: string; assetMint: PublicKey; collateralMint: PublicKey; config: MarketConfigView },
) {
  const market = marketPda(a.symbol);
  return program.methods
    .createMarket(symbolBytes(a.symbol), a.assetMint, configArg(a.config))
    .accountsPartial({
      admin: a.admin,
      protocol: protocolPda(),
      market,
      vault: vaultPda(market),
      collateralMint: a.collateralMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function updateMarketConfigIx(
  program: ParityProgram,
  a: { admin: PublicKey; market: PublicKey; config: MarketConfigView },
) {
  return program.methods
    .updateMarketConfig(configArg(a.config))
    .accountsPartial({ admin: a.admin, protocol: protocolPda(), market: a.market })
    .instruction();
}

/** Default risk config for devnet markets. */
export const DEFAULT_MARKET_CONFIG: MarketConfigView = {
  maxLeverage: 5,
  maintenanceMarginBps: 500,
  tradingFeeBps: 10,
  liquidationFeeBps: 100,
  minMargin: 1_000_000n,
  maxPositionSize: 10_000_000_000n,
  maxOpenInterest: 50_000_000_000n,
  maxOiToLiquidityBps: 5_000,
  maxPriceAgeSecs: 120,
  maxPriceMoveBps: 300,
  maxFundingRateBpsPerHour: 5,
};
