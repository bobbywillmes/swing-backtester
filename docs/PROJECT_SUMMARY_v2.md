# Swing Trade Backtester — Project Summary v2

**Started**: May 17 2026
**Status**: 🔄 In Development
**Builds on**: v1 (docs/PROJECT_SUMMARY_v1.md)

> Update this document as v2 features are completed. Freeze when v2 is done.

---

## v2 Goals

Three interconnected improvements, all using existing data (no new OHLC ingestion required):

1. **Expanded scenario matrix** — Asset-type-specific parameters (ETF vs Stock), plus "target unlocks trail" as a distinct ruleset
2. **Market regime classification** — SPY ATR-based daily regime tags (trending/normal/choppy), stored in DB, joined to backtest results
3. **Richer exports** — One flat comprehensive CSV per run with all context columns, ready for Excel pivot analysis

---

## Schema Changes

### New model: `MarketRegime`

Computed from existing SPY candles. One row per trading day.

```prisma
model MarketRegime {
  date        DateTime   @id        // trading day (UTC midnight)
  spyAtr      Float                 // 14-day Wilder ATR (absolute)
  spyAtrPct   Float                 // spyAtr / spyClose (normalized %)
  spyClose    Float                 // SPY daily close
  spy20dSma   Float?                // 20-day simple moving average
  spyAboveSma Boolean?              // close > 20dSMA (trend direction)
  regime      RegimeType
}

enum RegimeType {
  TRENDING_LOW_VOL    // spyAtrPct < 0.008
  NORMAL              // 0.008 <= spyAtrPct <= 0.015
  CHOPPY_HIGH_VOL     // spyAtrPct > 0.015
}
```

**Thresholds are initial estimates — tune after first analysis run.**

### Modified model: `ExitScenario`

Add one field to disambiguate "target as hard exit" vs "target as trail activation":

```prisma
model ExitScenario {
  // ... existing fields ...
  targetIsHardExit  Boolean  @default(true)
  // true  = exit immediately when price hits targetPct (v1 behavior)
  // false = targetPct just activates the trail, no immediate exit
}
```

### Modified model: `BacktestTrade`

Add regime context at entry:

```prisma
model BacktestTrade {
  // ... existing fields ...
  regimeAtEntry  RegimeType?    // populated from MarketRegime at entryTs date
  spyAtrPctAtEntry  Float?      // raw ATR% value for continuous analysis
}
```

---

## Scenario Matrix (v2 Seed)

All scenarios scoped by `assetTypeScope`. ETF and Stock variants are separate DB records.

### Group 1: Trail Only (no fixed target)

| Scenario Name | Asset Type | trailingStopPct | trailActivateAfterPct |
|---|---|---|---|
| ETF: Tight Trail 0.25% | ETF | -0.0025 | null |
| ETF: Medium Trail 0.5% | ETF | -0.005 | null |
| ETF: Loose Trail 0.75% | ETF | -0.0075 | null |
| ETF: Very Loose Trail 1.0% | ETF | -0.01 | null |
| Stock: Tight Trail 0.5% | STOCK | -0.005 | null |
| Stock: Medium Trail 1.0% | STOCK | -0.01 | null |
| Stock: Loose Trail 1.5% | STOCK | -0.015 | null |
| Stock: Very Loose Trail 2.0% | STOCK | -0.02 | null |

### Group 2: Hit Target → Trail Activates (targetIsHardExit = false)

Target is NOT a hard exit — it just unlocks the trailing stop.
This is the "AI Trader" ruleset: let the position run, but protect gains once a threshold is cleared.

| Scenario Name | Asset Type | targetPct | trailingStopPct | targetIsHardExit |
|---|---|---|---|---|
| ETF: +0.5% Unlock → Trail 0.25% | ETF | 0.005 | -0.0025 | false |
| ETF: +0.5% Unlock → Trail 0.5% | ETF | 0.005 | -0.005 | false |
| ETF: +1.0% Unlock → Trail 0.5% | ETF | 0.01 | -0.005 | false |
| ETF: +1.0% Unlock → Trail 0.75% | ETF | 0.01 | -0.0075 | false |
| Stock: +1.0% Unlock → Trail 0.5% | STOCK | 0.01 | -0.005 | false |
| Stock: +1.0% Unlock → Trail 1.0% | STOCK | 0.01 | -0.01 | false |
| Stock: +2.0% Unlock → Trail 1.0% | STOCK | 0.02 | -0.01 | false |
| Stock: +2.0% Unlock → Trail 1.5% | STOCK | 0.02 | -0.015 | false |

