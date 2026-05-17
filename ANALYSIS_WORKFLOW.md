# Swing Trade Backtester — Analysis Workflow

This guide walks through analyzing your trading data end-to-end.

## Quick Start

### 1. Ingest Market Data
Fetch 5-minute candles from Massive.com for your tickers. Edit the config in the script or use bulk ingestion:

```bash
# Bulk ingest (edit TICKERS and date range in script first)
npm run ingest-ohlc-bulk

# Or single ticker
npm run ingest-ohlc -- --ticker SPY --from 2026-05-01 --to 2026-05-16
```

**Why the date range?**
- Start a few days before your first trade (to catch any pre-entry candles)
- End after your last trade (to evaluate full exit window)

### 2. Create Exit Scenarios
Pre-populated with 6 parameterized scenarios (idempotent upsert):
```bash
npx tsx scripts/create-scenarios.ts
```

Scenarios include:
1. Fixed +1% Target
2. Fixed -1.5% Stop
3. Trail 0.5% (activate at +0.5%)
4. Trail 1% (activate at +1%)
5. 1 Day Max Hold
6. +1% Target OR Trail 0.5%

### 3. Import Your Trades
Load your E*TRADE CSV export and auto-create any missing securities:

```bash
npm run import-trades -- --file data/orders.csv
```

**Output:**
- ActualOrder records (raw orders from E*TRADE)
- ActualTrade records (paired buy/sell entries)
- Open trades (buys without matching sells)
- Auto-created securities if any tickers were missing

### 4. Run Backtest
Simulate all exit scenarios against your actual trades:

```bash
npm run run-backtest -- --name "Full Portfolio Analysis" --description "All 162 trades"
```

**Options:**
- `--ticker SPY` — restrict to specific tickers (can repeat)
- `--dateFrom 2026-05-01` — only backtest trades from this date
- `--dateTo 2026-05-16` — only backtest trades through this date

### 5. Export Results to Excel
Generate CSVs for analysis:

```bash
# Export latest run
npm run export-results

# Or export specific run
npm run export-results -- --runId 5
```

**Outputs** to `exports/`:
- `run-{id}-rankings.csv` — Scenario comparison with composite scores
- `run-{id}-scenario-trades.csv` — All trades × all scenarios (972 rows for 162 orders)
  - Includes: Order ID, Entry/Exit timestamps, Scenario name, P&L metrics
  - Timestamps in Excel-friendly format: `2024-10-04 09:59:25 AM EDT`
- `run-{id}-metadata.csv` — Run details (name, date, filters applied)

### 6. View Console Results
```bash
# List all backtests
npm run list-runs

# View detailed results for a run
npm run print-results -- --runId 5
```

---

## Cleaning Up & Re-importing

If you need to reset your trade data and start fresh (e.g., after adding new orders):

```bash
# Reset all trade/backtest data (keeps OHLC candles + scenarios)
npm run cleanup-trades

# Then re-import fresh
npm run import-trades -- --file data/orders.csv

# Run backtest again
npm run run-backtest -- --name "Fresh Analysis" --description "..."
```

This is safe and idempotent — you'll re-fetch the same OHLC candles from the cache (no API calls).

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
npm run run-backtest -- --name "May 2026 v2"
npm run print-results -- --runId <new_run_id>
npm run export-results -- --runId <new_run_id>
```

### Analyze Rankings
Each run generates a composite score (0-100) based on:
- **20%** Win Rate: % of trades that were profitable
- **20%** Profit Factor: gross profit / gross loss (>1.0 is good)
- **20%** Expectancy: average $ per trade
- **20%** Improvement Rate: % of trades that beat your actual exit
- **20%** Average PnL: total profit / # trades

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
npm run ingest-ohlc -- --ticker SPY --from 2026-05-01 --to 2026-05-16
#                                         ↑ few days before
#                                                         ↑ few days after
```

### 2. Filtering Backtests
```bash
# Only backtest specific tickers
npm run run-backtest -- --name "SPY Only" --ticker SPY

# Only backtest recent trades
npm run run-backtest -- --name "May 10+" --dateFrom 2026-05-10

# Combine filters
npm run run-backtest -- --name "SPY May 10+" --ticker SPY --dateFrom 2026-05-10
```

### 3. Batch Testing & Iteration
```bash
# Add custom scenarios
# Edit scripts/create-scenarios.ts
# Re-run: npx tsx scripts/create-scenarios.ts

# Run backtest with new scenarios
npm run run-backtest -- --name "Strategy v2"

# Compare with previous runs
npm run list-runs
npm run export-results -- --runId 5  # Compare runs side-by-side in Excel
npm run export-results -- --runId 6
```

### 4. Excel Analysis Workflow
After exporting:
1. Open `exports/run-{id}-rankings.csv` to see scenario rankings
2. Open `exports/run-{id}-scenario-trades.csv` for trade-by-trade details
   - Filter by Scenario to see all instances of a single strategy
   - Sort by "vs Actual $" to find highest-upside trades
   - Check "Trail Activated" timestamp to understand exit dynamics
3. Compare across multiple runs to validate strategy consistency

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

## Typical Analysis Workflow

1. ✅ **Setup** — Ingest OHLC candles for your date range
2. ✅ **Create Scenarios** — Load 6 default parameterized exit strategies
3. ✅ **Import** — Load E*TRADE CSV and pair buy/sell orders
4. ✅ **Run Backtest** — Simulate all exit strategies bar-by-bar
5. ✅ **Export to Excel** — Generate CSVs with rankings and trade details
6. 🔄 **Analyze** — Identify which scenarios beat your actual trades
7. 🔄 **Iterate** — Create custom scenarios and re-run
8. 🔄 **Optimize** — Spot patterns (trailing stops work better in X market condition)
9. 📊 **Build Playbook** — Codify your best-performing exit strategies

Once you've identified top performers, consider:
- Trading them live with paper money first
- A/B testing against your current fixed-target approach
- Documenting entry signals and exit rules for consistency

---

## Architecture Reference

For deeper dives:
- **ARCHITECTURE.md** — system design, data shapes, engine logic
- **Engine logic**: `src/engine/trailing-stop.tracker.ts`, `exit-evaluator.ts`
- **Metrics**: `src/analysis/metrics.calculator.ts`, `scenario.ranker.ts`
- **Database**: Prisma schema in `prisma/schema.prisma`
