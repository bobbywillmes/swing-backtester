# CLAUDE.md — Project Guidance for Claude Code

> This file is read automatically at session start. Update it as the project evolves through versions.

---

## 🎯 Project Overview

**Swing Trade Backtester** — TypeScript backtesting engine that simulates trailing stop exit strategies against real E*TRADE trading history (162 actual trades, Oct 2024 - May 2026).

**Core Question**: Would trailing stops have captured more upside than fixed limit sells?

**Answer**: Yes. Trail 1% strategy captured **26.15% more upside** on this dataset.

**Status**: ✅ v2 Complete (Phases 7-11, May 18 2026). Ready for v3 enhancements.

---

## 📚 Essential Documentation

**Start here in order**:
1. **README.md** — Quick start, typical workflow, all CLI commands (v1 & v2)
2. **docs/PROJECT_SUMMARY_v2.md** — Frozen snapshot of v2 (Phases 7-11 complete)
3. **docs/PROJECT_SUMMARY_v1.md** — Reference: v1 foundation (Phases 1-6)
4. **ARCHITECTURE.md** — System design, build order, database schema, engine logic
5. **ANALYSIS_WORKFLOW.md** — End-to-end analysis guide with examples

**GitHub**: https://github.com/bobbywillmes/swing-backtester

---

## 🏗️ Tech Stack & Structure

| Layer | Choice |
|---|---|
| Language | TypeScript (strict mode, no `any`) |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma (10 models + RegimeType enum) |
| Market Data | Massive.com API |
| Runtime | Node.js (CLI scripts, no web API yet) |

**Directory Structure**:
- `src/` — Core application code
  - `engine/` — Pure functions (no DB access). Core: trailing-stop.tracker.ts, exit-evaluator.ts
  - `services/` — DB orchestration, API calls
  - `ingestion/` — CSV parsing, API clients
  - `analysis/` — Metrics, scenario ranking
- `scripts/` — 12 CLI tools (data import → regime computation → export)
- `prisma/` — Schema, migrations, seed
- `docs/` — Versioned project summaries

---

## 🔑 Key Conventions (CRITICAL)

### 1. Pure Engine Layer
- **Location**: `src/engine/`
- **Rule**: Zero direct DB access. All data passed as parameters.
- **Why**: Deterministic, testable, reusable in future web API
- **Example**: `evaluateBarForExit(bar, state)` returns exit decision with no side effects

### 2. Singleton Prisma Client
- **Import from**: `src/db/prisma.ts` (everywhere)
- **Never**: Create new PrismaClient instances
- **Why**: Connection pooling, memory efficiency

### 3. Typed Environment Variables
- **Load via**: `src/config/env.ts` (never `process.env` directly elsewhere)
- **Tool**: Zod validation
- **Why**: Type safety, clear dependencies

### 4. Percentage Format
- **Store as signed decimals**: `0.01` = +1%, `-0.005` = -0.5%
- **Never**: Strings or percentages (25%)
- **Why**: Consistent math, no parsing errors

### 5. Timestamps
- **Store as**: UTC DateTime in database
- **Convert**: EST/EDT → UTC on import (see `src/utils/date.utils.ts`)
- **Export**: Excel-friendly format `2024-10-04 09:59:25 AM EDT`

### 6. Idempotent Imports
- **Pattern**: Upsert on unique constraints (e.g., `[ticker, ts]` for candles)
- **Why**: Safe to re-run without duplicates
- **Example**: `create-scenarios.ts` uses `.upsert()` not `.create()`

### 7. No Service Layer Leaks
- **Rule**: Prisma types stay in services layer
- **Engine layer**: Uses custom types from `src/types/`
- **Why**: Engine remains independent of DB schema

### 8. Asset-Type Scoped Scenarios (v2)
- **Rule**: Each scenario has `assetTypeScope: "ETF" | "STOCK"`
- **Pattern**: Separate DB records for ETF and Stock variants (e.g., "ETF: +1% Unlock → Trail 0.5%" and "Stock: +1% Unlock → Trail 0.5%")
- **Why**: Different asset classes need different exit parameters; easier to filter in Excel
- **Backtest filtering**: Engine only applies scenarios matching the trade's asset type