### Group 3: Fixed Target Only (baseline, hard exit)

| Scenario Name | Asset Type | targetPct | targetIsHardExit |
|---|---|---|---|
| ETF: Fixed Target +0.5% | ETF | 0.005 | true |
| ETF: Fixed Target +1.0% | ETF | 0.01 | true |
| Stock: Fixed Target +1.0% | STOCK | 0.01 | true |
| Stock: Fixed Target +2.0% | STOCK | 0.02 | true |

**Total: ~20 scenarios**. All scoped so the engine only applies each to its asset type.

---

## Engine Changes

### Exit evaluator update: `targetIsHardExit`

Current priority order: STOP > TRAIL > TARGET > TIME

With `targetIsHardExit = false`, the evaluation changes for the TARGET check:

```
If targetIsHardExit = true (v1 behavior):
  high >= targetPrice → EXIT at targetPrice

If targetIsHardExit = false:
  high >= targetPrice AND trail not yet active → SET trailActive = true, DON'T exit
  (trail then evaluates normally on subsequent bars)
```

**Implementation location**: `src/engine/exit-evaluator.ts` and `src/engine/trailing-stop.tracker.ts`

The state machine needs one new state field: `targetUnlocked: boolean` — set to true when price crosses targetPct in unlock mode. Once true, trail activates using `trailingStopPct` from the scenario.

---

## New Scripts

| Script | Purpose |
|---|---|
| `scripts/compute-regimes.ts` | Read SPY candles from DB, compute ATR + SMA, write MarketRegime rows |
| `scripts/create-scenarios-v2.ts` | Seed all v2 scenarios (upsert-safe) |
| `scripts/export-full.ts` | Export comprehensive flat CSV (all context columns, regime included) |

---

## Full Export Schema (for Excel handoff)

One row = one actual trade × one scenario.

```
# Trade Identity
orderId           -- E*TRADE order number
ticker
assetType         -- ETF | STOCK

# Entry
entryDate         -- Excel-friendly EST format
entryPrice
shares
capitalDeployed

# Scenario Config
scenarioName
scenarioGroup     -- "Trail Only" | "Target Unlock Trail" | "Fixed Target"
assetTypeScope
trailingStopPct
trailActivateAfterPct
targetPct
targetIsHardExit
stopPct
maxHoldBars

# Simulated Exit
exitDate
exitPrice
exitReason        -- TARGET | STOP | TRAIL | TIME | OPEN
pnlPct
pnlDollar
barsInTrade
daysInTrade

# Running High (trail insight)
runningHighPrice
runningHighPct
trailActivatedAt

# vs Actual
actualExitDate
actualExitPrice
actualExitReason
actualPnlPct
actualPnlDollar
pnlVsActualPct    -- positive = scenario beat actual
pnlVsActualDollar

# Market Regime
regimeAtEntry     -- TRENDING_LOW_VOL | NORMAL | CHOPPY_HIGH_VOL
spyAtrPctAtEntry  -- raw normalized ATR for continuous analysis
spyAboveSmaAtEntry -- true/false (trend direction)
```

This CSV is the handoff to Excel for pivot analysis.

---

## Build Order

### Phase 7 — Schema Migration
1. Add `targetIsHardExit` to `ExitScenario`
2. Add `MarketRegime` model + `RegimeType` enum
3. Add `regimeAtEntry`, `spyAtrPctAtEntry` to `BacktestTrade`
4. Run: `npx prisma migrate dev --name v2-regime-and-scenario-update`

