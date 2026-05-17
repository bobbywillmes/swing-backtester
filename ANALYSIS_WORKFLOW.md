# Swing Trade Backtester — Analysis Workflow

This guide walks through analyzing your trading data end-to-end.

## Quick Start

### 1. Import Your Trades
```bash
npx tsx scripts/import-trades.ts --file ./data/orders.csv
```

**Output:**
- 9 ActualOrder records (raw orders from E*TRADE)
- 5 ActualTrade records (paired buy/sell entries)
- 1 open trade (buy without matching sell)

### 2. Ingest Market Data
For each ticker in your trades, fetch 5-minute candles from Massive.com:

```bash
# SPY — May 1 to May 16, 2026
npx tsx scripts/ingest-ohlc.ts --ticker SPY --from 2026-05-01 --to 2026-05-16

# AAPL
npx tsx scripts/ingest-ohlc.ts --ticker AAPL --from 2026-05-01 --to 2026-05-16

# META
npx tsx scripts/ingest-ohlc.ts --ticker META --from 2026-05-01 --to 2026-05-16
```

**Why the date range?**
- Start a few days before your first trade (to catch any pre-entry candles)
- End after your last trade (to evaluate full exit window)

### 3. Create Exit Scenarios
Pre-populated with 6 scenarios:
```bash
npx tsx scripts/create-scenarios.ts
```

Or create custom scenarios:
```bash
# Example: Custom trailing stop
npx tsx scripts/create-scenarios.ts  # Shows how to add more via the UI later
```

### 4. Run Backtest
```bash
npx tsx scripts/run-backtest.ts --name "May 2026 Analysis" --description "Full month of trades"
```

**Options:**
- `--ticker SPY` — restrict to specific tickers (can repeat)
- `--dateFrom 2026-05-01` — only backtest trades from this date
- `--dateTo 2026-05-16` — only backtest trades through this date

### 5. View Results
```bash
# List all backtests
npx tsx scripts/list-runs.ts

# View detailed results for run #1
npx tsx scripts/print-results.ts --runId 1
```

---

## Understanding the Output

### Scenario Rankings
Scenarios are ranked by a **composite score** (0-100):
- **20%** Win Rate: % of trades that were profitable
- **20%** Profit Factor: gross profit / gross loss (>1.0 is good)
- **20%** Expectancy: average $ per trade (if you kept trading forever)
- **20%** Improvement Rate: % of trades that beat your actual exit
- **20%** Average PnL: total profit / # trades

**Example ranking:**
```
1. Trail 1% (80.0)        ← Best composite score
   Win Rate: 100%
   Profit Factor: 0.00     ← (No losses, so ratio undefined)
   Expectancy: +26.86%
   vs Actual: +26.15%      ← Beat your actual trades by 26%
   Hold Time: 5.35 days

2. Trail 0.5% (78.6)      ← Close second, quicker exits
   Expectancy: +25.92%
   Hold Time: 0.51 days
```

### Trade-by-Trade Breakdown
```
Ticker  Entry      Exit       Result      vs Actual   Bars
----
SPY     $718.32    $742.03    +3.30%      $27,999.66  578 bars
AAPL    $195.48    $294.02    +50.41%     $48,385.05  256 bars
```

