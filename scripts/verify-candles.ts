import prisma from "../src/db/prisma.js";

const count = await prisma.ohlcCandle.count();
const tickers = await prisma.ohlcCandle.groupBy({ by: ["ticker"] });

console.log(`\nTotal candles in database: ${count}`);
console.log(`Tickers with data: ${tickers.map((t) => t.ticker).join(", ")}\n`);

await prisma.$disconnect();
