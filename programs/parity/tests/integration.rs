use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::instruction::Instruction,
        system_program, AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    litesvm_token::{get_spl_account, spl_token, CreateAssociatedTokenAccount, CreateMint, MintTo},
    parity::{
        constants::*,
        state::{Market, MarketConfig, Position, Side},
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const USDC: u64 = 1_000_000;

fn usd(v: u64) -> u64 {
    v * USDC
}

fn default_config() -> MarketConfig {
    MarketConfig {
        max_leverage: 5,
        maintenance_margin_bps: 500,
        trading_fee_bps: 10,
        liquidation_fee_bps: 100,
        min_margin: usd(1),
        max_position_size: usd(10_000),
        max_open_interest: usd(50_000),
        max_oi_to_liquidity_bps: 5_000,
        max_price_age_secs: 120,
        max_price_move_bps: 1_000,
        max_funding_rate_bps_per_hour: 10,
    }
}

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    keeper: Keypair,
    mint: Pubkey,
    protocol: Pubkey,
}

struct User {
    kp: Keypair,
    ata: Pubkey,
}

impl Env {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program(parity::id(), include_bytes!("../../../target/deploy/parity.so"))
            .unwrap();
        let admin = Keypair::new();
        let keeper = Keypair::new();
        svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap();
        svm.airdrop(&keeper.pubkey(), 10_000_000_000).unwrap();
        let mint = CreateMint::new(&mut svm, &admin)
            .authority(&admin.pubkey())
            .decimals(6)
            .send()
            .unwrap();
        let protocol = Pubkey::find_program_address(&[PROTOCOL_SEED], &parity::id()).0;
        let mut env = Env { svm, admin, keeper, mint, protocol };
        env.set_time(1_700_000_000);

        let ix = Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::InitializeProtocol { keeper: env.keeper.pubkey() }.data(),
            parity::accounts::InitializeProtocol {
                admin: env.admin.pubkey(),
                protocol: env.protocol,
                collateral_mint: env.mint,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        env.send(&[ix], &[&env.admin.insecure_clone()]).unwrap();
        env
    }

    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let msg = Message::new_with_blockhash(ixs, Some(&signers[0].pubkey()), &self.svm.latest_blockhash());
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    fn set_time(&mut self, ts: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();
        clock.unix_timestamp = ts;
        self.svm.set_sysvar(&clock);
    }

    fn advance(&mut self, secs: i64) {
        let ts = self.now() + secs;
        self.set_time(ts);
    }

    fn user(&mut self, usdc: u64) -> User {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
        let admin = self.admin.insecure_clone();
        let ata = CreateAssociatedTokenAccount::new(&mut self.svm, &admin, &self.mint)
            .owner(&kp.pubkey())
            .send()
            .unwrap();
        if usdc > 0 {
            MintTo::new(&mut self.svm, &admin, &self.mint, &ata, usdc)
                .owner(&admin)
                .send()
                .unwrap();
        }
        User { kp, ata }
    }

    fn balance(&self, ata: &Pubkey) -> u64 {
        get_spl_account::<spl_token::state::Account>(&self.svm, ata).unwrap().amount
    }

    fn market_pda(symbol: &str) -> Pubkey {
        let bytes = parity::math::symbol_bytes(symbol).unwrap();
        Pubkey::find_program_address(&[MARKET_SEED, &bytes], &parity::id()).0
    }

    fn vault_pda(market: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(&[VAULT_SEED, market.as_ref()], &parity::id()).0
    }

    fn position_pda(market: &Pubkey, owner: &Pubkey, side: Side) -> Pubkey {
        Pubkey::find_program_address(
            &[POSITION_SEED, market.as_ref(), owner.as_ref(), &[side as u8]],
            &parity::id(),
        )
        .0
    }

    fn lp_pda(market: &Pubkey, owner: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(&[LP_SEED, market.as_ref(), owner.as_ref()], &parity::id()).0
    }

    fn create_market_ix(&self, signer: &Pubkey, symbol: &str, config: MarketConfig) -> Instruction {
        let market = Self::market_pda(symbol);
        Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::CreateMarket {
                symbol: parity::math::symbol_bytes(symbol).unwrap(),
                asset_mint: Pubkey::new_unique(),
                config,
            }
            .data(),
            parity::accounts::CreateMarket {
                admin: *signer,
                protocol: self.protocol,
                market,
                vault: Self::vault_pda(&market),
                collateral_mint: self.mint,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        )
    }

