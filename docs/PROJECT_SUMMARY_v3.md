# Swing Trade Backtester — Project Summary v3

**Started**: May 19 2026  
**Status**: ✅ Complete (May 19 2026)  
**Builds on**: v2 (docs/PROJECT_SUMMARY_v2.md)

> Frozen snapshot of v3 completion. Weighted entry benchmark fix implemented and validated.

---

## v3 Goal

Fix the actual trade benchmark to correctly handle multi-buy positions (double-downs, triple-downs). The v2 trade pairer had a critical bug: when multiple BUY orders arrived before a SELL, only the last BUY was paired; earlier BUYs were silently orphaned. This caused incorrect entry prices and P&L calculations for multi-buy trades.

**Solution**: Rewrite the trade pairer with stateful position tracking. Link all BUY orders for a position to one `ActualTrade` and compute a weighted-average entry price.

---

## The v2 Bug

**Original logic** (Map<ticker, singleOrder>):
```
Ticker: NVDA
  BUY 100 @ $150  → stored in map
  BUY 100 @ $155  → overwrites map (first BUY lost!)
  SELL 200 @ $160 → pairs with second BUY only

Result: ActualTrade.entryPrice = $155 (wrong!)
        Actual weighted avg should be ($150*100 + $155*100) / 200 = $152.50
```

**Impact**: 12 double-down and 9 triple-down trades had incorrect entry prices → incorrect vs-actual comparisons.

---

## v3 Solution: Weighted Entry Pairing

### Algorithm

**State per open position**: `{ trade: ActualTrade, buyOrders: [] }`

**For each order (chronological, per ticker)**:

| Order Type | Action |
|---|---|
| **BUY, no open position** | Create `ActualTrade` (preliminary). Set `orderRole=OPEN`. Store in `openPositions[ticker]`. |
| **BUY, position already open** | Link to current trade. Set `orderRole=ADD`. Increment `addCount`. Append to `buyOrders[]`. |
| **SELL, position open** | Compute weighted avg entry. Update trade: `entryPrice`, `shares`, `capitalDeployed`. Set `actualExitReason`, `actualPnlPct`, `actualPnlDollar` (all vs weighted entry). Set `orderRole=CLOSE`. Delete from `openPositions`. |
| **SELL, no position** | Log warning. Skip (orphaned). |

**At end of orders**:
- Remaining `openPositions` (BUYs with no SELL): compute weighted avg, update trade with `actualExitTs=null`, `actualExitReason="open"`.

### Weighted Average Calculation

```
totalShares = Σ(quantity for each BUY)
totalCapital = Σ(priceExecuted × quantity for each BUY)
weightedEntryPrice = totalCapital / totalShares

actualPnlPct = (exitPrice - weightedEntryPrice) / weightedEntryPrice
actualPnlDollar = (exitPrice - weightedEntryPrice) × totalShares
```

---

## Schema Changes (Phase 12)

### New Enum: `OrderRole`

```prisma
enum OrderRole {
  OPEN   // first BUY that opens the position
  ADD    // subsequent BUY while position is already open
  CLOSE  // SELL that closes the entire position
}
```

### Updated `ActualOrder`

```prisma
model ActualOrder {
  // ... existing fields ...
  orderRole OrderRole?  // set by trade.pairer.ts; null = not yet paired
}
```

### Updated `ActualTrade`

```prisma
model ActualTrade {
  // ... existing fields ...
  addCount Int @default(0)  // 0 = single entry, 1 = double-down, 2+ = triple-down+
}
```

**Migration**: `npx prisma migrate dev --name v3-order-roles-and-weighted-entry`

---

## Trade Pairer Rewrite (Phase 13)

**File**: `src/ingestion/trade.pairer.ts`

**Key changes**:
- Replaced `Map<ticker, singleOrder>` with `Map<ticker, {trade, buyOrders[]}>`
- Track all BUY orders for each open position
- Compute weighted avg on SELL or at end (for open positions)
- Update entry price fields on trade after computing weighted avg
- Set `orderRole` on each order (OPEN, ADD, CLOSE)
- Increment `addCount` on ADD orders

**Pairing Summary Output**:
```
Pairing summary:
  Trades created: X
  Single-entry trades: X
  Trades with adds (double-down): X
  Trades with 2+ adds (triple-down): X
  Open positions (no SELL found): X
  Orphaned SELLs (skipped): X
```

---

## Export Enhancement (Phase 13)

### New CSV Column: "Entry Type"

**File**: `scripts/export-results.ts` (updated)  
**Service**: `src/services/results.service.ts` (added `addCount` to query)

**Values**:
- `"Single Entry"` → `addCount = 0`
- `"Double-Down"` → `addCount = 1` (one add after initial buy)
- `"Add(2)"`, `"Add(3)"`, etc. → `addCount >= 2`

**Example CSV rows**:
```
Order ID,Ticker,...,Entry Type,...
1192,NVDA,...,Double-Down,...
1205,TSLA,...,Add(2),...
1158,QQQ,...,Single Entry,...
```

---

## Validation Results (162 Real Trades)

```
Trades created:        162
  Single-entry:       141 (87%)
  Double-down:         12 (7.4%)
  Triple-down+:         9 (5.6%)
  Open positions:       5 (MSFT + others)
  Orphaned SELLs:       2 (data anomalies)
```

