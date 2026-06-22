# Swing Trade Backtester - Project Summary v6

**Started**: June 22 2026  
**Status**: Complete  
**Builds on**: v5 (docs/PROJECT_SUMMARY_v5.md)

> First UI milestone: a narrow read-only API and Run Overview dashboard that
> consumes the v5 analysis foundation.

---

## v6 Goal

Move from trustworthy CSV exports to an application view that tells the story
of a completed backtest run.

The v6 web app is a consumer of v5 metrics. It does not recalculate financial
metrics in the browser.

---

## Backend

Added a small read-only Express API:

```bash
npm run api
npm run api:dev
```

Endpoints:

- `GET /api/health`
- `GET /api/backtest-runs`
- `GET /api/backtest-runs/:runId`
- `GET /api/backtest-runs/:runId/overview`
- `GET /api/backtest-runs/:runId/scenarios`

The overview endpoint includes:

- run metadata
- integrity status
- actual portfolio profit
- selected scenario metrics
- comparable/open/improved/worse counts
- realized uplift
- holding duration
- concentration metrics
- ticker contribution breakdown
- chronological actual-versus-simulated cumulative-profit data

The implementation lives in:

- `src/api/app.ts`
- `src/api/server.ts`
- `src/api/types.ts`
- `src/services/run-overview.service.ts`

Controllers are thin. Metric calculation is delegated to
`src/analysis/narrative-metrics.ts` and integrity checks use the v5 validator.

---

## Frontend

Added a Vite React/Mantine app:

```bash
npm run web:dev
npm run web:build
```

Location:

- `apps/web`

Run Overview includes:

- run selector
- scenario selector
- asset-type filter
- headline metric cards
- deterministic narrative summary
- actual-versus-scenario cumulative-profit chart
- largest trade contributor chart
- contribution-by-ticker chart
- scenario comparison table

The Vite dev server proxies `/api` to `http://127.0.0.1:3000`.

Run both servers locally:

```bash
npm run api
npm run web:dev
```

Then open:

```text
http://127.0.0.1:5173
```

---

## Explicitly Deferred

v6 does not include:

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

API smoke test:

- `GET /api/backtest-runs/29/overview?scenarioId=50`

Browser verification was attempted with the in-app browser, but the browser
runtime failed in this session before page interaction. The app was still
validated through Vite production build and local HTTP smoke checks.

Known warning:

- `npm run web:build` reports a Vite chunk-size warning because Mantine and
  Recharts are bundled into the first dashboard build. This is acceptable for
  v6 and can be addressed with code splitting later.