    fn create_market(&mut self, symbol: &str) -> Pubkey {
        let ix = self.create_market_ix(&self.admin.pubkey(), symbol, default_config());
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &[&admin]).unwrap();
        Self::market_pda(symbol)
    }

    fn price_ix(&self, signer: &Pubkey, market: &Pubkey, price: u64) -> Instruction {
        Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::UpdatePrice { price }.data(),
            parity::accounts::UpdatePrice { keeper: *signer, protocol: self.protocol, market: *market }
                .to_account_metas(None),
        )
    }

    fn set_price(&mut self, market: &Pubkey, price: u64) {
        let ix = self.price_ix(&self.keeper.pubkey(), market, price);
        let keeper = self.keeper.insecure_clone();
        self.send(&[ix], &[&keeper]).unwrap();
    }

    fn deposit(&mut self, user: &User, market: &Pubkey, amount: u64) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::DepositLiquidity { amount }.data(),
            parity::accounts::DepositLiquidity {
                owner: user.kp.pubkey(),
                protocol: self.protocol,
                market: *market,
                lp_position: Self::lp_pda(market, &user.kp.pubkey()),
                vault: Self::vault_pda(market),
                owner_token: user.ata,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], &[&user.kp])
    }

    fn withdraw(&mut self, user: &User, market: &Pubkey, shares: u64) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::WithdrawLiquidity { shares }.data(),
            parity::accounts::WithdrawLiquidity {
                owner: user.kp.pubkey(),
                protocol: self.protocol,
                market: *market,
                lp_position: Self::lp_pda(market, &user.kp.pubkey()),
                vault: Self::vault_pda(market),
                owner_token: user.ata,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], &[&user.kp])
    }

    fn open(&mut self, user: &User, market: &Pubkey, side: Side, margin: u64, size: u64) -> Result<(), String> {
        let acceptable_price = match side {
            Side::Long => u64::MAX,
            Side::Short => 0,
        };
        let ix = Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::OpenPosition { side, margin, size, acceptable_price }.data(),
            parity::accounts::OpenPosition {
                owner: user.kp.pubkey(),
                protocol: self.protocol,
                market: *market,
                position: Self::position_pda(market, &user.kp.pubkey(), side),
                vault: Self::vault_pda(market),
                owner_token: user.ata,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], &[&user.kp])
    }

    fn close_ix(&self, signer: &Pubkey, owner_token: &Pubkey, position: &Pubkey, market: &Pubkey, side: Side) -> Instruction {
        let acceptable_price = match side {
            Side::Long => 0,
            Side::Short => u64::MAX,
        };
        Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::ClosePosition { acceptable_price }.data(),
            parity::accounts::ClosePosition {
                owner: *signer,
                protocol: self.protocol,
                market: *market,
                position: *position,
                vault: Self::vault_pda(market),
                owner_token: *owner_token,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
        )
    }

    fn close(&mut self, user: &User, market: &Pubkey, side: Side) -> Result<(), String> {
        let position = Self::position_pda(market, &user.kp.pubkey(), side);
        let ix = self.close_ix(&user.kp.pubkey(), &user.ata, &position, market, side);
        self.send(&[ix], &[&user.kp])
    }

    fn liquidate(&mut self, liquidator: &User, owner: &Pubkey, market: &Pubkey, side: Side) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            parity::id(),
            &parity::instruction::Liquidate {}.data(),
            parity::accounts::Liquidate {
                liquidator: liquidator.kp.pubkey(),
                owner: *owner,
                protocol: self.protocol,
                market: *market,
                position: Self::position_pda(market, owner, side),
                vault: Self::vault_pda(market),
                liquidator_token: liquidator.ata,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], &[&liquidator.kp])
    }

    fn market(&self, market: &Pubkey) -> Market {
        let acc = self.svm.get_account(market).unwrap();
        Market::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn position(&self, pda: &Pubkey) -> Option<Position> {
        let acc = self.svm.get_account(pda)?;
        if acc.data.is_empty() {
            return None;
        }
        Some(Position::try_deserialize(&mut acc.data.as_slice()).unwrap())
    }

    /// Market with 100k LP liquidity and a $100 price.
    fn funded_market(&mut self, symbol: &str) -> Pubkey {
        let market = self.create_market(symbol);
        let lp = self.user(usd(100_000));
        self.deposit(&lp, &market, usd(100_000)).unwrap();
        self.set_price(&market, usd(100));
        market
    }
}

