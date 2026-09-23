# Parity — Technical PRD

## 1. Technical Goal

Build a Solana-based perpetual trading protocol for eligible PreStocks assets.

The MVP must support:

* USDC collateral
* LONG / SHORT
* 1–5x leverage
* PnL
* Liquidation
* Trading fees
* PreStocks price updates
* Position history

Use isolated margin initially.

---

# 2. Required Resources

### PreStocks

* https://prestocks.com/
* https://prestocks.com/products
* https://prestocks.com/api/prestocks
* https://prestocks.com/ecosystem
* https://prestocks.com/faq?tab=mechanics
* https://x.com/PreStocks

Claude must read these resources and inspect the actual API response/schema before implementing the PreStocks adapter.

Do not assume the API structure from this PRD.

---

# 3. Important Implementation Rule

**The architecture in this PRD is a recommended starting point, not the final technical decision.**

Claude should evaluate:

* PreStocks API/mechanics
* available Solana infrastructure
* existing perp implementations
* oracle options
* liquidity requirements
* security implications
* hackathon timeline

If another implementation is substantially better, safer, simpler or faster, Claude should adapt the architecture.

Do not blindly follow this PRD when the actual documentation suggests a better approach.

---

# 4. Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS
* Font - Roboto(primary), Playfair(secondary)
* Animations - Framer-motion
* Icons - Hugeicons
* Brand color: Primary: #081231, dark mode
* **Privy for Solana wallet connection/authentication**
* Solana tooling required by Privy/integration

Do not build a separate wallet authentication system.

### Smart Contract

* Rust
* Anchor
* Solana

### Backend

* TypeScript / Node.js
* **Supabase**
* Supabase PostgreSQL for application database

### Keeper / Price Service

* TypeScript / Node.js
* PreStocks API
* Onchain price publishing

---

# 5. Architecture

Recommended starting architecture:

```text
                    PreStocks API
                         │
                         ↓
                  Price / Data Keeper
                         │
                  validated price
                         │
                         ↓
Frontend ─────────→ Solana Program
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
          Positions    Markets    USDC Vault
                         │
                         ↓
                     Supabase
                  indexing/history
```

The exact architecture may be changed after reviewing the actual PreStocks documentation and available infrastructure.

---

# 6. PreStocks Adapter

Create a dedicated module:

```text
prestocks/
  client.ts
  markets.ts
  prices.ts
  validation.ts
```

Responsibilities:

* fetch eligible PreStocks assets
* fetch asset metadata
* fetch token addresses
* fetch mark price
* normalize responses
* validate data
* expose a clean internal market format

The app should dynamically discover current eligible markets instead of relying on a permanently hardcoded list.

---

# 7. Market Account

Each market represents one PreStocks asset.

Example:

```text
OPENAI-PERP
ANTHROPIC-PERP
ANDURIL-PERP
NEURALINK-PERP
```

Suggested market state:

```text
market
- id
- assetId
- tokenMint
- symbol
- oracle
- collateralMint
- vault
- maxLeverage
- maintenanceMargin
- tradingFee
- maxOpenInterest
- currentLongOI
- currentShortOI
- active
```

Claude may modify this structure if required.

---

# 8. Position Account

Suggested position state:

```text
position
- owner
- market
- side
- margin
- size
- leverage
- entryPrice
- lastFundingPrice
- liquidationPrice
- openedAt
- updatedAt
```

Use fixed-point integer arithmetic.

Never use floating-point arithmetic inside the Solana program.

---

# 9. Perp Model

Recommended initial model:

## Oracle-priced synthetic perpetual

Example:

```text
$100 margin
5x leverage
=
$500 position
```

The user does not need to deposit the underlying PreStocks token.

The position represents synthetic exposure to the PreStocks mark price.

However, Claude should compare this against:

* existing perp infrastructure
* AMM/vAMM
* order book
* external execution infrastructure

and choose the best implementation if another option is more appropriate.

---

# 10. Price System

Recommended flow:

```text
PreStocks API
     ↓
Price keeper
     ↓
Validation
     ↓
Onchain price account
     ↓
Perp program
```

Validation should include:

* valid response
* timestamp
* staleness
* abnormal movement
* correct asset
* expected price format

The Solana program must never depend on directly calling an HTTP API.

---

# 11. Onchain Price Account

Suggested structure:

```text
price
- market
- price
- timestamp
- status
- publisher
```

Only authorized price publishers can update it.

The program must reject stale prices.

The exact oracle architecture can be changed if a better supported oracle/infrastructure option is identified during implementation.

---

# 12. Open Position

Flow:

```text
User
 ↓
USDC approval
 ↓
Open Position
 ↓
Read current valid price
 ↓
Calculate position size
 ↓
Calculate liquidation price
 ↓
Transfer margin to vault
 ↓
Create position
```

Basic position size:

```text
size = margin × leverage
```

---

# 13. PnL

Long:

```text
PnL =
size × (currentPrice - entryPrice) / entryPrice
```

Short:

```text
PnL =
size × (entryPrice - currentPrice) / entryPrice
```

Implement with safe fixed-point arithmetic.

---

# 14. Liquidation

A position becomes liquidatable when its equity falls below the required maintenance margin.

Liquidation should:

1. Verify the position
2. Verify current valid price
3. Verify liquidation condition
4. Calculate final PnL
5. Close the position
6. Settle remaining funds
7. Apply liquidation fee where applicable
8. Send applicable amount to insurance/vault

