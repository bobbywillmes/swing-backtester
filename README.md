# Swing Trade Backtester

A TypeScript-based backtesting tool for analyzing swing trade exit strategies, with a focus on trailing stop performance vs. actual trading outcomes.

## Overview

This project simulates different exit strategies against real historical swing trades to answer: **Would trailing stops have captured more upside than my fixed limit sell orders?**

Uses actual E*TRADE order history and 5-minute OHLC candles from Massive.com to run bar-by-bar simulations of parameterized exit strategies.

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Massive.com API key (Stocks Starter subscription or higher)

### Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Copy environment template:
   ```bash
   cp .env.example .env
   ```
   Then update `.env` with your Massive API key.

3. Start PostgreSQL:
   ```bash
   docker-compose up -d
   ```

4. The database schema is already initialized. Verify connection:
   ```bash
   npx prisma studio
   ```

## Project Versioning

This project uses **version-based summaries** to track major milestone accomplishments:

- **`docs/PROJECT_SUMMARY_v1.md`** — Frozen snapshot of v1 (Phases 1-6, May 2026)
  - 162 actual trades analyzed with 6 default exit scenarios
  - Found: Trail 1% strategy beat actual exits by **26.15% avg**
  - Complete, immutable reference for initial scope
  
- **`docs/PROJECT_SUMMARY_v2.md`** — Frozen snapshot of v2 (Phases 7-11, May 18 2026)
  - 20 asset-type-scoped exit scenarios (ETF vs Stock variants)
  - Market regime classification (SPY ATR-based: Trending/Normal/Choppy)
  - Comprehensive flat CSV export with 30+ context columns
  - Ready for Excel pivot analysis by asset type and market regime

**For future sessions**: 
- Start with current **README.md** for quick orientation
- Reference **docs/PROJECT_SUMMARY_v{current}.md** for what was accomplished this version
- Check **ARCHITECTURE.md** for system design details

This approach preserves the "chapter" structure while allowing active development within a version.

---

## Typical Workflow

### Environment & Data Setup

1. **Ingest OHLC candles** — Fetch 5-minute bars from Massive.com for your tickers:
   ```bash
   npm run ingest-ohlc-bulk
   ```
   (Edit `scripts/ingest-ohlc-bulk.ts` to customize tickers and date range)

2. **Import trades** — Load your E*TRADE CSV export:
   ```bash
   npm run import-trades -- --file data/orders.csv
   ```
   (Trades are auto-paired by ticker and date; securities are created if missing)

3. **Create exit scenarios** — v1 default scenarios or v2 expanded matrix:
   ```bash
   # v1: Basic 6 scenarios
   npx tsx scripts/create-scenarios.ts
   
   # v2: 20 asset-type-scoped scenarios (recommended)
   npm run create-scenarios-v2
   ```

4. **Compute market regimes** — (v2 only) Classify daily SPY volatility regimes:
   ```bash
   npm run compute-regimes
   ```
   (Creates 433 regime records based on 14-day ATR, required for regime-aware analysis)

### Running Backtest & Viewing Results

1. **Run the backtest** — Simulate all exit scenarios against your actual trades:
   ```bash
   npm run run-backtest -- --name "Full Portfolio Analysis" --description "All 162 trades"
   ```
   (Add `--ticker SPY` or `--dateFrom 2026-01-01` to filter)

2. **Export results** — Generate CSVs for analysis in Excel:
   ```bash
   npm run export-results
   ```
   (Exports rankings, scenario-trades detail, and run metadata to `exports/`)
   
   Or specify a particular run:
   ```bash
   npm run export-results -- --runId 5
   ```

3. **List previous runs** — See all backtests:
   ```bash
   npm run list-runs
   ```

4. **Print console results** — View metrics and rankings inline:
   ```bash
   npm run print-results -- --runId 5
   ```

### Cleaning Up

If you need to reset trade data and re-import:
```bash
npm run cleanup-trades
```
This removes all trades, orders, and backtest runs (but preserves OHLC candles and scenarios).

## Project Structure

