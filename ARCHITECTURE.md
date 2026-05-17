# Swing Trade Backtester — Architecture & Build Guide

> **Hand this file to Claude Code at the start of every session.**
> It is the source of truth for project decisions, data shapes, and build order.

---

## Project Purpose

Given a set of actual historical swing trades (bought via E*TRADE), simulate what
different exit strategies — especially trailing stops — would have produced compared
to what actually happened.

Core question: *Would trailing stops have captured more upside than my fixed limit
sell orders?*

This is a **research/backtesting tool only**. It does not connect to a live broker.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | Links code/linting tightly with data models |
| Runtime | Node.js | Same as ai-trader-backend |
| Database | PostgreSQL via Docker | Same pattern as ai-trader-backend |
| ORM | Prisma | Same as ai-trader-backend |
| Market data | Massive.com REST API | User has Stocks Starter subscription |
| CSV import | papaparse | E*TRADE order export parsing |
| HTTP client | axios | Massive API calls |

No Express API is needed for v0. Everything runs as CLI scripts.
An Express layer can be added later if a UI is desired.

---

## Repository Structure

```
swing-backtester/
  prisma/
    schema.prisma
    migrations/
    seed.ts                   # seed securities + example scenarios
  src/
    config/
      env.ts                  # typed env var loader
    db/
      prisma.ts               # singleton PrismaClient
    ingestion/
      massive.client.ts       # Massive.com API wrapper
      ohlc.ingestor.ts        # fetch candles + upsert to OhlcCandle
      trade.importer.ts       # parse E*TRADE CSV → ActualOrder rows
      trade.pairer.ts         # pair ActualOrder buy/sell → ActualTrade
    engine/
      backtest.engine.ts      # outer loop: ActualTrade × ExitScenario
      exit-evaluator.ts       # bar-by-bar exit logic per scenario
      trailing-stop.tracker.ts  # running high + trail floor state machine
    analysis/
      metrics.calculator.ts   # aggregate BacktestTrade → BacktestSummary
      scenario.ranker.ts      # sort/compare scenarios by metric
    services/
      backtest.service.ts     # orchestrates engine + db writes
      ohlc.service.ts         # query candles from db
      scenario.service.ts     # CRUD for ExitScenario
    types/
      ohlc.types.ts
      trade.types.ts
      scenario.types.ts
      engine.types.ts
    utils/
      date.utils.ts           # market day helpers, EST/EDT handling
      csv.utils.ts            # shared CSV parsing helpers
  scripts/
    ingest-ohlc.ts            # CLI: fetch + store candles for ticker/range
    import-trades.ts          # CLI: load E*TRADE CSV export
    run-backtest.ts           # CLI: run engine, write results to db
    print-results.ts          # CLI: query + display BacktestSummary
  docker-compose.yml
  .env.example
  tsconfig.json
  package.json
  ARCHITECTURE.md             # this file
```

---

## Docker Setup

Mirrors the ai-trader-backend pattern exactly.

