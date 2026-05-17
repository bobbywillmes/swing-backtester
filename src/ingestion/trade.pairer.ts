import prisma from "../db/prisma.js";
import { PairingStats } from "../types/trade.types.js";

export async function pairTrades(): Promise<PairingStats> {
  const startTime = Date.now();

  // Get all unpaired orders
  const unpairedOrders = await prisma.actualOrder.findMany({
    where: { tradeId: null },
    orderBy: [{ ticker: "asc" }, { executedAt: "asc" }],
  });

  let totalBuys = 0;
  let totalSells = 0;
  let pairedTrades = 0;
  const unpairedBuys = new Set<number>();
  const unpairedSells = new Set<number>();

  // Track buys by ticker that haven't been paired yet
  const pendingBuys = new Map<string, typeof unpairedOrders[0]>();

  for (const order of unpairedOrders) {
    if (order.side === "BUY") {
      // Store pending buy (overwrites previous if campaign-like scenario)
      pendingBuys.set(order.ticker, order);
      totalBuys++;
    } else if (order.side === "SELL") {
      totalSells++;
      const buy = pendingBuys.get(order.ticker);

      if (buy) {
        // Pair this sell with the pending buy
        const trade = await prisma.actualTrade.create({
          data: {
            ticker: order.ticker,
            entryTs: buy.executedAt,
            entryPrice: buy.priceExecuted,
            shares: buy.quantity,
            capitalDeployed: buy.priceExecuted * buy.quantity,
            actualExitTs: order.executedAt,
            actualExitPrice: order.priceExecuted,
            actualExitReason: determineSellReason(order.priceType),
            actualPnlPct:
              (order.priceExecuted - buy.priceExecuted) / buy.priceExecuted,
            actualPnlDollar:
              (order.priceExecuted - buy.priceExecuted) * buy.quantity,
          },
        });

        // Update orders to reference the trade
        await prisma.actualOrder.updateMany({
          where: { id: { in: [buy.id, order.id] } },
          data: { tradeId: trade.id },
        });

        pairedTrades++;
        pendingBuys.delete(order.ticker);
      } else {
        // Sell with no matching buy (orphaned)
        unpairedSells.add(order.id);
      }
    }
  }

  // Remaining pending buys are open trades
  for (const buy of pendingBuys.values()) {
    const trade = await prisma.actualTrade.create({
      data: {
        ticker: buy.ticker,
        entryTs: buy.executedAt,
        entryPrice: buy.priceExecuted,
        shares: buy.quantity,
        capitalDeployed: buy.priceExecuted * buy.quantity,
        actualExitTs: null,
        actualExitPrice: null,
        actualExitReason: "open",
      },
    });

    // Update buy order to reference the trade
    await prisma.actualOrder.update({
      where: { id: buy.id },
      data: { tradeId: trade.id },
    });

    pairedTrades++;
  }

  const durationMs = Date.now() - startTime;

  return {
    totalBuys,
    totalSells,
    pairedTrades,
    unpaired: {
      buys: pendingBuys.size,
      sells: unpairedSells.size,
    },
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
