# Swing Backtester Agent Guide

Use this file as the active project guidance for coding agents.

## Project Status

Current milestone: v7 Scenario Explorer.

Completed historical summaries are frozen in:

- `docs/PROJECT_SUMMARY_v1.md`
- `docs/PROJECT_SUMMARY_v2.md`
- `docs/PROJECT_SUMMARY_v3.md`
- `docs/PROJECT_SUMMARY_v4.md`

The active v5 summary is:

- `docs/PROJECT_SUMMARY_v5.md`

The active v6 summary is:

- `docs/PROJECT_SUMMARY_v6.md`

The active v7 summary is:

- `docs/PROJECT_SUMMARY_v7.md`

Do not rewrite frozen summaries to make newer behavior appear historical.

## Scope

This project is a TypeScript CLI backtester for swing-trade exit strategy
research. It compares simulated exits against actual E*TRADE trade history
using 5-minute OHLC bars.

In v7, do not build:

- individual trade replay
- candlestick charts
- TradingView Lightweight Charts
- backtest execution from the browser
- live progress streaming
- scenario creation/editing
- authentication
- deployment infrastructure
- mark-to-market open-trade valuation

Those belong in later branches.

## Architecture Rules

- Strict TypeScript.
- No `any`.
- Engine layer remains pure and has no database access.
- Use the singleton Prisma client from `src/db/prisma.ts`.
- Prisma types should remain in service/data/script layers.
- Percentages are signed decimals: `0.01` means 1%.
- Timestamps are UTC internally.
- Imports, seeds, validation commands, and repair commands must be idempotent.
- Do not perform destructive database cleanup unless explicitly requested.
- Do not change exit execution behavior or scenario definitions unless a
  confirmed defect requires it.
- Avoid unrelated refactors.

## Security Classification

Security metadata is centralized in:

- `src/data/security-catalog.ts`

The seed and trade importer must use this catalog. Unknown symbols must be
explicitly surfaced; do not silently classify them as STOCK.

Run:

```bash
npm run seed
npm run validate-security-integrity
npm run validate-security-integrity -- --runId <runId>
```

Historical runs can become non-authoritative after metadata repair if their
scenario asset-type scope conflicts with the repaired security asset type.

## Analysis Semantics

Comparable realized trades must have:

- completed simulated exit
- completed actual exit
- non-null simulated P&L
- non-null actual P&L
- non-null delta versus actual

Open simulations are excluded from realized-vs-actual totals and rates. Null
deltas are not zero. Keep total scenario performance separate from realized
comparison performance.

Pure deterministic metrics live in:

- `src/analysis/narrative-metrics.ts`

Do not use an LLM to generate analysis values.

## Export Semantics

The v4 Actual Trade row is presentation-only:

- exactly one synthetic row per actual trade
- emitted before scenario rows
- `scenarioName = "Actual Trade"`
- `scenarioGroup = "Actual"`
- vs-actual values are numeric zero
- not counted as a scenario, comparable trade, contributor, win/loss, or
  simulated trade

The synthetic row is created by export helpers, not by database records.

## API And Web Semantics

The read-only Express API lives in `src/api` and overview orchestration lives in
`src/services/run-overview.service.ts`.

The React app lives in `apps/web`.

The web app must consume API-returned values. Do not recreate financial metric
calculations in browser components. Browser logic may format, select, sort, and
render values, but comparable-trade populations, realized uplift, contribution
concentration, and cumulative profit data should come from the API.

## Commands

```bash
npm test
npm run build
npm run api
npm run web:dev
npm run web:build
npm run seed
npm run validate-security-integrity
npm run validate-security-integrity -- --runId <runId>
npm run create-scenarios-v2
npm run run-backtest -- --name "Run name"
npm run export-results -- --runId <runId>
npm run list-runs
```

## Commit Style

Use conventional commits:

- `fix(data): ...`
- `feat(validation): ...`
- `fix(analysis): ...`
- `fix(exports): ...`
- `docs(project): ...`
- `test(...): ...`

Before each commit, review the diff and run relevant tests plus
`npm run build` when practical.