**`docker-compose.yml`**:
```yaml
services:
  db:
    image: postgres:16
    container_name: swing-backtester-postgres
    environment:
      POSTGRES_USER: backtester
      POSTGRES_PASSWORD: backtesterpass
      POSTGRES_DB: swing_backtester
    ports:
      - "5433:5432"     # 5433 on host to avoid conflict with ai-trader-backend on 5432
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**`.env.example`**:
```
DATABASE_URL=postgresql://backtester:backtesterpass@localhost:5433/swing_backtester
MASSIVE_API_KEY=your_key_here
MASSIVE_BASE_URL=https://api.massive.com
```

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum AssetType {
  ETF
  STOCK
}

enum OrderSide {
  BUY
  SELL
}

enum RunStatus {
  PENDING
  RUNNING
  COMPLETE
  FAILED
}

enum ExitReason {
  TARGET   // fixed target % hit
  STOP     // hard stop % from entry hit
  TRAIL    // trailing stop hit
  TIME     // max hold bars exceeded
  OPEN     // position still open at end of candle data
}

// ─── Security ────────────────────────────────────────────────────────────────

model Security {
  symbol    String    @id        // 'SPY', 'AAPL', etc.
  name      String
  assetType AssetType
  active    Boolean   @default(true)
  notes     String?

  candles      OhlcCandle[]
  actualTrades ActualTrade[]
  scenarios    ExitScenario[]
  actualOrders ActualOrder[]
}

// ─── OhlcCandle ──────────────────────────────────────────────────────────────
// 5-min bars from Massive.com
// ~78 bars/day × 252 trading days/yr × 9 tickers ≈ 177k rows/yr

model OhlcCandle {
  id           Int      @id @default(autoincrement())
  ticker       String
  ts           DateTime  // candle open time, stored as UTC (converted from Massive unix ms)
  open         Float     // 'o'
  high         Float     // 'h'
  low          Float     // 'l'
  close        Float     // 'c'
  volume       BigInt    // 'v'
  vwap         Float?    // 'vw'
  transactions Int?      // 'n'

  security Security @relation(fields: [ticker], references: [symbol])

  @@unique([ticker, ts])
  @@index([ticker, ts])
}

// ─── ActualOrder ─────────────────────────────────────────────────────────────
// One raw row from E*TRADE CSV. Buys and sells imported separately,
// then paired into ActualTrade by trade.pairer.ts

model ActualOrder {
  id            Int       @id @default(autoincrement())
  importedAt    DateTime  @default(now())
  rawRow        Json      // preserve original CSV row for debugging

  etradeOrderId Int?      // 'Order' column (e.g. 1577)
  ticker        String
  side          OrderSide // BUY | SELL
  executedAt    DateTime
  quantity      Float
  priceExecuted Float     // 'Price executed' (stripped of † and parsed)
  priceType     String    // 'Limit' | 'Mkt' | 'T-Stop %'
  term          String?   // 'GT 60' | 'Day'
  limitPrice    Float?    // 'Price' column — null when 'Mkt'
  commission    Float?    // not in E*TRADE order export; left for future use

  // Set after pairing step
  tradeId Int?
  trade   ActualTrade? @relation(fields: [tradeId], references: [id])

  security Security @relation(fields: [ticker], references: [symbol])

  @@index([ticker, executedAt])
  @@index([etradeOrderId])
}

// ─── ActualTrade ─────────────────────────────────────────────────────────────
// A paired entry + exit from real trading history.
// One trade = one buy order + zero or one sell order (null if still open).

model ActualTrade {
  id     Int    @id @default(autoincrement())
  ticker String

  // Entry
  entryTs        DateTime
  entryPrice     Float
  shares         Float
  capitalDeployed Float   // entryPrice × shares

  // Actual exit (null = position never sold / still open)
  actualExitTs     DateTime?
  actualExitPrice  Float?
  actualExitReason String?   // 'limit_sell' | 'market_sell' | 'trailing_stop' | 'open'
  actualPnlPct     Float?    // (exitPrice - entryPrice) / entryPrice
  actualPnlDollar  Float?    // (exitPrice - entryPrice) × shares

  // Duration
  actualBarsHeld Int?         // 5-min candle bars from entry to exit

  importedAt DateTime @default(now())
  notes      String?

  security      Security      @relation(fields: [ticker], references: [symbol])
  orders        ActualOrder[]
  backtestTrades BacktestTrade[]

  @@index([ticker, entryTs])
}

// ─── ExitScenario ────────────────────────────────────────────────────────────
// One parameterized exit strategy to test.
// All pct fields are signed decimals: 0.01 = +1%, -0.005 = -0.5%

model ExitScenario {
  id          Int     @id @default(autoincrement())
  name        String  @unique   // e.g. 'Trail 0.5% from high, activate at +0.5%'
  description String?

  // Fixed target — exit when price hits entryPrice * (1 + targetPct)
  targetPct Float?              // e.g. 0.01

  // Hard stop — exit when low hits entryPrice * (1 + stopPct)
  stopPct   Float?              // e.g. -0.015

  // Trailing stop — exit when low falls below runningHigh * (1 + trailingStopPct)
  trailingStopPct       Float?  // e.g. -0.005
  trailActivateAfterPct Float?  // don't start trailing until gain >= this; e.g. 0.005

  // Time exit — exit after this many 5-min bars regardless of price
  maxHoldBars Int?              // 78 bars = 1 trading day

  // Scope — null means applies to all
  assetTypeScope AssetType?

  // Same-bar priority (hardcoded in engine): STOP > TRAIL > TARGET > TIME

  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  backtestTrades BacktestTrade[]
  runScenarios   BacktestRunScenario[]
}

// ─── BacktestRun ─────────────────────────────────────────────────────────────
// One execution of the engine against a set of trades and scenarios.

model BacktestRun {
  id          Int       @id @default(autoincrement())
  name        String
  description String?
  status      RunStatus @default(PENDING)
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  // Optional filters applied at run time
  filterTickers  String[]   // empty array = all tickers
  filterDateFrom DateTime?
  filterDateTo   DateTime?

  scenarios  BacktestRunScenario[]
  trades     BacktestTrade[]
  summaries  BacktestSummary[]
}

// ─── BacktestRunScenario ─────────────────────────────────────────────────────
// Join: which scenarios are included in a run

model BacktestRunScenario {
  runId      Int
  scenarioId Int

  run      BacktestRun  @relation(fields: [runId],      references: [id])
  scenario ExitScenario @relation(fields: [scenarioId], references: [id])

  @@id([runId, scenarioId])
}

// ─── BacktestTrade ───────────────────────────────────────────────────────────
// One simulated result: ActualTrade × ExitScenario.
// This is the atomic output of the engine.

model BacktestTrade {
  id            Int @id @default(autoincrement())
  runId         Int
  actualTradeId Int
  scenarioId    Int

  // Simulated exit
  exitTs    DateTime?
  exitPrice Float?
  exitReason ExitReason?

  // P&L
  pnlPct    Float?   // (exitPrice - entryPrice) / entryPrice
  pnlDollar Float?   // (exitPrice - entryPrice) × shares

  // Delta vs what actually happened (positive = sim was better)
  pnlVsActualPct    Float?
  pnlVsActualDollar Float?

  // Time
  barsInTrade Int?

  // Trail detail — useful for tuning
  runningHighPrice  Float?    // peak price reached during position
  runningHighPct    Float?    // max unrealized gain % reached
  trailActivatedAt  DateTime? // when trailing stop first became active

  run         BacktestRun  @relation(fields: [runId],          references: [id])
  actualTrade ActualTrade  @relation(fields: [actualTradeId],  references: [id])
  scenario    ExitScenario @relation(fields: [scenarioId],     references: [id])

  @@unique([runId, actualTradeId, scenarioId])
  @@index([runId, scenarioId])
  @@index([actualTradeId])
}

// ─── BacktestSummary ─────────────────────────────────────────────────────────
// Aggregated metrics per scenario per run. Computed after engine finishes.

model BacktestSummary {
  id         Int @id @default(autoincrement())
  runId      Int
  scenarioId Int

  // Counts
  totalTrades Int
  wins        Int    // pnlPct > 0
  losses      Int
  openTrades  Int    // exitReason = OPEN (no exit found in candle data)
  winRate     Float  // wins / (totalTrades - openTrades)

  // P&L
  totalPnlPct  Float
  avgPnlPct    Float
  avgWinPct    Float
  avgLossPct   Float
  bestTradePct Float
  worstTradePct Float

  // vs actual
  avgPnlVsActualPct    Float   // avg improvement over what actually happened
  totalPnlVsActualDollar Float // total dollar improvement across all trades
  tradesImproved       Int     // trades where sim beat actual
  tradesWorse          Int

  // Time efficiency
  avgBarsInTrade Float
  avgDaysInTrade Float         // avgBarsInTrade / 78

  // Trail-specific
  avgRunningHighPct Float?     // avg peak unrealized gain before exit

  run BacktestRun @relation(fields: [runId], references: [id])

  @@unique([runId, scenarioId])
}
```

