import prisma from "../src/db/prisma.js";

const securities = [
  { symbol: "SPY", name: "S&P 500 ETF", assetType: "ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", assetType: "ETF" },
  { symbol: "DIA", name: "Dow Jones ETF", assetType: "ETF" },
  { symbol: "IWM", name: "Russell 2000 ETF", assetType: "ETF" },
  { symbol: "AAPL", name: "Apple", assetType: "STOCK" },
  { symbol: "AMZN", name: "Amazon", assetType: "STOCK" },
  { symbol: "GOOG", name: "Alphabet", assetType: "STOCK" },
  { symbol: "META", name: "Meta", assetType: "STOCK" },
  { symbol: "MSFT", name: "Microsoft", assetType: "STOCK" },
];

async function main() {
  console.log("Seeding securities...");

  for (const security of securities) {
    const created = await prisma.security.upsert({
      where: { symbol: security.symbol },
      update: {},
      create: security,
    });
    console.log(`✓ ${created.symbol} - ${created.name}`);
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
