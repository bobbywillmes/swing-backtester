import {
  OhlcBar,
  BacktestResult,
  ScenarioConfig,
  TradeConfig,
  ExitReason,
} from "../types/engine.types.js";
import { evaluateBarForExit } from "./exit-evaluator.js";
import { initializeTrailingStopState } from "./trailing-stop.tracker.js";

export class BacktestEngine {
  runTrade(
    trade: TradeConfig,
    bars: OhlcBar[],
    scenario: ScenarioConfig
  ): BacktestResult {
    // Find entry candle
    const entryBarIndex = bars.findIndex((bar) => bar.ts >= trade.entryTs);

    if (entryBarIndex === -1) {
      // No candles after entry
      return this.createOpenResult(trade);
    }

    const barsFromEntry = bars.slice(entryBarIndex);

    let barsInTrade = 0;
    let trailingStopState = initializeTrailingStopState(trade.entryPrice);
    let runningHighPrice = trade.entryPrice;
    let runningHighPct = 0;
    let trailActivatedAt: Date | null = null;

    for (const bar of barsFromEntry) {
      const result = evaluateBarForExit(
        {
          entryPrice: trade.entryPrice,
          entryTs: trade.entryTs,
          targetPct: scenario.targetPct,
          stopPct: scenario.stopPct,
          trailingStopPct: scenario.trailingStopPct,
          trailActivateAfterPct: scenario.trailActivateAfterPct,
          maxHoldBars: scenario.maxHoldBars,
        },
        bar,
        barsInTrade,
        trailingStopState
      );

      // Track running high and trail activation
      if (trailingStopState.runningHigh !== result.updatedState.runningHigh) {
        runningHighPrice = result.updatedState.runningHigh;
        runningHighPct =
          (runningHighPrice - trade.entryPrice) / trade.entryPrice;
      }

      if (
        !trailingStopState.trailActive &&
        result.updatedState.trailActive &&
        trailActivatedAt === null
      ) {
        trailActivatedAt = bar.ts;
      }

      if (result.exit) {
        return this.createExitResult(
          trade,
          result.exit,
          runningHighPrice,
          runningHighPct,
          trailActivatedAt
        );
      }

      trailingStopState = result.updatedState;
      barsInTrade++;
    }

    // Exhausted all candles with no exit
    return this.createOpenResult(
      trade,
      runningHighPrice,
      runningHighPct,
      trailActivatedAt
    );
  }

  private createExitResult(
    trade: TradeConfig,
    exitResult: Awaited<ReturnType<typeof evaluateBarForExit>>["exit"],
    runningHighPrice: number,
    runningHighPct: number,
    trailActivatedAt: Date | null
  ): BacktestResult {
    const pnlPct = (exitResult!.exitPrice - trade.entryPrice) / trade.entryPrice;
    const pnlDollar = (exitResult!.exitPrice - trade.entryPrice) * trade.shares;

    let pnlVsActualPct: number | null = null;
    let pnlVsActualDollar: number | null = null;

    if (trade.actualPnlPct !== null) {
      pnlVsActualPct = pnlPct - trade.actualPnlPct;
    }
    if (trade.actualPnlDollar !== null) {
      pnlVsActualDollar = pnlDollar - trade.actualPnlDollar;
    }

    return {
      entryPrice: trade.entryPrice,
      shares: trade.shares,
      exitPrice: exitResult!.exitPrice,
      exitTs: exitResult!.exitTs,
      exitReason: exitResult!.exitReason,
      pnlPct,
      pnlDollar,
      barsInTrade: exitResult!.barsInTrade,
      runningHighPrice,
      runningHighPct,
      trailActivatedAt,
      pnlVsActualPct,
      pnlVsActualDollar,
    };
  }

  private createOpenResult(
    trade: TradeConfig,
    runningHighPrice?: number,
    runningHighPct?: number,
    trailActivatedAt?: Date | null
  ): BacktestResult {
    return {
      entryPrice: trade.entryPrice,
      shares: trade.shares,
      exitPrice: null,
      exitTs: null,
      exitReason: "OPEN",
      pnlPct: null,
      pnlDollar: null,
      barsInTrade: null,
      runningHighPrice: runningHighPrice ?? trade.entryPrice,
      runningHighPct: runningHighPct ?? 0,
      trailActivatedAt: trailActivatedAt ?? null,
      pnlVsActualPct:
        trade.actualPnlPct !== null
          ? null - trade.actualPnlPct
          : null,
      pnlVsActualDollar:
        trade.actualPnlDollar !== null
          ? null - trade.actualPnlDollar
          : null,
    };
  }
}

export function createBacktestEngine(): BacktestEngine {
  return new BacktestEngine();
}
