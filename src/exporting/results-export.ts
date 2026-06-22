export interface ExportScenario {
  name: string;
  targetPct: number | null;
  targetIsHardExit: boolean | null;
  stopPct: number | null;
  trailingStopPct: number | null;
  trailActivateAfterPct: number | null;
  maxHoldBars: number | null;
  assetTypeScope: string | null;
}

export interface ExportActualTrade {
  id: number;
  ticker: string;
  entryPrice: number;
  entryTs: Date;
  shares: number;
  actualExitPrice: number | null;
  actualExitTs: Date | null;
  actualExitReason: string | null;
  actualPnlPct: number | null;
  actualPnlDollar: number | null;
  actualBarsHeld: number | null;
  addCount: number;
  security: {
    assetType: string;
  };
  orders: {
    etradeOrderId: string | number | null;
  }[];
}

export interface ExportTradeRow {
  id: number;
  runId: number;
  actualTradeId: number;
  scenarioId: number;
  exitTs: Date | null;
  exitPrice: number | null;
  exitReason: string | null;
  pnlPct: number | null;
  pnlDollar: number | null;
  pnlVsActualPct: number | null;
  pnlVsActualDollar: number | null;
  barsInTrade: number | null;
  runningHighPrice: number | null;
  runningHighPct: number | null;
  trailActivatedAt: Date | null;
  regimeAtEntry: string | null;
  spyAtrPctAtEntry: number | null;
  actualTrade: ExportActualTrade;
  scenario: ExportScenario;
}

export function buildActualTradeBenchmarkRow(
  firstTrade: ExportTradeRow
): ExportTradeRow {
  return {
    id: -1,
    runId: firstTrade.runId,
    actualTradeId: firstTrade.actualTradeId,
    scenarioId: -1,
    exitTs: firstTrade.actualTrade.actualExitTs,
    exitPrice: firstTrade.actualTrade.actualExitPrice,
    exitReason: firstTrade.actualTrade.actualExitReason,
    pnlPct: firstTrade.actualTrade.actualPnlPct,
    pnlDollar: firstTrade.actualTrade.actualPnlDollar,
    pnlVsActualPct: 0,
    pnlVsActualDollar: 0,
    barsInTrade: firstTrade.actualTrade.actualBarsHeld,
    runningHighPrice: null,
    runningHighPct: null,
    trailActivatedAt: null,
    regimeAtEntry: firstTrade.regimeAtEntry,
    spyAtrPctAtEntry: firstTrade.spyAtrPctAtEntry,
    actualTrade: firstTrade.actualTrade,
    scenario: {
      name: "Actual Trade",
      targetPct: null,
      targetIsHardExit: null,
      stopPct: null,
      trailingStopPct: null,
      trailActivateAfterPct: null,
      maxHoldBars: null,
      assetTypeScope: null,
    },
  };
}

export function isActualTradeBenchmarkRow(row: ExportTradeRow): boolean {
  return row.scenario.name === "Actual Trade";
}