- **Result**: simulated exit PnL (what the strategy would've done)
- **vs Actual**: dollar improvement over what you actually did
- **Bars**: 5-min candles held (78 bars ≈ 1 trading day)

---

## Analyzing Your Results

### Key Insights

**1. Trailing Stops vs Fixed Targets**
- Fixed +1% target: immediate exits, minimal upside capture
- Trailing 1%: captures 26%+ of upside vs actual fixed exits
- **Why?** You made conservative limit sell orders; trailing stops would've let winners run

**2. Optimal Hold Time**
- Quick exits (1 bar): Low PnL but consistent
- Medium exits (40 bars): Good balance of upside + risk
- Long exits (400+ bars): Maximum upside but higher drawdown risk

**3. Win Rate vs Profit Factor**
- High win rate (80%+) ≠ profitable if losses are large
- Look for **Profit Factor > 1.5** (gross profits 1.5× gross losses)
- **Expectancy > 2%** means strategy is statistically sound

**4. Improvement vs Actual**
- Positive = strategy would've beaten your actual trades
- Shows which scenarios align with your risk tolerance
- Negative = strategy would've exited too early / too late

---

## Iterating on Scenarios

### Create Custom Scenarios

Edit `scripts/create-scenarios.ts` to add your own:

```typescript
{
  name: "Trail 2% (activate at +2%)",
  trailingStopPct: -0.02,       // 2% below running high
  trailActivateAfterPct: 0.02,  // only after +2% gain
}
```

Then:
```bash
npx tsx scripts/create-scenarios.ts
npx tsx scripts/run-backtest.ts --name "May 2026 v2"
npx tsx scripts/print-results.ts --runId <new_run_id>
```

### Compare Scenarios
Rankings automatically highlight:
- **Strengths**: "High win rate", "Beats actual trades", "Patient strategy"
- **Weaknesses**: "Profit factor < 1", "Many open positions"

Focus on scenarios with:
- ✓ Win rate > 50%
- ✓ Profit factor > 1.0
- ✓ Positive improvement vs actual
- ✓ Hold time matching your trading style

---

## Workflow Tips

### 1. Date Range Selection
```bash
# Get your first and last trade dates from import output
# Then ingest candles covering that range + buffer

# Example: trades from May 4-10
npx tsx scripts/ingest-ohlc.ts --ticker SPY --from 2026-05-01 --to 2026-05-16
#                                                  ↑ few days before
#                                                                ↑ few days after
```

### 2. Filtering Backtests
```bash
# Only backtest specific tickers
npx tsx scripts/run-backtest.ts --name "SPY Only" --ticker SPY

# Only backtest recent trades
npx tsx scripts/run-backtest.ts --name "May 10+" --dateFrom 2026-05-10

# Combine filters
npx tsx scripts/run-backtest.ts --name "SPY May 10+" --ticker SPY --dateFrom 2026-05-10
```

### 3. Scaling Tests
```bash
# Test more scenarios → edit src/services/scenario.service.ts
# Add new scenario types (e.g., hybrid fixed + trail)
# Re-run backtest, compare results

# Test different date ranges
# Run backtest for different months separately
# Spot trends (e.g., "trailing stops work better in volatile months")
```

---

## Common Questions

**Q: Why are some scenarios ranked lower if they have 100% win rate?**
- A: Profit factor is 0 (no losses to divide by). Ranking weights all metrics equally.
- High win rate on small samples isn't statistically meaningful.

**Q: Should I pick the #1 ranked scenario?**
- A: Not necessarily. Consider:
  - Your risk tolerance (hold time, max drawdown)
  - Market conditions (trending vs choppy)
  - Your actual trading style (patient vs quick exits)
  - Sample size (5 trades isn't much; patterns may not repeat)

**Q: Why do some trades show "OPEN"?**
- A: Backtest ran out of candle data before hitting exit (strategy didn't exit).
- Either you need more historical data, or the scenario doesn't exit in that timeframe.

**Q: How do I add more trades?**
- A: Export more from E*TRADE, append to `data/orders.csv`, re-run import.
- Existing trades won't be duplicated (importer handles that).

---

## Next Steps

1. ✅ Import your full orders
2. ✅ Ingest candles for your tickers
3. ✅ Run backtest with default scenarios
4. ✅ Analyze results, spot patterns
5. 🔄 Create custom scenarios based on insights
6. 🔄 Re-run backtest, compare
7. 📊 Build your trading playbook from top-ranked scenarios

---

## Architecture Reference

For deeper dives:
- **ARCHITECTURE.md** — system design, data shapes, engine logic
- **Engine logic**: `src/engine/trailing-stop.tracker.ts`, `exit-evaluator.ts`
- **Metrics**: `src/analysis/metrics.calculator.ts`, `scenario.ranker.ts`
- **Database**: Prisma schema in `prisma/schema.prisma`
