# Parity — Product PRD

## 1. Product

**Trade pre-IPO companies with leverage, 24/7..**

Parity is a perpetual trading market for PreStocks' tokenized pre-IPO companies.

Users deposit USDC and take leveraged LONG or SHORT positions on eligible PreStocks assets.

### One-line pitch

**Trade private companies with leverage, 24/7, on Solana.**

---

# 2. PreStocks Resources

The implementation must use the official PreStocks resources:

* **PreStocks:** https://prestocks.com/
* **Products:** https://prestocks.com/products
* **API:** https://prestocks.com/api/prestocks
* **Ecosystem:** https://prestocks.com/ecosystem
* **FAQ / Mechanics:** https://prestocks.com/faq?tab=mechanics
* **X:** https://x.com/PreStocks

Claude should read and understand these resources before implementation.

**Important:** The product must use only PreStocks pre-IPO assets for the PreStocks hackathon bounty. Do not integrate non-PreStocks pre-IPO tokens.

---

# 3. Core Idea

PreStocks gives users tokenized exposure to private companies.

Parity adds the derivatives layer:

**LONG + SHORT + LEVERAGE**

Users trade synthetic perpetual positions using USDC collateral while the position price follows the relevant PreStocks market price.

---

# 4. Initial Markets

Do not hardcode a fixed market list without checking the current PreStocks API.

At the time of writing, suitable active examples include:

* OpenAI
* Anthropic
* Anduril
* Neuralink

SpaceX and xAI should **not** be included in the initial market list because their PreStocks pages now indicate that they have undergone public/acquisition changes and their existing tokens have conversion/expiry mechanics.

The application should dynamically discover eligible/current PreStocks assets from the official API.

---

# 5. Target User

Crypto-native traders who understand:

* perpetuals
* leverage
* LONG/SHORT
* USDC
* Solana wallets

The interface should feel like a simple crypto perp trading terminal, not a traditional brokerage.

---

# 6. Core Trading Experience

User:

1. Connects wallet
2. Selects a PreStocks company
3. Enters USDC margin
4. Selects leverage
5. Chooses LONG or SHORT
6. Reviews position details
7. Signs transaction
8. Position opens
9. PnL updates with the market price
10. User closes the position

Initial leverage:

**1x–5x**

Use conservative limits for the MVP.

---

# 7. Main Trading Screen

The primary screen should contain:

* Market selector
* Company name
* Current mark price
* Implied valuation where relevant
* Price chart
* LONG button
* SHORT button
* Margin input
* Leverage selector
* Position size
* Estimated liquidation price
* Trading fee
* Current open position

Keep the interface extremely simple.

---

# 8. Position

Example:

```text
OPENAI LONG 5x

Margin        $100
Position      $500

Entry         $X
Mark          $X

PnL           +$18.40
Liquidation   $X

[ CLOSE ]
```

Users must be able to see their position and PnL immediately after opening.

---

# 9. Shorting

Short positions should work exactly like longs but with inverse PnL.

Users should be able to:

* Open LONG
* Open SHORT
* Close either position

---

# 10. Liquidation

Every position must have a liquidation price.

When the position falls below the required maintenance margin, it becomes liquidatable.

The UI should clearly display the liquidation price before the user opens the position.

---

# 11. Fees

Use a simple configurable trading fee.

The exact rate should be configurable by the protocol rather than hardcoded throughout the application.

Before confirming a trade, show:

* Margin
* Position size
* Leverage
* Trading fee
* Estimated liquidation price

---

# 12. Funding

A simple funding mechanism can be added after the core trading flow works.

Basic concept:

* Excess long interest → longs pay shorts
* Excess short interest → shorts pay longs

Keep the implementation simple and configurable.

---

# 13. Liquidity

Each market can have a USDC liquidity vault that acts as the counterparty to trader positions.

Example:

```text
OPENAI-PERP

Liquidity       $50,000
Maximum OI      $25,000
```

The protocol must prevent traders from creating more exposure than the market can safely support.

---

# 14. Portfolio

Show:

```text
Balance
Available Margin
Used Margin
Unrealized PnL
Open Positions
```

Users can view all active positions.

---

# 15. Trading History

Record:

* Market
* Direction
* Entry
* Exit
* Position size
* Leverage
* PnL
* Fees
* Timestamp

---

# 16. PreStocks Data

Use the official PreStocks API as the source for:

* eligible assets
* token addresses
* token information
* mark prices
* token prices
* implied valuation
* relevant metadata

PreStocks currently exposes token price, implied valuation, mark price, mark valuation and token address information on its products page.

Use **mark price** as the primary price reference where appropriate.

Do not blindly treat the token's raw DEX price as the perp index.

---

# 17. Position Model

The first version should use:

**Oracle-priced synthetic perpetuals with isolated margin.**

Users do not need to deposit the underlying PreStocks token to open a position.

They deposit USDC and receive synthetic LONG/SHORT exposure.

This is the proposed model, not a rigid requirement. Claude should review the PreStocks mechanics, available infrastructure and implementation constraints and **improvise or change the model if another architecture is materially better, safer or faster to implement.**

Do not force the system into an AMM, order book or oracle model simply because this PRD proposes one.

---

# 18. Hackathon Differentiator

Do not present Parity as another tokenized-stock interface.

Position it as:

> **The derivatives layer for PreStocks.**

PreStocks provides exposure to private companies.

Parity lets traders actively trade that exposure:

**LONG. SHORT. LEVERAGE. 24/7.**

PreStocks explicitly lists derivatives, DeFi integrations, leverage and related trading use cases as areas they want builders to explore.

---

# 19. MVP Requirements

### Must have

* Solana wallet connection through Privy
* USDC collateral
* PreStocks market discovery
* PreStocks price integration
* LONG
* SHORT
* 1–5x leverage
* Position creation
* PnL
* Liquidation
* Position closing
* Trading fees
* Position history
* Clean trading UI

### If time allows

* Funding
* LP vault
* LP dashboard
* Better historical charts
* Market statistics

Do not delay the core trading flow for secondary features.

---

# 20. Success Criteria

A judge should be able to:

1. Connect wallet
2. See available PreStocks markets
3. Select a company
4. Enter USDC margin
5. Select leverage
6. Open a LONG
7. See the position
8. See PnL change
9. Close the position
10. Open a SHORT
11. See liquidation information

The complete flow should work without requiring verbal explanation.

---

# 21. Product Positioning

### Name

**Parity**

### Category

**Pre-IPO perpetuals**

### Tagline

**Trade private companies with leverage.**

### Description

**Parity is a Solana-native perpetual market for leveraged LONG and SHORT exposure to PreStocks' tokenized pre-IPO companies.**
