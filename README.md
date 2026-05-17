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

## Typical Workflow

### Environment & Data Setup

1. **Ingest OHLC candles** — Fetch 5-minute bars from Massive.com for your tickers:
   ```bash
   npm run ingest-ohlc-bulk
   ```
   (Edit `scripts/ingest-ohlc-bulk.ts` to customize tickers and date range)

2. **Create exit scenarios** — Generate the default 6 parameterized exit strategies:
   ```bash
   npx tsx scripts/create-scenarios.ts
   ```
   (Scenarios include fixed targets, hard stops, trailing stops, and time-based exits)

3. **Import trades** — Load your E*TRADE CSV export:
   ```bash
   npm run import-trades -- --file data/orders.csv
   ```
   (Trades are auto-paired by ticker and date; securities are created if missing)

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

All core phases complete. See [ARCHITECTURE.md](ARCHITECTURE.md) for full specifications.

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
# Data Setup
npm run ingest-ohlc-bulk                                         # Fetch bulk OHLC (edit config in script)
npm run ingest-ohlc -- --ticker SPY --from 2026-01-01 --to 2026-05-16  # Fetch single ticker
npm run import-trades -- --file data/orders.csv                  # Import E*TRADE CSV
npx tsx scripts/create-scenarios.ts                              # Create default scenarios

# Backtest & Results
npm run run-backtest -- --name "Test" --description "desc"      # Run backtest
npm run export-results                                           # Export CSVs (latest run)
npm run export-results -- --runId 5                              # Export specific run
npm run list-runs                                                # List all runs
npm run print-results -- --runId 5                               # View results in console
npm run cleanup-trades                                           # Reset trade data
```

**→ See [ANALYSIS_WORKFLOW.md](ANALYSIS_WORKFLOW.md) for complete end-to-end guide**

## Scope

**In Scope:**
- Historical swing trade analysis with trailing stop simulation
- Bar-by-bar backtest engine with priority-based exit logic
- Scenario ranking and comparative metrics
- CSV export for Excel analysis

**Out of Scope (v1):**
- Live trading system
- Live broker connection
- Web UI (CLI + Excel exports)
- Multi-add / pyramid trading
- Intraday entry signal generation
- Options or derivatives

## Future Enhancements

- Web dashboard for interactive result visualization
- Real-time backtest progress monitoring
- Custom exit strategy builder UI
- Performance attribution (which scenarios beat actual by ticker)
- Risk metrics (Sharpe, Sortino, drawdown analysis)
- Batch scenario optimization
