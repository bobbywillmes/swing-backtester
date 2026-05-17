export interface OhlcBar {
  ts: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ExitReason = "TARGET" | "STOP" | "TRAIL" | "TIME" | "OPEN";

export interface ExitResult {
  exitedAtBar: number; // 0-indexed bar number
  exitTs: Date;
  exitPrice: number;
  exitReason: ExitReason;
  barsInTrade: number;
}

export interface TrailingStopState {
  entryPrice: number;
  runningHigh: number;
  trailActive: boolean;
  trailFloor: number;
}

export interface BacktestResult {
  entryPrice: number;
  shares: number;
  exitPrice: number | null;
  exitTs: Date | null;
  exitReason: ExitReason;
  pnlPct: number | null;
  pnlDollar: number | null;
  barsInTrade: number | null;
  runningHighPrice: number | null;
  runningHighPct: number | null;
  trailActivatedAt: Date | null;
  pnlVsActualPct: number | null;
  pnlVsActualDollar: number | null;
}

export interface ScenarioConfig {
  id: number;
  name: string;
  targetPct: number | null;
  stopPct: number | null;
  trailingStopPct: number | null;
  trailActivateAfterPct: number | null;
  maxHoldBars: number | null;
}

export interface TradeConfig {
  ticker: string;
  entryPrice: number;
  shares: number;
  entryTs: Date;
  actualExitPrice: number | null;
  actualExitTs: Date | null;
  actualPnlPct: number | null;
  actualPnlDollar: number | null;
}