```
swing-backtester/
  prisma/
    schema.prisma         # Complete data model
    migrations/           # Prisma migrations
    seed.ts              # Initial securities seeding
  src/
    config/
      env.ts             # Typed environment loader (Zod)
    db/
      prisma.ts          # Singleton PrismaClient
    ingestion/
      massive.client.ts       # Massive.com API wrapper
      ohlc.ingestor.ts        # Fetch & upsert OHLC candles
      trade.importer.ts       # Parse E*TRADE CSV → ActualOrder
      trade.pairer.ts         # Pair buys/sells → ActualTrade
    engine/
      backtest.engine.ts      # Main backtest loop
      exit-evaluator.ts       # Bar-by-bar exit logic
      trailing-stop.tracker.ts # State machine for trailing stops
    analysis/
      metrics.calculator.ts   # Aggregate results
      scenario.ranker.ts      # Compare scenarios
    services/
      backtest.service.ts     # Engine orchestration
      ohlc.service.ts         # Query candles
      scenario.service.ts     # CRUD for scenarios
    types/
      *.types.ts             # TypeScript type definitions
    utils/
      date.utils.ts           # Market day helpers
      csv.utils.ts            # CSV parsing helpers
  scripts/
    ingest-ohlc.ts           # CLI: fetch OHLC candles for single ticker
    ingest-ohlc-bulk.ts      # CLI: fetch OHLC for multiple tickers
    import-trades.ts         # CLI: load E*TRADE CSV
    create-scenarios.ts      # CLI: seed default exit scenarios
    run-backtest.ts          # CLI: execute backtest
    print-results.ts         # CLI: display results in console
    export-results.ts        # CLI: export CSVs for Excel analysis
    list-runs.ts             # CLI: list all backtest runs
    cleanup-trades.ts        # CLI: reset trade data
  docker-compose.yml
  .env.example
  ARCHITECTURE.md       # Complete spec & build order
  tsconfig.json
  package.json
  README.md
  .gitignore
```

## Build Status

All phases complete (v1 & v2). See [ARCHITECTURE.md](ARCHITECTURE.md) for full specifications.

### v1 (Complete)

### Phase 1 ✓ Foundation
- Docker setup, Prisma schema, singleton client, env loader, seed data

### Phase 2 ✓ OHLC Ingestion
- Massive.com API client, candle fetching & upserting, bulk import

### Phase 3 ✓ Trade Import
- E*TRADE CSV parsing, order import, buy/sell pairing, auto-create securities

### Phase 4 ✓ Engine
- Trailing stop state machine, priority-based exit evaluation, backtest orchestration

### Phase 5 ✓ Results Analysis
- Metrics aggregation, scenario ranking, composite scoring

### Phase 6 ✓ Export & Cleanup
- CSV exports with Order IDs and Scenario names, optional runId parameter, data cleanup tools

### v2 (Complete)

### Phase 7 ✓ Schema Migration
- Added `targetIsHardExit` to ExitScenario, new RegimeType enum, MarketRegime model

### Phase 8 ✓ Market Regimes
- SPY ATR-based daily regime classification (Trending Low Vol / Normal / Choppy High Vol)
- 433 regimes computed from 5-min candles (Oct 2024 - May 2026)

### Phase 9 ✓ Engine Enhancement
- "Target unlocks trail" feature (targetIsHardExit = false → activate trail instead of exit)
- targetUnlocked state machine field, regime context population

### Phase 10 ✓ Expanded Scenarios
- 20 v2 scenarios: 8 Trail Only + 8 Target Unlock Trail + 4 Fixed Target
- Asset-type scoped (separate ETF vs Stock records)

### Phase 11 ✓ Comprehensive Export
- Flat CSV with 30+ context columns (trade identity, scenario config, regime context, running high, vs actual)
- Excel pivot-ready format

## Data Integrity & Validation (Post-v2)

During v2 validation, several critical data issues were discovered and fixed:

### Issues Found & Fixed

1. **UTF-8 Encoding Corruption**
   - 8 scenarios had corrupted Unicode characters (e.g., "â†'" instead of "→")
   - Root cause: Database encoding during initial scenario creation
   - Fixed: Cleaned scenarios and updated all creation scripts to use ASCII "->" notation
   - Result: All scenario names now display correctly

2. **"Target Unlocks Trail" Feature Bug**
   - Unlock scenarios (targetIsHardExit = false) had incorrect default activation thresholds
   - Bug: `trailActivateAfterPct` defaulting to null (0%), causing trails to activate immediately at entry instead of waiting for target
   - Impact: Unlock scenarios produced identical results to pure trail scenarios, defeating the feature
   - Fixed: Set `trailActivateAfterPct = targetPct` for all 8 unlock scenarios in `create-scenarios-v2.ts`
   - Result: Unlock scenarios now rank 30-40% higher (e.g., "+2.0% Unlock → Trail 1.0%" score improved from 22.8 to 74.0)

