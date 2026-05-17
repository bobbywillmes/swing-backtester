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
    ingest-ohlc.ts      # CLI: fetch OHLC candles
    import-trades.ts    # CLI: load E*TRADE CSV
    run-backtest.ts     # CLI: execute backtest
    print-results.ts    # CLI: display results
  docker-compose.yml
  .env.example
  ARCHITECTURE.md       # Complete spec & build order
  tsconfig.json
  package.json
  README.md
  .gitignore
```

## Build Phases

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete specifications and build order.

### Phase 1 ✓ Foundation
- Docker setup, Prisma schema, singleton client, env loader, seed data

### Phase 2 OHLC Ingestion
- Massive.com API client, candle fetching & upserting, CLI script

### Phase 3 Trade Import
- E*TRADE CSV parsing, order import, buy/sell pairing

### Phase 4 Engine
- Trailing stop state machine, exit evaluation, backtest orchestration

### Phase 5 Results
- Metrics aggregation, scenario ranking, result display

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

## Scripts

All scripts use `tsx` for direct TypeScript execution:

```bash
npx tsx scripts/import-trades.ts --file ./data/orders.csv   # Import E*TRADE orders
npx tsx scripts/ingest-ohlc.ts --ticker SPY --from 2026-05-01 --to 2026-05-16  # Fetch OHLC
npx tsx scripts/create-scenarios.ts                          # Create default exit strategies
npx tsx scripts/run-backtest.ts --name "My Test"             # Execute backtest
npx tsx scripts/list-runs.ts                                 # List all backtests
npx tsx scripts/print-results.ts --runId 1                   # Display results & ranking
```

**→ See [ANALYSIS_WORKFLOW.md](ANALYSIS_WORKFLOW.md) for complete end-to-end guide**

## What This Is NOT (Yet)

- Not a live trading system
- Not connected to a live broker
- No web API / UI (CLI only for v0)
- No multi-add / campaign tracking (pairs first BUY → first SELL only)
- No intraday entry signal generation

## Next Steps

1. Implement Massive.com API client & OHLC ingestion
2. Build E*TRADE CSV importer & trade pairer
3. Develop backtest engine with trailing stop logic
4. Add metrics calculator & results display
