import prisma from "../db/prisma.js";

export async function getBacktestRun(runId: number) {
  return prisma.backtestRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      scenarios: {
        include: {
          scenario: true,
        },
      },
      summaries: {
        include: {
          run: false,
        },
      },
    },
  });
}

export async function listBacktestRuns() {
  return prisma.backtestRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      completedAt: true,
      _count: {
        select: { summaries: true },
      },
    },
  });
}

export async function getRunSummaryForScenario(
  runId: number,
  scenarioId: number
) {
  return prisma.backtestSummary.findUniqueOrThrow({
    where: {
      runId_scenarioId: {
        runId,
        scenarioId,
      },
    },
  });
}

export async function getRunTrades(runId: number, scenarioId: number) {
  return prisma.backtestTrade.findMany({
    where: {
      runId,
      scenarioId,
    },
    include: {
      actualTrade: {
        select: {
          ticker: true,
          entryPrice: true,
          entryTs: true,
          actualExitPrice: true,
          actualPnlPct: true,
          orders: {
            select: {
              etradeOrderId: true,
            },
          },
        },
      },
      scenario: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      actualTrade: {
        entryTs: "asc",
      },
    },
  });
}

export async function getScenarioDetails(scenarioId: number) {
  return prisma.exitScenario.findUniqueOrThrow({
    where: { id: scenarioId },
  });
}

export async function getAllRuns() {
  return prisma.backtestRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      summaries: {
        include: {
          run: false,
        },
      },
    },
  });
}

export async function getMostRecentRun() {
  const run = await prisma.backtestRun.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return run?.id;
}

export async function getRunAllTrades(runId: number) {
  const trades = await prisma.backtestTrade.findMany({
    where: {
      runId,
    },
    include: {
      actualTrade: {
        select: {
          id: true,
          ticker: true,
          entryPrice: true,
          entryTs: true,
          shares: true,
          actualExitPrice: true,
          actualExitTs: true,
          actualPnlPct: true,
          actualPnlDollar: true,
          addCount: true,
          security: {
            select: {
              assetType: true,
            },
          },
        },
      },
      scenario: {
        select: {
          name: true,
          targetPct: true,
          targetIsHardExit: true,
          stopPct: true,
          trailingStopPct: true,
          trailActivateAfterPct: true,
          maxHoldBars: true,
          assetTypeScope: true,
        },
      },
    },
    orderBy: {
      actualTrade: {
        entryTs: "asc",
      },
    },
  });

  // Fetch order IDs separately to avoid relationship duplication
  const actualTradeIds = [...new Set(trades.map((t) => t.actualTrade.id))];
  const orderMap = new Map<number, string>();

  if (actualTradeIds.length > 0) {
    const orders = await prisma.actualOrder.findMany({
      where: {
        tradeId: { in: actualTradeIds },
      },
      select: {
        tradeId: true,
        etradeOrderId: true,
      },
    });

    for (const order of orders) {
      if (order.tradeId && !orderMap.has(order.tradeId)) {
        orderMap.set(order.tradeId, String(order.etradeOrderId || "N/A"));
      }
    }
  }

  // Attach order IDs to trades
  return trades.map((trade) => ({
    ...trade,
    actualTrade: {
      ...trade.actualTrade,
      orders: [
        {
          etradeOrderId: orderMap.get(trade.actualTrade.id) || "N/A",
        },
      ],
    },
  }));
}