---

## E*TRADE CSV Format

**Headers** (exact column names from export):
```
Order | Order type | Quantity | Symbol | Price type | Term | Price | Price executed | ExecutedDateTime
```

**Sample rows**:
```
1577 | Sell | 1,392 | SPY | Limit | GT 60 | 721.92 | 721.92† | 05/05/26 09:30:07 AM EDT
1574 | Buy  | 1,392 | SPY | Mkt   | Day   | Mkt    | 718.3242 | 05/04/26 11:44:42 AM EDT
```

**Parsing rules** (implement in `trade.importer.ts`):
- `Quantity`: strip commas before `parseFloat`
- `Price executed`: strip trailing `†` before `parseFloat`
- `Price`: if value is `"Mkt"` → store `null` in `limitPrice`; otherwise `parseFloat`
- `ExecutedDateTime`: trim whitespace and surrounding quotes; parse as EST/EDT
  - Format: `MM/DD/YY HH:MM:SS AM/PM EDT`
  - Convert to UTC before storing in DB
- `Order type`: `"Buy"` → `BUY`, `"Sell"` → `SELL`
- `Price type` values seen: `"Limit"`, `"Mkt"`, `"T-Stop %"`

**Trade pairing logic** (implement in `trade.pairer.ts`):
- For each BUY order, find the next SELL order for the same ticker by `executedAt`
- A BUY with no subsequent SELL = open trade (`actualExitTs = null`)
- Multiple BUYs before a SELL = first BUY only for v0 (campaign/add logic is a future enhancement)
- Do not pair across tickers

