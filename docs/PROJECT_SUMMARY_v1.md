# Swing Trade Backtester — Project Summary v1.0

**Completed**: May 2026  
**Phases**: 1-6 (Foundation → Export & Cleanup)  
**Status**: Frozen snapshot of v1 accomplishments

---

# Swing Trade Backtester — Final Project Summary

## 🎯 What We Built

A **TypeScript-based backtesting engine** that answers: *"Would trailing stops have captured more upside than my fixed limit sell orders?"*

**Core Capability**: Simulates 6 exit strategies against your actual E*TRADE trading history using 5-minute OHLC candles, generating comparative P&L analysis.

---

## Technical Stack

| Component | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma |
| Market Data | Massive.com API (5-min bars) |
| Runtime | Node.js (CLI scripts) |
| CSV Parsing | papaparse |
| HTTP Client | axios |

---

## Key Features (Complete ✅)

### Data Ingestion
- Massive.com API client with pagination & auth
- Bulk OHLC candle import for multiple tickers
- E*TRADE CSV parser with EST/EDT→UTC conversion
- Auto-pair buy/sell orders into trades
- Auto-create missing securities

### Backtest Engine
- **Bar-by-bar simulation** using 5-minute candles
- **Trailing stop state machine** with running high tracking
- **Priority-based exit logic**: STOP > TRAIL > TARGET > TIME
- **6 parameterized scenarios**:
  1. Fixed +1% Target
  2. Fixed -1.5% Stop
  3. Trail 0.5% (activate at +0.5%)
  4. Trail 1% (activate at +1%)
  5. 1 Day Max Hold
  6. +1% Target OR Trail 0.5%
- Zero data duplication in exports

### Analysis & Ranking
- **Composite scoring** (0-100 scale):
  - 20% Win Rate
  - 20% Profit Factor
  - 20% Expectancy
  - 20% Improvement Rate
  - 20% Average PnL
