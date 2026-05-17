import prisma from "../src/db/prisma.js";

const orderCount = await prisma.actualOrder.count();
const tradeCount = await prisma.actualTrade.count();

const trades = await prisma.actualTrade.findMany({
  include: {
    orders: true,
  },
});

console.log(`\nTotal orders: ${orderCount}`);
console.log(`Total trades: ${tradeCount}\n`);

for (const trade of trades) {
  const pnl = trade.actualPnlPct
    ? (trade.actualPnlPct * 100).toFixed(2)
    : "N/A";
  const exitPrice = trade.actualExitPrice || "open";
  const exitReason = trade.actualExitReason || "N/A";

  console.log(`${trade.ticker}`);
  console.log(`  Entry: ${trade.entryPrice} × ${trade.shares} shares`);
  console.log(`  Exit:  ${exitPrice} (${exitReason})`);
  console.log(`  PnL:   ${pnl}%\n`);
}

await prisma.$disconnect();
