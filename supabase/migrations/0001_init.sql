-- Parity read models. On-chain state stays the source of truth for balances,
-- positions and liquidation; these tables serve history, charts and metadata.

create table if not exists markets (
  symbol            text primary key,
  name              text not null,
  description       text not null default '',
  image             text not null,
  url               text not null,
  mint              text not null,
  market_address    text,
  mark_price        numeric,
  token_price       numeric,
  mark_valuation    numeric,
  implied_valuation numeric,
  change_24h        numeric,
  liquidity         numeric,
  updated_at        timestamptz not null default now()
);

create table if not exists prices (
  id          bigint generated always as identity primary key,
  symbol      text not null references markets(symbol),
  ts          timestamptz not null default now(),
  index_price numeric not null,
  spot        numeric not null,
  mark        numeric not null
);
create index if not exists prices_symbol_ts on prices (symbol, ts desc);

create table if not exists trades (
  signature     text not null,
  event_index   int not null,
  kind          text not null check (kind in ('open', 'close', 'liquidate')),
  owner         text not null,
  market        text not null,
  symbol        text,
  side          text not null check (side in ('long', 'short')),
  margin        numeric not null,
  size          numeric not null,
  price         numeric not null,
  entry_price   numeric,
  pnl           numeric,
  funding       numeric,
  fee           numeric,
  payout        numeric,
  liquidator    text,
  ts            timestamptz not null,
  primary key (signature, event_index)
);
create index if not exists trades_owner_ts on trades (owner, ts desc);
create index if not exists trades_symbol_ts on trades (symbol, ts desc);

create table if not exists keeper_state (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists faucet_claims (
  wallet      text primary key,
  claimed_at  timestamptz not null default now(),
  claims      int not null default 1
);

-- Public read for market data and history; writes only via the service role.
alter table markets enable row level security;
alter table prices enable row level security;
alter table trades enable row level security;
alter table keeper_state enable row level security;
alter table faucet_claims enable row level security;

drop policy if exists "public read markets" on markets;
create policy "public read markets" on markets for select using (true);
drop policy if exists "public read prices" on prices;
create policy "public read prices" on prices for select using (true);
drop policy if exists "public read trades" on trades;
create policy "public read trades" on trades for select using (true);
