import { OhlcBar, ExitResult, ExitReason } from "../types/engine.types.js";
import {
  initializeTrailingStopState,
  updateTrailingStopState,
} from "./trailing-stop.tracker.js";

export interface EvaluationConfig {
  entryPrice: number;
  entryTs: Date;
  targetPct: number | null;
  stopPct: number | null;
  trailingStopPct: number | null;
  trailActivateAfterPct: number | null;
  maxHoldBars: number | null;
}

export function evaluateBarForExit(
  config: EvaluationConfig,
  bar: OhlcBar,
  barsInTrade: number,
  trailingStopState: ReturnType<typeof initializeTrailingStopState>
): { exit: ExitResult | null; updatedState: typeof trailingStopState } {
  // Calculate fixed price levels
  const stopPrice = config.stopPct
    ? config.entryPrice * (1 + config.stopPct)
    : null;
  const targetPrice = config.targetPct
    ? config.entryPrice * (1 + config.targetPct)
    : null;

  // Update trailing stop state with current bar's high
  const updatedState = updateTrailingStopState(
    trailingStopState,
    bar.high,
    config.trailingStopPct,
    config.trailActivateAfterPct
  );

  // Check exits in priority order: STOP > TRAIL > TARGET > TIME

  // 1. Hard stop
  if (stopPrice !== null && bar.low <= stopPrice) {
    return {
      exit: {
        exitedAtBar: barsInTrade,
        exitTs: bar.ts,
        exitPrice: stopPrice,
        exitReason: "STOP",
        barsInTrade: barsInTrade + 1,
      },
      updatedState,
    };
  }

  // 2. Trailing stop
  if (
    config.trailingStopPct !== null &&
    updatedState.trailActive &&
    bar.low <= updatedState.trailFloor
  ) {
    return {
      exit: {
        exitedAtBar: barsInTrade,
        exitTs: bar.ts,
        exitPrice: updatedState.trailFloor,
        exitReason: "TRAIL",
        barsInTrade: barsInTrade + 1,
      },
      updatedState,
    };
  }

  // 3. Target
  if (targetPrice !== null && bar.high >= targetPrice) {
    return {
      exit: {
        exitedAtBar: barsInTrade,
        exitTs: bar.ts,
        exitPrice: targetPrice,
        exitReason: "TARGET",
        barsInTrade: barsInTrade + 1,
      },
      updatedState,
    };
  }

  // 4. Max hold bars (exit at close of the final bar)
  const nextBarsInTrade = barsInTrade + 1;
  if (
    config.maxHoldBars !== null &&
    nextBarsInTrade >= config.maxHoldBars
  ) {
    return {
      exit: {
        exitedAtBar: barsInTrade,
        exitTs: bar.ts,
        exitPrice: bar.close,
        exitReason: "TIME",
        barsInTrade: nextBarsInTrade,
      },
      updatedState,
    };
  }

  // No exit on this bar
  return {
    exit: null,
    updatedState,
  };
}

export function walkBars(
  config: EvaluationConfig,
  bars: OhlcBar[]
): ExitResult | null {
  let barsInTrade = 0;
  let trailingStopState = initializeTrailingStopState(config.entryPrice);

  for (const bar of bars) {
    const result = evaluateBarForExit(
      config,
      bar,
      barsInTrade,
      trailingStopState
    );

    if (result.exit) {
      return result.exit;
    }

    trailingStopState = result.updatedState;
    barsInTrade++;
  }

  // Exhausted all bars with no exit
  return null;
}