### 9. Market Regime Context (v2)
- **Fields added to BacktestTrade**: `regimeAtEntry` (enum), `spyAtrPctAtEntry` (float)
- **Computation**: Joined via MarketRegime table on entry date
- **Available regimes**: TRENDING_LOW_VOL, NORMAL, CHOPPY_HIGH_VOL
- **Export**: Included in comprehensive CSV for pivot analysis

---

## 📋 Common Tasks & Patterns

### Running the Full Workflow (v2)
```bash
npm run ingest-ohlc-bulk              # Or single ticker
npm run import-trades -- --file data/orders.csv
npm run create-scenarios-v2           # 20 asset-type-scoped scenarios
npm run compute-regimes               # SPY ATR-based daily regime classification
npm run run-backtest -- --name "Test" --description "..."
npm run export-results                 # Flat CSV with regime context
```

Or for v1 baseline (6 default scenarios, no regimes):
```bash
npx tsx scripts/create-scenarios.ts   # v1: Basic 6 scenarios
npm run run-backtest -- --name "Test" --description "..."
```

### Adding a New CLI Script
1. Create `scripts/my-script.ts`
2. Add to `package.json` under `scripts:`
3. Use `parseArgs()` for CLI params (see `import-trades.ts`)
4. Import singleton Prisma: `import prisma from "../src/db/prisma.js"`
5. Call services, not raw Prisma calls
6. Add to npm scripts

### Adding a Database Model
1. Update `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name description`
3. Add service functions in `src/services/`
4. Use in scripts or engine

### Modifying Trailing Stop Logic
- **Location**: `src/engine/trailing-stop.tracker.ts` (state machine)
- **Rule**: Pure functions only, no DB access
- **Test by**: Running backtest with test data
- **Verify**: Check `src/engine/exit-evaluator.ts` for priority order

### Adding a New Exit Scenario (v2)
1. Edit `scripts/create-scenarios-v2.ts`
2. Add to appropriate group (Trail Only / Target Unlock Trail / Fixed Target)
3. Create **separate entries** for ETF and STOCK variants in `assetTypeScope`
4. Set `targetIsHardExit` appropriately:
   - `true` (default) = exit immediately at target price (Group 3)
   - `false` = target activates trail without exiting (Group 2)
5. Run: `npm run create-scenarios-v2`
6. Run backtest to validate: `npm run run-backtest -- --name "Test"`
7. Export and verify in Excel: `npm run export-results`

---

## ❌ What NOT to Do

- ❌ Use `process.env` directly (use `src/config/env.ts`)
- ❌ Create new Prisma instances (import from `src/db/prisma.ts`)
- ❌ Put DB logic in engine layer (pure functions only)
- ❌ Store percentages as strings or decimals like 0.25 for 25%
- ❌ Store timestamps in local time (use UTC)
- ❌ `create()` when `upsert()` is safer (idempotent = better)
- ❌ Skip TypeScript strict mode
- ❌ Hardcode magic numbers (use named constants)
- ❌ Forget to run migrations after schema changes

---

## 🔄 Version Management

### v1 (Complete)
- **Location**: `docs/PROJECT_SUMMARY_v1.md` (frozen)
- **Phases**: 1-6 complete (Foundation → Export & Cleanup)
- **Status**: Production-ready, tested on 162 real trades
- **Key Finding**: Trail 1% strategy captured 26.15% more upside than actual exits

### v2 (Complete)
- **Location**: `docs/PROJECT_SUMMARY_v2.md` (frozen, May 18 2026)
- **Phases**: 7-11 complete (Schema → Regimes → Engine → Scenarios → Export)
- **Key Additions**:
  - 20 asset-type-scoped exit scenarios (ETF vs Stock variants)
  - Market regime classification (SPY ATR-based: Trending/Normal/Choppy)
  - Comprehensive flat CSV export (30+ context columns)
  - "Target unlocks trail" feature (targetIsHardExit = false)
- **Status**: Validated end-to-end, ready for analysis