Liquidation should be permissionless so anyone can trigger an eligible liquidation.

---

# 15. Market Risk Controls

Each market should support:

* Maximum leverage
* Maximum position size
* Maximum total open interest
* Maintenance margin
* Maximum price age
* Market pause

These values should be configurable.

Start conservatively.

---

# 16. USDC Vault

Each market has a USDC liquidity vault.

The vault provides counterparty liquidity.

Example:

```text
OPENAI-PERP

Vault: $50,000
Maximum OI: $25,000
```

The system must prevent positions that exceed available market risk limits.

---

# 17. Fees

Suggested calculation:

```text
fee = positionSize × feeRate
```

Fees can be distributed between:

* protocol treasury
* market vault
* insurance fund

The exact split is configurable.

---

# 18. Funding

Implement after basic trading is working.

Suggested mechanism:

```text
Long OI > Short OI
→ longs pay shorts

Short OI > Long OI
→ shorts pay longs
```

Funding must be bounded and safe.

If a better established funding model is discovered during implementation, use it.

---

# 19. Insurance

Maintain an insurance balance per market or at protocol level.

Use it for:

* bad debt
* liquidation losses
* rounding issues

Keep it simple for the hackathon.

---

# 20. Admin

Admin should be able to:

* Create markets
* Pause markets
* Update fees
* Update leverage
* Update maintenance margin
* Update maximum OI
* Authorize price publishers
* Update risk parameters

Use a secure admin wallet/multisig where practical.

---

# 21. Anchor Instructions

Initial instruction set:

```text
initialize_protocol()
create_market()
update_price()
deposit()
withdraw()
open_position()
close_position()
liquidate()
update_market_config()
pause_market()
```

If LP functionality is implemented:

```text
deposit_liquidity()
withdraw_liquidity()
```

Claude may modify this instruction set based on the final architecture.

---

# 22. Frontend

Use **Privy** for wallet connection and authentication.

Main trading flow:

```text
Connect Wallet
      ↓
Select PreStocks Market
      ↓
Enter Margin
      ↓
Select Leverage
      ↓
LONG / SHORT
      ↓
Show:
- Position Size
- Entry
- Liquidation
- Fee
      ↓
Confirm Transaction
      ↓
Position Open
```

---

# 23. Supabase

Use Supabase/PostgreSQL for application-level data:

* Market metadata/cache
* Trade history
* Position history
* User activity
* Price history
* Charts
* Analytics
* Transaction indexing

Supabase must **not** be the source of truth for:

* user balances
* collateral
* open positions
* liquidation state

Those remain onchain.

---

# 24. Backend API

Suggested endpoints:

```text
GET /markets
GET /markets/:id
GET /markets/:id/history
GET /positions/:wallet
GET /trades/:wallet
```

The backend indexes Solana events/accounts and exposes convenient read APIs.

---

# 25. Security

Must include:

### Price

* stale-price rejection
* invalid-price rejection
* abnormal movement protection

### Positions

* maximum leverage
* maximum position size
* maximum OI
* minimum margin
* liquidation checks

### Solana program

* checked arithmetic
* signer validation
* PDA validation
* token mint validation
* account ownership validation
* market validation
* paused-market checks
* safe token transfers

Do not introduce unnecessary program complexity.

---

# 26. Testing

Test:

### Trading

* Open LONG
* Open SHORT
* Close LONG
* Close SHORT
* Multiple markets
* Insufficient margin
* Insufficient liquidity

### Pricing

* Valid price
* Stale price
* Invalid price
* Large price movement

### Liquidation

* Healthy position
* Near-liquidation position
* Liquidatable position
* Permissionless liquidation

### Security

* Unauthorized price update
* Unauthorized admin
* Wrong market
* Wrong token
* Wrong signer
* Overflow/underflow

---

# 27. Deployment

Deploy:

* Solana program
* Price keeper
* Backend
* Supabase
* Frontend

The final demo should use real eligible PreStocks market data.

Keep market exposure and risk limits conservative.

---

# 28. Build Priority

### P0 — Must work

1. PreStocks API integration
2. Market discovery
3. Price system
4. USDC collateral
5. Open LONG
6. Open SHORT
7. PnL
8. Close
9. Liquidation
10. Privy wallet
11. Supabase indexing
12. Clean UI

### P1

13. Multiple markets
14. Trading history
15. Funding
16. Liquidity vault UI

### P2

17. Advanced analytics
18. Better charts
19. LP dashboard
20. Additional polish

Do not let P1/P2 delay P0.

---

# 29. Critical Constraint

Parity is being built specifically for the **PreStocks Best Use of PreStocks bounty**.

Therefore:

**Do not integrate non-PreStocks pre-IPO tokens.**

Do not add Tessera, other pre-IPO issuers, or unrelated pre-IPO assets to the bounty implementation.

Only use eligible PreStocks assets.

---

# 30. Final Technical Principle

This PRD gives the intended product direction and a recommended technical starting point.

**It is not a command to blindly implement every architectural decision exactly as written.**

Claude should:

1. Read the linked PreStocks documentation.
2. Inspect the actual API.
3. Check the current PreStocks mechanics.
4. Evaluate available Solana infrastructure.
5. Identify the fastest safe architecture.
6. Change the proposed oracle/AMM/order-book/external-infrastructure model if necessary.
7. Prioritize a working end-to-end product over unnecessary infrastructure.

The goal is not to build the most complicated perp protocol.

The goal is to build the **best working derivatives product around PreStocks within the hackathon timeline.**