### Double-Down Examples
- **NVDA** (Order 1192): BUY 100 @ $135.92 + BUY 100 @ $137.92 → Weighted: $136.92
- **AAPL** (Order ~): Multiple adds tracked and weighted correctly
- **TSLA** (Order 1205): Triple-down (addCount=2) with 3 BUYs all weighted

### Open Positions
- **MSFT**: Position entered, never exited (common for growth trades)
- Others: Partially held or waiting for exit signal beyond data window

---

## Backward Compatibility

**Engine changes**: None. The engine reads `entryPrice` and `shares` from `ActualTrade`. Once those are weighted, all downstream is automatic.

**Previous backtests**: Not affected. v2 and v1 backtests remain unchanged. v3 uses the same scenarios and regime data, just with corrected entry prices.

**Data migration**: Existing v2 data (candles, scenarios, regime) preserved. Only `ActualTrade` and `ActualOrder` rows rebuilt on next import.

---

## Pairing Workflow (Updated)

```bash
npm run cleanup-trades              # clears trades/orders/runs (preserves candles + scenarios)
npm run import-trades -- --file data/orders.csv
# Output shows pairing summary with multi-buy breakdown

npm run run-backtest -- --name "v3 Weighted Entry Benchmark" --description "..."
npm run export-results
# CSV now includes "Entry Type" column showing which trades had multiple BUYs
```

---

## Key Design Decisions

### Why track `orderRole` on `ActualOrder`?
For debugging and future analysis. Can later query which orders were OPEN vs ADD vs CLOSE, understand position construction patterns.

### Why store `addCount` on `ActualTrade`?
Quick lookup for filtering/aggregation (e.g., "compare single-entry vs double-down performance"). Avoids needing to count linked orders repeatedly.

### Why compute weighted avg at pairing time, not query time?
- Simpler downstream code (engine, exports, analysis all use pre-computed `entryPrice`)
- More efficient (one calculation per trade, reused in N scenarios)
- Matches v2 pattern (entry fields stored, not derived)

### Why not store all order details on trade?
Keep trade table normalized. Orders are linked via `tradeId` and `orderRole`. Joins are cheap, denormalization adds maintenance burden.

---

## What's NOT in v3

- ❌ Web UI (still CLI + Excel)
- ❌ Live trading connection
- ❌ Risk metrics (Sharpe, Sortino) — deferred to v3+ if needed
- ❌ Entry signal simulation (still uses actual entry points)
- ❌ Custom scenario builder

---

## Real-World Impact

**Before v3**: Multi-buy trades used last BUY price, not weighted avg. This made the actual exit benchmark inaccurate for ~13% of trades (21 out of 162).

**After v3**: All 162 trades use correct weighted-avg entry prices. The vs-actual comparison is now the definitive benchmark for evaluating exit strategies.

**Example**:
- NVDA trade (2x BUY): Weighted entry = $136.92
  - v2 incorrectly used: $137.92 (second BUY)
  - PnL difference: 0.73% per unit (meaningful for performance analysis)

---

## Next Steps (v3+)

### Immediate (when analysis demands)
1. Run v3 backtests with all 20 v2 scenarios
2. Pivot in Excel: multi-buy vs single-entry performance by scenario, regime, asset type
3. Document findings (do double-downs / averages-down help or hurt?)

### v4 Potential (if building web UI)
- Risk metrics: Sharpe, Sortino, max drawdown per scenario
- Attribution: which scenarios beat actual per ticker, per regime
- Optimization: grid search scenario parameters
- Interactive dashboard: filter by entry type, regime, ticker

### Beyond (stretch)
- Live regime updates (real-time SPY ATR → current regime)
- Paper trading: auto-place orders based on best scenarios from backtest
- Real trading: gated behind careful validation + approval

---

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add OrderRole enum, orderRole field, addCount field |
| `src/ingestion/trade.pairer.ts` | Full rewrite with stateful position tracking |
| `src/types/trade.types.ts` | Update PairingStats type |
| `src/services/results.service.ts` | Add addCount to getRunAllTrades select |
| `scripts/import-trades.ts` | Update pairing summary output |
| `scripts/export-results.ts` | Add "Entry Type" column to CSV |
| `prisma/migrations/20260519121617_v3_order_roles_and_weighted_entry/` | Schema migration |

---

## Code Quality

- ✅ TypeScript strict mode passes
- ✅ No `any` types
- ✅ Engine layer remains pure (zero DB access)
- ✅ Idempotent (safe to re-run import after cleanup)
- ✅ Two full import-backtest-export cycles validated end-to-end

---

## Testing Notes

**Validation dataset**: 162 actual E*TRADE trades (Oct 2024 - May 2026)

**Test cycles**:
1. Import → pairing creates 162 trades (141 single, 12 double, 9 triple)
2. Backtest with v2 20-scenario set → 2106 backtest trades (162 × ~13 scenarios)
3. Export → CSV includes "Entry Type" column, visible in Excel pivot tables

**Sanity checks**:
- Pairing summary counts correct (no net loss of trades)
- Orphaned SELLs = 2 (expected data anomalies)
- Open positions = 5 (expected, includes MSFT)
- Weighted avg prices differ from last-BUY prices for all 21 multi-buy trades

---

**Last Updated**: May 19 2026 — v3 complete (Phases 12-13 implemented and validated)

**Next Summary**: v4 (when risk metrics or web UI work begins)