### v3 (Future)
- Risk metrics (Sharpe, Sortino, drawdown)
- Performance attribution by ticker/regime
- Custom scenario builder UI (optional)
- Batch scenario optimization

---

## 📊 Real-World Baseline

Your test dataset (162 trades, Oct 2024 - May 2026):
- **Trail 1%** beat your actual exits by **26.15% avg**
- **Quick wins**: 1-day holds are consistent but lower upside
- **Patient holding**: 400+ bars captures max gains
- **Profit factor > 1.0** is healthy (all default scenarios hit this)

Use this as sanity check if you run new backtests.

---

## 🚀 v2 Complete — Next Steps

### Immediate (v2 Validation)
1. Run backtests with v2 scenarios and regime filters
2. Analyze results in Excel: pivot by `assetTypeScope`, `scenarioGroup`, `regimeAtEntry`
3. Identify top scenarios per asset type + regime combination
4. Document findings in analysis report

### v3 Potential (When Needed)
- **Risk metrics**: Sharpe ratio, Sortino ratio, max drawdown
- **Attribution**: Which scenarios beat actual per ticker, per regime
- **Optimization**: Batch test scenario parameters (grid search)
- **UI**: Custom scenario builder (optional, if analysis workflows demand it)

### Beyond (Stretch Goals)
- Web dashboard for interactive result visualization
- Live market data integration (real-time regime updates)
- Paper trading automation (automated order placement)
- Real trading integration (requires careful design & approval)

**Current recommended workflow: CLI + Excel pivot tables for v2 analysis. Web UI comes later if needed.**

---

## 🎯 Code Review Checklist (Before Committing)

- [ ] TypeScript strict mode passes (`npm run build`)
- [ ] No `any` types
- [ ] Engine layer has zero DB access
- [ ] Idempotent (safe to re-run)
- [ ] Commit message explains WHY (not just WHAT)
- [ ] New files added to appropriate layer (not mixing concerns)
- [ ] Timestamps are UTC, percentages are decimals
- [ ] Database changes include migrations
- [ ] Updated relevant docs (README, ARCHITECTURE, CLAUDE.md)

---

## 📝 Git Commit Style

**Format**: `type(scope): description`

**Types**:
- `feat` — New feature or capability
- `fix` — Bug fix
- `docs` — Documentation only
- `refactor` — Code refactoring (no behavior change)
- `test` — Test additions or fixes
- `chore` — Build, dependencies, tooling
- `db` — Database migrations or schema changes

**Scope** (in parentheses): Area being changed
- Examples: `db`, `engine`, `exports`, `ingestion`, `services`, `scripts`

**Description**: Clear, imperative mood, what was done

**Examples**:
```
feat(db): v2 migration, add RegimeType enum & MarketRegime model
feat(exports): update flat file in export-results.ts to include full datetime with timezone
fix(ingestion): fixed error causing trade timestamp parsing failure
docs(readme): add workflow examples for scenario creation
refactor(engine): simplify exit evaluator logic
```

---

## 💾 Memory System

Future sessions should preserve:
- **User preferences** (CLI-only, Excel exports, etc.)
- **Architectural decisions** (pure engine, singleton Prisma)
- **Real-world validation** (162 trades, 26% upside finding)
- **Known gotchas** (Prisma relationship duplication, EST/EDT conversion)

---

## 📞 Quick Reference

**GitHub**: https://github.com/bobbywillmes/swing-backtester

**Current version**: v2 (Phases 7-11 complete, May 18 2026)

**Database**: PostgreSQL 16 on port 5433 (Docker)

**Key files**:
- Engine: `src/engine/trailing-stop.tracker.ts`
- CLI: `scripts/*.ts`
- Schema: `prisma/schema.prisma`
- Services: `src/services/`

**Common issues**:
- Missing `.env` → Copy `.env.example` and fill in Massive API key
- DB not running → `docker-compose up -d`
- Import duplicates → Use upsert, not create
- Timestamp issues → Always UTC, convert EST/EDT on import

---

**Last Updated**: May 18 2026, v2 complete  
**Next Review**: When v3 development begins (or during v2 analysis)