### Phase 8 — Compute Market Regimes
5. Build `scripts/compute-regimes.ts`
   - Query all SPY daily candles from `OhlcCandle` (aggregate 5-min → daily)
   - Compute daily TR, 14-day ATR (Wilder's smoothing)
   - Compute 20-day SMA
   - Classify regime
   - Upsert into `MarketRegime`
6. Run for all dates in trade history

### Phase 9 — Engine Update
7. Add `targetIsHardExit` handling to `src/engine/trailing-stop.tracker.ts`
   - New state: `targetUnlocked: boolean`
   - Logic: when `!targetIsHardExit` and price crosses target, set `targetUnlocked = true`
8. Update `src/engine/exit-evaluator.ts`
   - TARGET check branches on `targetIsHardExit`
9. Update engine to populate `regimeAtEntry` on `BacktestTrade` (join via entry date)

### Phase 10 — New Scenarios
10. Build `scripts/create-scenarios-v2.ts` with full matrix above
11. Run to seed all ~20 scenarios
12. Run a full backtest to validate

### Phase 11 — Full Export
13. Build `scripts/export-full.ts` with all columns above
14. Validate CSV in Excel (pivot by assetType, regimeAtEntry, scenarioGroup)

---

## ATR Calculation Reference

**Wilder's 14-day ATR** (standard):

```
Daily True Range = max(
  high - low,
  |high - previousClose|,
  |low  - previousClose|
)

ATR[0] = simple average of first 14 TRs
ATR[n] = (ATR[n-1] × 13 + TR[n]) / 14   ← Wilder's smoothing

Normalized ATR = ATR / Close   ← makes it comparable across prices and time
```

**Computing from 5-min candles** (since we don't have daily bars):
- Group candles by trading date
- `dailyOpen`  = open of first candle of day
- `dailyHigh`  = max(high) across all candles
- `dailyLow`   = min(low) across all candles
- `dailyClose` = close of last candle of day
- `previousClose` = dailyClose of previous trading day
- Then compute TR normally

---

## Regime Threshold Tuning

Initial thresholds (adjust after first analysis run):

| Regime | Condition | Typical market feel |
|---|---|---|
| TRENDING_LOW_VOL | normalized ATR < 0.8% | Smooth uptrend, low fear |
| NORMAL | 0.8% - 1.5% | Mixed conditions |
| CHOPPY_HIGH_VOL | > 1.5% | Volatile, news-driven, fearful |

After computing regimes, check the distribution across your 162 trade dates — ideally not all in one bucket. If the split is extreme, adjust thresholds.

---

## Key Design Decisions

**Why ATR over VIX?**
VIX requires fetching external data. SPY ATR is computable entirely from candles already in the database. No new API calls, no new data contract.

**Why aggregate 5-min → daily for ATR?**
ATR is a daily concept. The 5-min candles are already in the DB. Aggregating in the compute script is cleaner than storing a separate daily OHLC table — though a `DailyCandle` view could be added later if useful for other purposes.

**Why `targetIsHardExit` instead of a new exit type?**
The existing `ExitScenario` model already has `targetPct`. Adding one boolean is the smallest change. It keeps scenario configuration in one place and avoids multiplying model complexity.

**Why separate ETF and Stock scenarios rather than one generic scenario?**
Because the analysis question is specifically "do ETFs and stocks behave differently?" Having separate records means you can filter by `assetTypeScope` in Excel without needing to cross-reference a lookup table. Simpler to analyze.

---

## Connection to AI Trader

The "target unlocks trail" ruleset (`targetIsHardExit = false`) is the pattern being considered for the AI Trader's `ExitProfile`. The backtester will validate which target % / trail % combinations work best per asset type and regime before those values are used in live trading.

Expected output: a recommended `ExitProfile` config per asset type + regime combination.

---

## What's NOT in v2

- ❌ Web UI (still CLI + Excel)
- ❌ Entry signal simulation (still uses actual trade entry points)
- ❌ Multi-add / pyramid trade handling
- ❌ Risk metrics (Sharpe, Sortino, drawdown) — deferred to v3
- ❌ VIX integration (ATR is sufficient for regime, no need for external VIX data)
- ❌ Live trading connection

---

**Last Updated**: May 2026 — v2 planning complete, ready for Claude Code implementation
