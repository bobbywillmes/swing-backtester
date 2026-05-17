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