fn assert_err(res: Result<(), String>, needle: &str) {
    let err = res.expect_err("expected failure");
    assert!(err.contains(needle), "expected `{needle}`, got:\n{err}");
}

#[test]
fn long_profit_round_trip() {
    let mut env = Env::new();
    let market = env.funded_market("OPENAI");
    let trader = env.user(usd(1_000));

    env.open(&trader, &market, Side::Long, usd(100), usd(500)).unwrap();
    // 0.1% fee on $500 is charged on top of margin.
    assert_eq!(env.balance(&trader.ata), usd(1_000) - usd(100) - 500_000);
    let pos = env.position(&Env::position_pda(&market, &trader.kp.pubkey(), Side::Long)).unwrap();
    assert_eq!(pos.size, usd(500));
    assert_eq!(pos.qty, 5_000_000_000);

    env.set_price(&market, usd(110));
    env.close(&trader, &market, Side::Long).unwrap();

    // +$50 PnL, minus open and close fees; no time passed so no funding.
    assert_eq!(env.balance(&trader.ata), usd(1_000) + usd(50) - 1_000_000);
    assert!(env.position(&Env::position_pda(&market, &trader.kp.pubkey(), Side::Long)).is_none());
    let m = env.market(&market);
    assert_eq!((m.long_size, m.long_qty, m.total_margin), (0, 0, 0));
}

#[test]
fn short_profit_and_loss() {
    let mut env = Env::new();
    let market = env.funded_market("ANTHROPIC");
    let winner = env.user(usd(1_000));
    let loser = env.user(usd(1_000));

    env.open(&winner, &market, Side::Short, usd(200), usd(1_000)).unwrap();
    env.set_price(&market, usd(95));
    env.close(&winner, &market, Side::Short).unwrap();
    // +5% on $1000 = $50, fees $1 open + $1 close.
    assert_eq!(env.balance(&winner.ata), usd(1_000) + usd(50) - usd(2));

    env.open(&loser, &market, Side::Short, usd(200), usd(1_000)).unwrap();
    env.set_price(&market, usd(100));
    env.close(&loser, &market, Side::Short).unwrap();
    // Entered at $95, closed at $100: -$52.63 PnL, $2 fees.
    assert_eq!(env.balance(&loser.ata), usd(1_000) - 52_631_578 - usd(2));
}

#[test]
fn adding_to_position_averages_entry() {
    let mut env = Env::new();
    let market = env.funded_market("ANDURIL");
    let trader = env.user(usd(1_000));
    env.open(&trader, &market, Side::Long, usd(100), usd(200)).unwrap();
    env.set_price(&market, usd(110));
    env.open(&trader, &market, Side::Long, usd(100), usd(220)).unwrap();
    let pos = env.position(&Env::position_pda(&market, &trader.kp.pubkey(), Side::Long)).unwrap();
    assert_eq!(pos.margin, usd(200));
    assert_eq!(pos.size, usd(420));
    assert_eq!(pos.qty, 4_000_000_000);
    assert_eq!(parity::math::entry_price(pos.size, pos.qty).unwrap(), 105 * USDC);
}

#[test]
fn rejects_stale_price() {
    let mut env = Env::new();
    let market = env.funded_market("KALSHI");
    let trader = env.user(usd(1_000));
    env.advance(121);
    assert_err(env.open(&trader, &market, Side::Long, usd(10), usd(10)), "StalePrice");
}

#[test]
fn rejects_unauthorized_price_and_admin() {
    let mut env = Env::new();
    let market = env.funded_market("NEURALINK");
    let attacker = env.user(0);

    let ix = env.price_ix(&attacker.kp.pubkey(), &market, usd(1));
    assert_err(env.send(&[ix], &[&attacker.kp]), "Unauthorized");

    let ix = env.create_market_ix(&attacker.kp.pubkey(), "FIGUREAI", default_config());
    assert_err(env.send(&[ix], &[&attacker.kp]), "Unauthorized");
}

#[test]
fn price_moves_are_clamped() {
    let mut env = Env::new();
    let market = env.funded_market("POLYMARKET");
    env.set_price(&market, usd(200));
    assert_eq!(env.market(&market).price, usd(110));
    env.set_price(&market, 1);
    assert_eq!(env.market(&market).price, usd(99));
}

