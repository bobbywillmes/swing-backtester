# Swing Trade Backtester - Project Summary v5

**Started**: June 22 2026  
**Status**: Complete  
**Builds on**: v4 (docs/PROJECT_SUMMARY_v4.md)

> Living implementation document for the v5 analysis-foundation milestone.

---

## v5 Goal

Build the trustworthy analysis foundation needed before adding a web API,
dashboard, replay mode, or live progress UI.

This branch does not add a frontend or Express API. It focuses on security
classification integrity, comparable-trade semantics, deterministic analysis
metrics, and auditable exports.

---

## Security Catalog

Security metadata now has one source of truth:

- `src/data/security-catalog.ts`

The catalog stores:

- symbol
- display name
- asset type

It includes every symbol currently present in the actual-trade dataset:

- ETFs: DIA, IWM, QQQ, QQQM, RSP, SPY, VOO, VTV
- Stocks: AAPL, AMZN, GOOG, META, MSFT, NVDA, TSLA

`prisma/seed.ts` now repairs stored names and asset types on rerun. The trade
importer uses the same catalog and rejects unknown symbols before writing
orders, so unknown symbols can no longer be silently classified as STOCK.

Run:

```bash
npm run seed
```

---

## Integrity Validation

New command:

```bash
npm run validate-security-integrity
npm run validate-security-integrity -- --runId 28
```

The validator is safe and non-destructive. It reports:

- stored symbols missing from the trusted catalog
- actual-trade symbols missing from the trusted catalog
- stored security metadata that disagrees with the catalog
- run-level conflicts where scenario asset-type scope does not match the
  trade security asset type

It exits nonzero when conflicts are found.

Run 28 is a useful discovery run, but it is not the authoritative
post-classification-fix portfolio baseline because RSP, QQQM, VOO, and VTV were
stored as STOCK when that run executed.

---

## Comparable Trade Semantics

Realized comparison metrics use only comparable realized trades.

A comparable realized trade must have:

- completed simulated exit
- completed actual exit
- non-null simulated P&L
- non-null actual P&L
- non-null delta versus actual

Open simulations are excluded from realized-vs-actual comparison totals and
rates. Null deltas are not treated as zero. Total scenario performance remains
separate from realized comparable performance.

---

## Narrative Metrics

New pure analysis module:

- `src/analysis/narrative-metrics.ts`

It calculates:

- total trades
- comparable trades
- open simulations
- improved, worse, and unchanged counts
- improvement rate
- simulated realized profit
- actual comparable profit
- incremental realized profit
- realized uplift percentage
- average and median dollar improvement
- average and median percentage improvement
- average and median holding bars/days
- largest positive and negative contributors
- top-five and top-ten contribution concentration

Contribution concentration is only available when total incremental realized
profit is positive. It uses all available comparable trades when fewer than
five or ten exist and returns null for zero or negative incremental profit.

---

## Export Semantics

The v4 Actual Trade benchmark row remains presentation-only:

- one synthetic row per actual trade
- emitted before simulated scenario rows
- `scenarioName = "Actual Trade"`
- `scenarioGroup = "Actual"`
- vs-actual values are numeric zero
- not stored as an `ExitScenario` or `BacktestTrade`
- excluded from scenario rankings and comparable-trade calculations

The rankings CSV now exports exact integer counts instead of reconstructing
counts from percentages:

- Total Trades
- Comparable Trades
- Open Simulations
- Improved Trades
- Worse Trades
- Unchanged Trades
- Improvement Rate
- Actual Comparable Profit
- Simulated Realized Profit
- Incremental Realized Profit
- Realized Uplift %
- Median Improvement $
- Median Improvement %
- Median Hold Days
- Top 5 Contribution %
- Top 10 Contribution %

---

## Commands

```bash
npm test
npm run build
npm run seed
npm run validate-security-integrity
npm run validate-security-integrity -- --runId 28
npm run run-backtest -- --name "Post Classification Baseline"
npm run export-results -- --runId <runId>
```

Before creating a new authoritative baseline:

1. Run `npm run seed`.
2. Run `npm run validate-security-integrity`.
3. Run `npm run validate-security-integrity -- --runId <historicalRunId>` to
   identify historical conflicts.
4. Confirm active scenario definitions are valid.
5. Run a new complete backtest.
6. Export the new run and validate row populations.

---

## Completed Validation Notes

Seed repair was run successfully with:

```bash
npm run seed
```

Current metadata validation passes:

```bash
npm run validate-security-integrity
```

Run 28 validation fails as expected after repair:

```bash
npm run validate-security-integrity -- --runId 28
```

It reports 52 scope-conflict groups across QQQM, RSP, VOO, and VTV where
stock-scoped scenarios were used for securities now correctly classified as
ETFs. Run 28 remains a historical discovery run, not the authoritative
post-classification-fix baseline.

Active scenarios were checked with:

```bash
npm run find-duplicate-scenarios
```

No active duplicates were found.

## Authoritative v5 Baseline

New baseline run:

- Run ID: 29
- Name: `v5 Post Classification Baseline`
- Scope: full portfolio after trusted security catalog repair
- Backtest rows: 2,106 simulated scenario-trade rows
- Export rows: 2,268 detailed rows, including 162 Actual Trade benchmark rows

Validation passes:

```bash
npm run validate-security-integrity -- --runId 29
```

Export command:

```bash
npm run export-results -- --runId 29
```

Headline corrected result for `ETF: +1.0% Unlock -> Trail 0.5%`:

- Total trades: 112
- Comparable trades: 107
- Open simulations: 5
- Improved trades: 61
- Worse trades: 46
- Unchanged trades: 0
- Improvement rate: 57.01%
- Simulated realized profit: $1,324,548.81
- Actual comparable profit: $645,380.84
- Incremental realized profit: $679,167.98
- Realized uplift: 105.24%
- Median dollar improvement: $684.29
- Median holding time: 4.46 trading days
- Average holding time: 11.33 trading days
- Top-five contribution: 49.55%
- Top-ten contribution: 79.02%

Difference from the Run 28 core-ETF sanity check:

- Run 29 includes the newly repaired ETF symbols RSP, QQQM, VOO, and VTV in ETF-scoped scenarios.
- Total ETF scenario trades increased from 102 to 112 for this scenario.
- Comparable trades increased from 97 to 107.
- Improved trades increased from 55 to 61.
- Realized uplift changed from about 111.65% to about 105.24% because the comparable population is now broader and correctly classified.
