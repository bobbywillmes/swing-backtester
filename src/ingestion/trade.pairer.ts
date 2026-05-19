import prisma from "../db/prisma.js";
import { PairingStats } from "../types/trade.types.js";

interface PositionState {
  trade: { id: number };
  buyOrders: Array<{ id: number; quantity: number; priceExecuted: number }>;
}

export async function pairTrades(): Promise<PairingStats> {
  const startTime = Date.now();

  // Get all unpaired orders, sorted chronologically per ticker
  const unpairedOrders = await prisma.actualOrder.findMany({
    where: { tradeId: null },
    orderBy: [{ ticker: "asc" }, { executedAt: "asc" }],
  });

  const openPositions = new Map<string, PositionState>();
  let orphanedSells = 0;

  // Process each order chronologically
  for (const order of unpairedOrders) {
    const { ticker, side } = order;

    if (side === "BUY") {
      if (!openPositions.has(ticker)) {
        // OPEN: Create new trade with this buy as the first entry
        const trade = await prisma.actualTrade.create({
          data: {
            ticker,
            entryTs: order.executedAt,
            entryPrice: order.priceExecuted,
            shares: order.quantity,
            capitalDeployed: order.priceExecuted * order.quantity,
            actualExitTs: null,
            actualExitPrice: null,
            actualExitReason: null,
            actualPnlPct: null,
            actualPnlDollar: null,
            addCount: 0,
          },
        });

        // Set orderRole = OPEN
        await prisma.actualOrder.update({
          where: { id: order.id },
          data: {
            tradeId: trade.id,
            orderRole: "OPEN",
          },
        });

        openPositions.set(ticker, {
          trade: { id: trade.id },
          buyOrders: [
            {
              id: order.id,
              quantity: order.quantity,
              priceExecuted: order.priceExecuted,
            },
          ],
        });
      } else {
        // ADD: Link to existing open position
        const pos = openPositions.get(ticker)!;

        // Set orderRole = ADD and link to trade
        await prisma.actualOrder.update({
          where: { id: order.id },
          data: {
            tradeId: pos.trade.id,
            orderRole: "ADD",
          },
        });

        // Increment addCount on trade
        await prisma.actualTrade.update({
          where: { id: pos.trade.id },
          data: { addCount: { increment: 1 } },
        });

        // Track this buy order
        pos.buyOrders.push({
          id: order.id,
          quantity: order.quantity,
          priceExecuted: order.priceExecuted,
        });
      }
    } else if (side === "SELL") {
      if (openPositions.has(ticker)) {
        const pos = openPositions.get(ticker)!;

        // Compute weighted average entry price across all buys
        const totalShares = pos.buyOrders.reduce(
          (sum, b) => sum + b.quantity,
          0
        );
        const totalCapital = pos.buyOrders.reduce(
          (sum, b) => sum + b.priceExecuted * b.quantity,
          0
        );
        const weightedEntryPrice = totalCapital / totalShares;

        // Compute P&L against weighted entry
        const exitPrice = order.priceExecuted;
        const pnlPct = (exitPrice - weightedEntryPrice) / weightedEntryPrice;
        const pnlDollar = (exitPrice - weightedEntryPrice) * totalShares;

        // Update trade with corrected entry fields and exit
        await prisma.actualTrade.update({
          where: { id: pos.trade.id },
          data: {
            entryPrice: weightedEntryPrice,
            shares: totalShares,
            capitalDeployed: totalCapital,
            actualExitTs: order.executedAt,
            actualExitPrice: exitPrice,
            actualExitReason: determineSellReason(order.priceType),
            actualPnlPct: pnlPct,
            actualPnlDollar: pnlDollar,
          },
        });

        // Set orderRole = CLOSE on sell order
        await prisma.actualOrder.update({
          where: { id: order.id },
          data: {
            tradeId: pos.trade.id,
            orderRole: "CLOSE",
          },
        });

        openPositions.delete(ticker);
      } else {
        // Orphaned SELL: no matching open position
        console.warn(
          `Orphaned SELL (no open position): ${ticker} at ${order.executedAt}`
        );
        orphanedSells++;
      }
    }
  }

  // Handle remaining open positions (buys with no subsequent sell)
  for (const [_, pos] of openPositions) {
    const totalShares = pos.buyOrders.reduce(
      (sum, b) => sum + b.quantity,
      0
    );
    const totalCapital = pos.buyOrders.reduce(
      (sum, b) => sum + b.priceExecuted * b.quantity,
      0
    );
    const weightedEntryPrice = totalCapital / totalShares;

    // Update trade with correct weighted entry values
    await prisma.actualTrade.update({
      where: { id: pos.trade.id },
      data: {
        entryPrice: weightedEntryPrice,
        shares: totalShares,
        capitalDeployed: totalCapital,
        actualExitTs: null,
        actualExitPrice: null,
        actualExitReason: "open",
        actualPnlPct: null,
        actualPnlDollar: null,
      },
    });
  }

  // Compute statistics
  const allTrades = await prisma.actualTrade.findMany({
    select: { id: true, addCount: true, actualExitTs: true },
  });

  const tradesCreated = allTrades.length;
  const singleEntry = allTrades.filter((t) => t.addCount === 0).length;
  const withAdds = allTrades.filter((t) => t.addCount === 1).length;
  const withMultipleAdds = allTrades.filter((t) => t.addCount >= 2).length;
  const openPositionCount = allTrades.filter((t) => t.actualExitTs === null).length;

  const durationMs = Date.now() - startTime;

  return {
    tradesCreated,
    singleEntry,
    withAdds,
    withMultipleAdds,
    openPositions: openPositionCount,
    orphanedSells,
    durationMs,
  };
}

function determineSellReason(priceType: string): string {
  if (priceType.includes("Limit")) {
    return "limit_sell";
  } else if (priceType.includes("Mkt")) {
    return "market_sell";
  } else if (priceType.includes("T-Stop")) {
    return "trailing_stop";
  }
  return "market_sell";
}
