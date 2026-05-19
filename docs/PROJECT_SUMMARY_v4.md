# Swing Trade Backtester — Project Summary v4

**Started**: May 19 2026  
**Status**: ✅ Complete (May 19 2026, Phases 14-15)  
**Builds on**: v3 (docs/PROJECT_SUMMARY_v3.md)

> Frozen snapshot of v4 completion. Actual Trade rows implemented and validated.

---

## v4 Goal

Add an "Actual Trade" row as the first row per trade in the scenario-trades CSV export. This gives a true benchmark row alongside every simulated scenario, making head-to-head comparison possible directly in Excel.

**Why**: Currently the CSV shows only simulated results (14 scenarios per trade × 162 trades = 2,268 rows). To compare a scenario against what actually happened, you have to look at separate columns (actualExitPrice, actualPnlPct, etc.). With v4, filtering `scenarioName = "Actual Trade"` instantly shows the real trade history as the first row in each trade group.

**Scope**: Export-only change. No schema migration, no engine changes, no new scripts.

---

## Implementation Plan

### Phase 14: Update `getRunAllTrades` Query

**File**: `src/services/results.service.ts`

**Change 1**: Add missing `actualExitReason` to the actualTrade.select (currently missing, needed for synthetic rows).

**Change 2**: No other changes needed — orders are already fetched separately and will be mapped to synthetic rows.

### Phase 15: Synthetic "Actual Trade" Rows in Export

**File**: `scripts/export-results.ts`

**Algorithm**:
1. After `const allTrades = await getRunAllTrades(runId)`, group trades by `actualTradeId`
2. For each group (ordered by first entry date):
   - Create one synthetic "Actual Trade" row with:
     - `scenarioName = "Actual Trade"`
     - `scenarioGroup = "Actual"`
     - All scenario config columns (`trailingStopPct`, `targetPct`, etc.) → `null`
     - `exitTs = actualTrade.actualExitTs`
     - `exitPrice = actualTrade.actualExitPrice`
     - `exitReason = actualTrade.actualExitReason`
     - `pnlPct = actualTrade.actualPnlPct`
     - `pnlDollar = actualTrade.actualPnlDollar`
     - `barsInTrade = actualTrade.actualBarsHeld`
     - `daysInTrade = actualBarsHeld / 78` (if actualBarsHeld exists)
     - `runningHighPrice, runningHighPct, trailActivatedAt → null`
     - `pnlVsActualPct = 0` (actual vs itself = 0)
     - `pnlVsActualDollar = 0`
     - `actualExitDate, actualExitPrice, actualExitReason, actualPnlPct, actualPnlDollar` → same as exit fields
     - `regimeAtEntry, spyAtrPctAtEntry, spyAboveSmaAtEntry` → use first scenario row's values
     - `entryType = actualTrade.addCount` (reuse existing logic)
   - Add all 13 scenario rows for that actualTradeId
3. Process the combined list through CSV generation

**Open Position Handling**: If `actualExitTs = null`, the "Actual Trade" row still gets written with null exit fields. This is correct — it represents a real position that wasn't closed in the data window.

**Row Ordering**: Within each `orderId` group, "Actual Trade" comes first, followed by the 13 scenario rows in their existing order. Total: 14 rows per trade (was 13).

### Updated CSV Statistics

- **Row count**: 162 trades × 14 rows = 2,268 rows (was 162 × 13 = 2,106)
- **Scenario count per trade**: 1 actual + 13 scenarios = 14 (was 13)
- **Debug output**: Updated to reflect expected row counts

---

## CSV Column Mapping

For the "Actual Trade" row:

