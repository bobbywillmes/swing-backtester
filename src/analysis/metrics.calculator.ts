export interface MetricsSnapshot {
  totalTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  bestTradePct: number;
  worstTradePct: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  expectancy: number;
  avgBarsInTrade: number;
  avgDaysInTrade: number;
  avgPnlVsActualPct: number;
  totalPnlVsActualDollar: number;
  improvementRate: number;
}

export function calculateMetrics(data: {
  totalTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  bestTradePct: number;
  worstTradePct: number;
  avgWinPct: number;
  avgLossPct: number;
  avgBarsInTrade: number;
  avgDaysInTrade: number;
  avgPnlVsActualPct: number;
  totalPnlVsActualDollar: number;
  tradesImproved: number;
}): MetricsSnapshot {
  const closedTrades = data.totalTrades - data.openTrades;

  // Profit factor: gross profit / gross loss (avoid division by zero)
  const grossProfit =
    data.wins > 0 ? data.avgWinPct * data.wins : 0;
  const grossLoss =
    data.losses > 0 ? Math.abs(data.avgLossPct * data.losses) : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  // Expectancy: average profit per trade (if we kept trading)
  const expectancy = closedTrades > 0 ? data.totalPnlPct / closedTrades : 0;

  // Improvement rate: % of trades that beat actual performance
  const improvementRate =
    closedTrades > 0 ? data.tradesImproved / closedTrades : 0;

  return {
    totalTrades: data.totalTrades,
    wins: data.wins,
    losses: data.losses,
    openTrades: data.openTrades,
    winRate: data.winRate,
    avgPnlPct: data.avgPnlPct,
    totalPnlPct: data.totalPnlPct,
    bestTradePct: data.bestTradePct,
    worstTradePct: data.worstTradePct,
    avgWinPct: data.avgWinPct,
    avgLossPct: data.avgLossPct,
    profitFactor,
    expectancy,
    avgBarsInTrade: data.avgBarsInTrade,
    avgDaysInTrade: data.avgDaysInTrade,
    avgPnlVsActualPct: data.avgPnlVsActualPct,
    totalPnlVsActualDollar: data.totalPnlVsActualDollar,
    improvementRate,
  };
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDollar(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatBars(bars: number): string {
  const days = bars / 78;
  return `${Math.round(bars)} bars (${days.toFixed(2)} days)`;
}