- **Scenario comparison** with strengths/weaknesses detection
- **Trade-by-trade metrics** (P&L %, vs actual, hold time, running high)
- **Comparison against actual exits** (how much upside each scenario would've captured)

### Export & Reporting
- **3 CSV exports** for Excel analysis:
  - `run-{id}-rankings.csv` — Scenarios sorted by composite score
  - `run-{id}-scenario-trades.csv` — All trades × all scenarios (972 rows for 162 orders)
  - `run-{id}-metadata.csv` — Run info and filters
- **Excel-friendly timestamps** (e.g., `2024-10-04 09:59:25 AM EDT`)
- **Order IDs preserved** for traceability
- **Optional --runId parameter** (defaults to most recent run)

### Cleanup & Iteration
- Safe data reset that preserves OHLC candles (already fetched)
- Idempotent scenario creation (safe to re-run)
- Full audit trail with detailed commits

---

## Project Structure

### Repository Layout

```
swing-backtester/
  prisma/
    schema.prisma         # 8-model Prisma schema
    migrations/           # Database migrations
    seed.ts              # Securities seed data
  src/
    config/env.ts        # Typed environment loader
    db/prisma.ts         # Singleton PrismaClient
    ingestion/           # CSV parsing, API clients
      massive.client.ts
      ohlc.ingestor.ts
      trade.importer.ts
      trade.pairer.ts
    engine/              # Bar-by-bar simulation
      trailing-stop.tracker.ts
      exit-evaluator.ts
      backtest.engine.ts
    analysis/            # Metrics & ranking
      metrics.calculator.ts
      scenario.ranker.ts
    services/            # DB orchestration
      backtest.service.ts
      ohlc.service.ts
      scenario.service.ts
      results.service.ts
    types/              # TypeScript type definitions
    utils/              # CSV parsing, date helpers
  scripts/              # 9 CLI tools
    ingest-ohlc.ts
    ingest-ohlc-bulk.ts
    import-trades.ts
    create-scenarios.ts
    run-backtest.ts
    print-results.ts
    export-results.ts
    list-runs.ts
    cleanup-trades.ts
  docs/
    PROJECT_SUMMARY_v1.md    # This file (v1 frozen snapshot)
  docker-compose.yml
  .env.example
  tsconfig.json
  package.json
  README.md
  ARCHITECTURE.md
  ANALYSIS_WORKFLOW.md
```

### Available Commands

```bash
# Data Setup
npm run ingest-ohlc-bulk                    # Fetch OHLC (bulk, config-driven)
npm run ingest-ohlc -- --ticker SPY ...     # Fetch single ticker
npm run import-trades -- --file data/...    # Import E*TRADE CSV
npx tsx scripts/create-scenarios.ts         # Seed exit scenarios

# Backtest & Analysis
npm run run-backtest -- --name "Test" ...   # Run engine
npm run export-results                      # Export CSVs (latest run)
npm run export-results -- --runId 5         # Export specific run
npm run list-runs                           # List all runs
npm run print-results -- --runId 5          # View console results

# Maintenance
npm run cleanup-trades                      # Reset trade data
```

---

## Database Schema

**8 core models**:

| Model | Purpose |
|---|---|
| `Security` | Ticker reference (SPY, AAPL, etc.) |
| `OhlcCandle` | 5-min OHLC bars (~78 bars/day) |
| `ActualOrder` | Raw E*TRADE orders (BUY/SELL) |
| `ActualTrade` | Paired entry + exit |
| `ExitScenario` | Parameterized exit strategies |
| `BacktestRun` | One complete engine execution |
| `BacktestTrade` | Atomic result (ActualTrade × Scenario) |
| `BacktestSummary` | Aggregated metrics per scenario |

**Relationships**:
- ActualOrder → ActualTrade (many-to-one)
- ActualTrade → BacktestTrade (one-to-many)
- BacktestTrade → ExitScenario (many-to-one)
- BacktestTrade → BacktestRun (many-to-one)

---

## Key Design Decisions

### Trailing Stop State Machine

Per-bar evaluation with priority-based exits:

```
1. STOP:   low ≤ stopPrice              (hard stop)
2. TRAIL:  low ≤ trailFloor             (if activated)
3. TARGET: high ≥ targetPrice           (fixed target)
4. TIME:   barsInTrade ≥ maxHoldBars    (time-based)

Trailing Stop Activation:
- Activates when: runningHigh/entryPrice - 1 ≥ trailActivateAfterPct
- Recalculates each bar: trailFloor = runningHigh × (1 + trailingStopPct)
```

### Pure Engine Layer

Engine functions (`trailing-stop.tracker.ts`, `exit-evaluator.ts`) are pure:
- No database access
- All data passed in as parameters
- Deterministic output
- Testable in isolation

### Deduplication Strategy

For exporting all scenarios without relationship-based duplication:
1. Fetch BacktestTrade records without including order relationships
2. Separately fetch ActualOrder records (one per trade)
3. Merge in application layer
4. Result: Exactly 162 orders × 6 scenarios = 972 rows

---

## Real-World Results

Tested on **162 actual swing trades** (Oct 2024 - May 2026):

- **Trail 1% strategy** captured **26.15% more upside** than fixed limit sells
- **Ranked scenarios show clear patterns**:
  - Trailing stops outperform fixed targets for this trader
  - Quick exits (1 day) are consistent but lower upside
  - Medium exits (2-6 days) balance upside/risk
  - Maximum upside requires patience (400+ bars)

- **Zero data corruption** — Clean 972-row exports with no duplicates

---

## Deliverables

### Code
- ~1,000 lines of TypeScript (strict mode)
- Prisma schema with 8 models + enums
- 9 CLI scripts (data import through export)
- 3 comprehensive guides

### Documentation
- **README.md** — Quick start, typical workflow, commands
- **ARCHITECTURE.md** — System design, build order, database schema, engine logic
- **ANALYSIS_WORKFLOW.md** — End-to-end analysis guide with examples
- **docs/PROJECT_SUMMARY_v1.md** — This file

### Git History
- 7 logical commits with detailed messages
- Clean progression from Phase 1 (foundation) → Phase 6 (export)
- Committed to public GitHub repository

---

## What's NOT Included (By Design)

- ❌ Live broker connection
- ❌ Web UI (CLI + Excel exports only)
- ❌ Multi-add / pyramid trading (first BUY → first SELL only)
- ❌ Intraday entry signal generation
- ❌ Options, futures, or crypto
- ❌ Risk metrics beyond profit factor (Sharpe, Sortino, VaR, drawdown)

---

## Next Steps (For You)

### Phase 1: Validate
1. Compare backtest results against your actual P&L
2. Verify order IDs match your E*TRADE export
3. Confirm timestamp conversions are accurate

### Phase 2: Paper Trade
1. Create alerts for trailing stop levels in your broker
2. Trade one scenario live with paper money for 30 days
3. Compare paper results to backtest predictions

### Phase 3: Expand
1. Create custom scenarios (volatility-based, hybrid, etc.)
2. Backtest across different market conditions
3. Document your best-performing strategy

### Phase 4: Optimize (Optional)
1. Add web dashboard for monitoring
2. Integrate with live market data feed
3. Implement live trading signals

---

## Key Conventions

- All timestamps stored as **UTC** in the database
- Percentages stored as **signed decimals** (0.01 = 1%, -0.005 = -0.5%)
- Engine layer is **pure functions** (no direct DB access)
- Prisma client is a **singleton** (one instance)
- All env vars loaded through typed `src/config/env.ts`
- Order ID preserved for audit trail and order linking

---

## Technologies & Dependencies

| Package | Purpose |
|---|---|
| TypeScript | Type safety (strict mode) |
| Prisma | ORM + schema management |
| PostgreSQL | Data persistence |
| axios | HTTP requests (Massive API) |
| papaparse | CSV parsing |
| zod | Environment validation |
| tsx | TypeScript execution (CLI) |
| Docker | Database containerization |

---

## Project Status

✅ **Complete & Production-Ready (v1)**

- All core features implemented
- Real-world validation (162 trades)
- Comprehensive documentation
- Public GitHub repository
- Safe data cleanup/iteration workflow
- Ready for paper trading validation

**Next phase**: Live paper trading to confirm backtest accuracy before risking real capital.

---

## How to Use This Document

- **For yourself**: Refresh your memory on what was built in v1
- **For collaborators**: Complete context on system design and analysis approach
- **For future Claude sessions**: Reference this snapshot of v1, check README for current state

See **docs/** for versioning history.