---

## Massive.com API

**Endpoint**: `GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`

**For 5-min bars**:
```
GET /v2/aggs/ticker/SPY/range/5/minute/{from_unix_ms}/{to_unix_ms}
```

**Response shape**:
```json
{
  "results": [
    { "o": 74.06, "h": 75.15, "l": 73.80, "c": 75.09, "v": 135647456, "vw": 74.61, "n": 1, "t": 1577941200000 }
  ],
  "ticker": "SPY",
  "status": "OK",
  "next_url": "..."
}
```

**Field mapping** (`t` is Unix ms UTC):
| Massive field | DB column |
|---|---|
| `t` | `ts` (convert ms → DateTime UTC) |
| `o` | `open` |
| `h` | `high` |
| `l` | `low` |
| `c` | `close` |
| `v` | `volume` |
| `vw` | `vwap` |
| `n` | `transactions` |

**Pagination**: follow `next_url` when present until exhausted.

**Auth**: `Authorization: Bearer {MASSIVE_API_KEY}` header.

---

## Engine Logic

### Trailing Stop State Machine

This is the core of what's new vs. the Excel version. Per bar, per open position:

```
State per position:
  entryPrice        — fixed at entry
  stopPrice         — entryPrice * (1 + stopPct), fixed
  targetPrice       — entryPrice * (1 + targetPct), fixed
  runningHigh       — max(high) seen since entry, updated each bar
  trailActive       — false until runningHigh / entryPrice - 1 >= trailActivateAfterPct
  trailFloor        — runningHigh * (1 + trailingStopPct), recalculated each bar when active

Per bar evaluation (in priority order):
  1. STOP:   low  <= stopPrice              → exit at stopPrice
  2. TRAIL:  trailActive && low <= trailFloor → exit at trailFloor
  3. TARGET: high >= targetPrice            → exit at targetPrice
  4. TIME:   barsInTrade >= maxHoldBars     → exit at close

Same-bar conflicts resolve by priority: STOP wins over TRAIL wins over TARGET wins over TIME.

If no exit: update runningHigh, recalculate trailFloor, increment barsInTrade, continue.
```

### Outer Loop

```
For each ActualTrade:
  1. Load OHLC candles for ticker, starting from entryTs
  2. Find the entry candle (first candle where ts >= entryTs)
  3. For each active ExitScenario in the run:
     a. Initialize state machine
     b. Walk candles forward bar by bar
     c. On exit: write BacktestTrade record
     d. If candles exhausted with no exit: write BacktestTrade with exitReason = OPEN
  4. After all scenarios: compute BacktestSummary per scenario
```

---

## Build Order (Recommended)

Build in this sequence. Each step is independently testable before moving on.