3. **Duplicate Scenarios**
   - v1-migrated scenarios with "(activate at +X%)" naming had identical parameters and results to v2 "Unlock" variants
   - Found 4 duplicate pairs:
     - "ETF: Trail 0.5% (activate at +0.5%)" vs "+0.5% Unlock → Trail 0.5%"
     - "ETF: Trail 1% (activate at +1%)" vs "+1.0% Unlock → Trail 0.75%"
     - Similar stock variants
   - Fixed: Deactivated 4 v1-migrated scenarios, kept v2-style names for consistency
   - Result: 26 unique, non-redundant scenarios

### Validation Baseline

- **Run-23** is the validated baseline after all fixes
- 26 unique scenarios with differentiated results
- All 162 trades analyzed with clean, duplicate-free data
- Excel pivot tables confirm no aggregate duplicates across scenarios
- Use run-23 results as the authoritative v2 analysis baseline

### Detection & Cleanup Scripts

New utility scripts added for ongoing validation:
- `scripts/find-duplicate-scenarios.ts` — Identifies scenarios by parameter fingerprint
- `scripts/remove-duplicate-scenarios.ts` — Deactivates identified duplicates
- Added to `npm` scripts and documented in CLAUDE.md

## Database

**PostgreSQL 16** running in Docker on port 5433.

Initial securities seeded:
- **ETFs**: SPY, QQQ, DIA, IWM
- **Stocks**: AAPL, AMZN, GOOG, META, MSFT

## Key Design Principles

- **Strict TypeScript** throughout (no `any`, `noUnusedLocals: true`)
- **Pure engine layer** — no direct DB access in backtest logic
- **Singleton Prisma client** — imported from `src/db/prisma.ts`
- **Typed environment variables** — loaded via `src/config/env.ts`
- **Percentages as signed decimals** — `0.01` = +1%, `-0.005` = -0.5%
- **UTC timestamps** — all times stored and converted to UTC

## Commands

All scripts are available via npm run:

```bash
# Data Setup (v1 & v2)
npm run ingest-ohlc-bulk                                         # Fetch bulk OHLC (edit config in script)
npm run ingest-ohlc -- --ticker SPY --from 2026-01-01 --to 2026-05-16  # Fetch single ticker
npm run import-trades -- --file data/orders.csv                  # Import E*TRADE CSV

# Scenarios
npx tsx scripts/create-scenarios.ts                              # v1: Create 6 default scenarios
npm run create-scenarios-v2                                      # v2: Create 20 asset-scoped scenarios

# Market Regimes (v2 only)
npm run compute-regimes                                          # Compute SPY ATR-based regime classifications

# Backtest & Results
npm run run-backtest -- --name "Test" --description "desc"      # Run backtest
npm run export-results                                           # Export CSVs (latest run)
npm run export-results -- --runId 5                              # Export specific run
npm run list-runs                                                # List all runs
npm run print-results -- --runId 5                               # View results in console

# Data Validation
npm run find-duplicate-scenarios                                 # Detect scenarios with identical parameters
npm run remove-duplicate-scenarios                               # Deactivate duplicate scenarios

# Maintenance
npm run cleanup-trades                                           # Reset trade data
```

**→ See [ANALYSIS_WORKFLOW.md](ANALYSIS_WORKFLOW.md) for complete end-to-end guide**

## Scope

**In Scope (v1 & v2):**
- Historical swing trade analysis with trailing stop simulation
- Bar-by-bar backtest engine with priority-based exit logic
- Asset-type-scoped exit scenarios (ETF vs Stock parameters)
- Market regime classification (SPY ATR-based volatility tagging)
- Scenario ranking and comparative metrics
- Comprehensive flat CSV export for Excel analysis
- Regime-aware result segmentation (pivot by asset type & market regime)

**Out of Scope (v2):**
- Live trading system
- Live broker connection
- Web UI (CLI + Excel exports)
- Multi-add / pyramid trading
- Intraday entry signal generation
- Options or derivatives
- Risk metrics (Sharpe, Sortino, drawdown) — deferred to v3

## Future Enhancements

- Web dashboard for interactive result visualization
- Real-time backtest progress monitoring
- Custom exit strategy builder UI
- Performance attribution (which scenarios beat actual by ticker)
- Risk metrics (Sharpe, Sortino, drawdown analysis)
- Batch scenario optimization