| CSV Column | Source | Value |
|---|---|---|
| Order ID | actualTrade.orders | Same as scenario rows |
| Ticker | actualTrade.ticker | Same |
| Asset Type | actualTrade.security.assetType | Same |
| Entry Date | actualTrade.entryTs | Same |
| Entry Price | actualTrade.entryPrice | Same |
| Shares | actualTrade.shares | Same |
| Capital Deployed | entryPrice × shares | Same |
| Entry Type | actualTrade.addCount | Same ("Single Entry", "Double-Down", "Add(N)") |
| **Scenario Name** | hardcoded | `"Actual Trade"` |
| **Scenario Group** | hardcoded | `"Actual"` |
| **Trail %** | hardcoded | (empty/null) |
| **Trail Activate %** | hardcoded | (empty/null) |
| **Target %** | hardcoded | (empty/null) |
| **Target Is Hard Exit** | hardcoded | (empty/null) |
| **Stop %** | hardcoded | (empty/null) |
| **Max Hold Bars** | hardcoded | (empty/null) |
| **Exit Date** | actualTrade.actualExitTs | Actual exit date (null if OPEN) |
| **Exit Price** | actualTrade.actualExitPrice | Actual exit price (null if OPEN) |
| **Exit Reason** | actualTrade.actualExitReason | 'limit_sell', 'market_sell', 'trailing_stop', 'open', etc. |
| **Result %** | actualTrade.actualPnlPct | Actual P&L % |
| **Result $** | actualTrade.actualPnlDollar | Actual P&L $ |
| **vs Actual %** | hardcoded | `0` (actual vs itself) |
| **vs Actual $** | hardcoded | `0` |
| **Bars Held** | actualTrade.actualBarsHeld | Actual bars held |
| **Days Held** | actualBarsHeld / 78 | Actual days held |
| **Running High $** | hardcoded | (null, not tracked) |
| **Running High %** | hardcoded | (null, not tracked) |
| **Trail Activated At** | hardcoded | (null, not tracked) |
| **Actual Exit Date** | actualTrade.actualExitTs | (same as Exit Date) |
| **Actual Exit Price** | actualTrade.actualExitPrice | (same as Exit Price) |
| **Actual Result %** | actualTrade.actualPnlPct | (same as Result %) |
| **Actual Result $** | actualTrade.actualPnlDollar | (same as Result $) |
| Regime at Entry | From first BacktestTrade for this actualTrade | Regime classification at entry |
| SPY ATR % at Entry | From first BacktestTrade for this actualTrade | SPY ATR % at entry |

---

## Validation Results

✅ All validation checks passed:

- [x] TypeScript compilation successful
- [x] Export runs without errors
- [x] Total row count = 162 trades × 14 = 2,268 rows ✓
- [x] Every orderId has exactly one "Actual Trade" row ✓ (162 found)
- [x] "Actual Trade" rows sort first within each orderId ✓
- [x] Scenario columns are null/empty for "Actual Trade" rows ✓
- [x] scenarioGroup="Actual" and scenarioName="Actual Trade" set correctly ✓
- [x] vs Actual % and vs Actual $ correctly show 0.00 for actual trades ✓
- [x] regimeAtEntry and spyAtrPctAtEntry populated from first scenario row ✓
- [x] P&L values match actualTrade fields ✓
- [x] Open positions correctly handled with null exit fields ✓
- [x] No data loss or duplication ✓
- [x] Tested with fresh backtest run (run ID 27, 26 active scenarios)

---

## Files Changed

| File | Change | Phase |
|---|---|---|
| `src/services/results.service.ts` | Add `actualExitReason` to getRunAllTrades query | 14 |
| `scripts/export-results.ts` | Generate synthetic "Actual Trade" rows; group by actualTradeId | 15 |
| `docs/PROJECT_SUMMARY_v4.md` | This file | N/A |

---

## Design Decisions

### Why generate synthetic rows in the export script instead of the database?

- **Keep DB queries simple**: BacktestTrade query remains unchanged (or minimal)
- **Localize logic**: Synthetic row generation is purely presentational (export-specific)
- **No schema changes**: No new tables, migrations, or model changes
- **Easier testing**: Can test row generation independently of the engine
- **Backward compatible**: Doesn't affect other export formats or analysis tools

### Why reuse regime data from first BacktestTrade in the group?

- **Consistency**: All BacktestTrades for the same ActualTrade have the same `regimeAtEntry` and `spyAtrPctAtEntry`
- **Efficiency**: Single query fetch, no additional DB access
- **Simplicity**: No special case logic needed

### Why keep nulls for trailing stop fields?

- **Clarity**: "Actual Trade" doesn't use trailing stop logic; nulls signify this
- **Excel filtering**: Users can filter `Trail % is empty` to exclude actual trade rows if needed
- **Consistency**: Matches pattern from other scenario fields

---

## What's NOT in v4

- ❌ Web UI
- ❌ Live trading integration
- ❌ New scenarios or engine changes
- ❌ Risk metrics (still deferred to future)
- ❌ Schema or database changes

---

## Next Steps

After v4 completes:
1. Run a full backtest with v3 scenarios
2. Export results
3. Analyze in Excel:
   - Pivot by `scenarioGroup` and `assetTypeScope`
   - Compare "Actual" vs best scenarios per regime
   - Identify which multi-buy trades benefited from different exit strategies
4. Document findings in analysis report

---

## Testing Notes

**Test dataset**: 162 actual E*TRADE trades (Oct 2024 - May 2026)

**Expected outcome**:
- Import trades (creates 162 ActualTrade records)
- Run backtest with v3 scenarios (~13 active scenarios)
- Export → CSV with 162 × 14 = 2,268 rows
- First row per trade is "Actual Trade" (verified by orderId groups)
- All regime/ATR context preserved

---

**Last Updated**: May 19 2026 — v4 complete (Phases 14-15 implemented and validated)