#[test]
fn enforces_leverage_and_limits() {
    let mut env = Env::new();
    let market = env.funded_market("OPENAI");
    let trader = env.user(usd(100_000));
    assert_err(env.open(&trader, &market, Side::Long, usd(100), usd(501)), "InvalidLeverage");
    assert_err(env.open(&trader, &market, Side::Long, usd(100), usd(99)), "InvalidLeverage");
    assert_err(env.open(&trader, &market, Side::Long, 500_000, usd(1)), "MarginTooSmall");
    assert_err(env.open(&trader, &market, Side::Long, usd(5_000), usd(10_001)), "PositionTooLarge");

    // Per-side OI cap is $50k.
    for _ in 0..5 {
        let t = env.user(usd(10_000));
        env.open(&t, &market, Side::Long, usd(2_500), usd(10_000)).unwrap();
    }
    assert_err(env.open(&trader, &market, Side::Long, usd(2_500), usd(10_000)), "OpenInterestLimit");
}

#[test]
fn liquidity_cap_follows_vault() {
    let mut env = Env::new();
    let market = env.create_market("FIGUREAI");
    let lp = env.user(usd(1_000));
    env.deposit(&lp, &market, usd(1_000)).unwrap();
    env.set_price(&market, usd(100));
    let trader = env.user(usd(1_000));
    assert_err(env.open(&trader, &market, Side::Long, usd(200), usd(501)), "InsufficientLiquidity");
    env.open(&trader, &market, Side::Long, usd(100), usd(500)).unwrap();
    // LP can't pull liquidity that backs open interest.
    assert_err(env.withdraw(&lp, &market, usd(100)), "InsufficientLiquidity");
}

#[test]
fn liquidation_flow() {
    let mut env = Env::new();
    let market = env.funded_market("OPENAI");
    let trader = env.user(usd(1_000));
    let keeper = env.user(0);
    env.open(&trader, &market, Side::Long, usd(100), usd(500)).unwrap();

    // Equity $50 at $90, maintenance is $25.
    env.set_price(&market, usd(90));
    assert_err(env.liquidate(&keeper, &trader.kp.pubkey(), &market, Side::Long), "NotLiquidatable");

    // Equity $20 at $84.
    env.set_price(&market, usd(84));
    env.liquidate(&keeper, &trader.kp.pubkey(), &market, Side::Long).unwrap();
    assert_eq!(env.balance(&keeper.ata), usd(5));
    assert!(env.position(&Env::position_pda(&market, &trader.kp.pubkey(), Side::Long)).is_none());
    let m = env.market(&market);
    assert_eq!((m.long_size, m.total_margin), (0, 0));
}

#[test]
fn cannot_close_someone_elses_position() {
    let mut env = Env::new();
    let market = env.funded_market("ANTHROPIC");
    let trader = env.user(usd(1_000));
    let thief = env.user(0);
    env.open(&trader, &market, Side::Long, usd(100), usd(500)).unwrap();
    let position = Env::position_pda(&market, &trader.kp.pubkey(), Side::Long);
    let ix = env.close_ix(&thief.kp.pubkey(), &thief.ata, &position, &market, Side::Long);
    env.send(&[ix], &[&thief.kp]).unwrap_err();
    assert!(env.position(&position).is_some());
}

#[test]
fn funding_charges_crowded_side() {
    let mut env = Env::new();
    let market = env.funded_market("KALSHI");
    let long = env.user(usd(1_000));
    env.open(&long, &market, Side::Long, usd(200), usd(1_000)).unwrap();

    // One hour, 100% long skew: 0.1% of $1000 = $1 funding.
    for _ in 0..36 {
        env.advance(100);
        env.set_price(&market, usd(100));
    }
    env.close(&long, &market, Side::Long).unwrap();
    let expected = usd(1_000) - usd(2) - usd(1);
    assert!(env.balance(&long.ata).abs_diff(expected) <= 2);
}

#[test]
fn paused_market_blocks_opens_but_allows_close() {
    let mut env = Env::new();
    let market = env.funded_market("ANDURIL");
    let trader = env.user(usd(1_000));
    env.open(&trader, &market, Side::Short, usd(100), usd(300)).unwrap();

    let ix = Instruction::new_with_bytes(
        parity::id(),
        &parity::instruction::SetMarketPaused { paused: true }.data(),
        parity::accounts::AdminMarket { admin: env.admin.pubkey(), protocol: env.protocol, market }
            .to_account_metas(None),
    );
    let admin = env.admin.insecure_clone();
    env.send(&[ix], &[&admin]).unwrap();

    assert_err(env.open(&trader, &market, Side::Long, usd(10), usd(10)), "MarketPaused");
    env.close(&trader, &market, Side::Short).unwrap();
}