### Phase 1 — Foundation
1. `docker-compose.yml` + `.env` + `.env.example`
2. `prisma/schema.prisma` (exact schema above)
3. `npx prisma migrate dev --name init`
4. `src/db/prisma.ts` — singleton client
5. `src/config/env.ts` — typed env loader
6. `prisma/seed.ts` — seed Securities (SPY, QQQ, DIA, IWM, AAPL, AMZN, GOOG, META, MSFT)

### Phase 2 — OHLC Ingestion
7. `src/ingestion/massive.client.ts` — axios wrapper, pagination, auth header
8. `src/ingestion/ohlc.ingestor.ts` — fetch + upsert candles (upsert on `[ticker, ts]`)
9. `scripts/ingest-ohlc.ts` — CLI: `npx tsx scripts/ingest-ohlc.ts --ticker SPY --from 2024-10-01 --to 2025-05-16`

### Phase 3 — Trade Import
10. `src/ingestion/trade.importer.ts` — parse E*TRADE CSV, write ActualOrder rows
11. `src/ingestion/trade.pairer.ts` — pair ActualOrder → ActualTrade
12. `scripts/import-trades.ts` — CLI: `npx tsx scripts/import-trades.ts --file ./data/orders.csv`

### Phase 4 — Engine
13. `src/types/*.ts` — all TypeScript types (no Prisma types leaked into engine layer)
14. `src/engine/trailing-stop.tracker.ts` — state machine (pure functions, no DB)
15. `src/engine/exit-evaluator.ts` — per-bar evaluation logic (pure functions, no DB)
16. `src/engine/backtest.engine.ts` — outer loop, uses ohlc.service + exit-evaluator
17. `src/services/backtest.service.ts` — orchestrates engine + writes BacktestTrade + BacktestSummary

### Phase 5 — Results
18. `src/analysis/metrics.calculator.ts` — aggregation logic
19. `scripts/run-backtest.ts` — CLI: create BacktestRun, run engine, print summary
20. `scripts/print-results.ts` — CLI: query and display results for a run

---

## Tickers

| Symbol | Name | Asset Type |
|---|---|---|
| SPY | S&P 500 ETF | ETF |
| QQQ | Nasdaq 100 ETF | ETF |
| DIA | Dow Jones ETF | ETF |
| IWM | Russell 2000 ETF | ETF |
| AAPL | Apple | STOCK |
| AMZN | Amazon | STOCK |
| GOOG | Alphabet | STOCK |
| META | Meta | STOCK |
| MSFT | Microsoft | STOCK |

---

## Key Conventions

- All timestamps stored as **UTC** in the database
- Percentages stored as **signed decimals** (`0.01` = 1%, `-0.005` = -0.5%)
- Engine layer (`src/engine/`) is **pure functions** — no direct DB access; all data passed in
- Services layer handles DB reads/writes and calls engine functions
- Scripts are thin CLI wrappers that call services
- Prisma client is a **singleton** (one instance, imported from `src/db/prisma.ts`)
- All env vars loaded through `src/config/env.ts` (never `process.env` directly elsewhere)

---

## Git Commit Style

Make frequent, logical commits with:
- **Brief subject line** (under 70 chars, imperative mood)
  - Examples: "Initialize Phase 1 foundation", "Add trailing stop state machine", "Fix OHLC candle timestamp parsing"
- **Detailed body** (wrapped at ~72 chars, explains the WHY and key WHAT)
  - Motivation for the change
  - Any non-obvious decisions or tradeoffs
  - Context about which phase or component this belongs to

Example:
```
Add Massive.com API client wrapper

Implements axios-based wrapper around Massive.com /v2/aggs endpoint.
Handles pagination with next_url and Bearer token auth.
Converts Unix millisecond timestamps to UTC DateTime for Prisma.

Phase 2: OHLC Ingestion (#7)
```

---

## What This Is NOT (Yet)

- Not a live trading system
- Not connected to any broker
- No Express API / no web UI (CLI only for v0)
- No multi-add / campaign tracking (v0 pairs first BUY → first SELL only)
- No intraday entry signal generation (engine starts from known actual entry points)
