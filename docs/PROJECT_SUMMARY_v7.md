# Swing Trade Backtester - Project Summary v7

**Started**: June 22 2026  
**Status**: Complete  
**Builds on**: v6 (docs/PROJECT_SUMMARY_v6.md)

> Scenario Explorer milestone for inspecting individual trade outcomes under a
> selected scenario.

---

## v7 Goal

Add a focused read-only Scenario Explorer that lets the dashboard move from
run-level storytelling into trade-level diagnosis.

The web app remains a consumer of the v5/v6 analysis foundation. It displays
API-returned values and only performs client-side filtering, sorting, formatting,
and navigation.

---

## Backend

Added read-only scenario explorer endpoints:

- `GET /api/backtest-runs/:runId/scenarios/:scenarioId`
- `GET /api/backtest-runs/:runId/scenarios/:scenarioId/trades`
- `GET /api/backtest-runs/:runId/scenarios/:scenarioId/trades/:backtestTradeId`

The implementation lives in:

- `src/services/scenario-explorer.service.ts`
- `src/api/app.ts`
- `src/api/types.ts`

The service validates that a scenario belongs to the requested run through
`BacktestRunScenario`, projects typed `BacktestTrade` and `ActualTrade` data,
and reuses `calculateNarrativeScenarioMetrics` plus comparable-trade semantics
from the analysis layer.

Trade rows include:

- actual and simulated trade identity
- ticker and asset type
- entry, actual exit, and simulated exit details
- scenario P&L, actual P&L, and vs-actual delta
- holding duration
- entry type
- comparison status
- regime and trail diagnostics for the detail view
- linked actual orders

---

## Frontend

Added durable React routes with React Router:

- `/` - Run Overview
- `/runs/:runId/scenarios/:scenarioId` - Scenario Explorer

The Scenario Explorer includes:

- run/scenario header with integrity status
- deterministic narrative summary
- headline metric cards
- ticker, comparison status, exit reason, entry type, and sort controls
- sortable trade comparison table
- trade detail drawer with scenario parameters and linked orders

Scenario rows in the Run Overview table now navigate to the Scenario Explorer.

---

## Explicitly Deferred

v7 does not include:

- individual trade replay
- candlestick charts
- TradingView Lightweight Charts
- backtest execution from the browser
- live progress streaming
- scenario creation/editing
- authentication
- deployment infrastructure
- mark-to-market open-trade valuation

---

## Validation

Commands run during implementation:

```bash
npm test
npm run build
npm run web:build
```

Known warning:

- `npm run web:build` reports a Vite chunk-size warning because Mantine,
  Recharts, and the dashboard routes are bundled together. This remains
  acceptable for the current local dashboard milestone.
