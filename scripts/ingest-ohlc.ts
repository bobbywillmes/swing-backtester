import prisma from "../src/db/prisma.js";
import { createMassiveClient } from "../src/ingestion/massive.client.js";
import { ingestCandles } from "../src/ingestion/ohlc.ingestor.js";

interface Args {
  ticker: string;
  from: Date;
  to: Date;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    if (value) {
      params[key] = value;
    }
  }

  if (!params.ticker || !params.from || !params.to) {
    console.error(
      "Usage: npx tsx scripts/ingest-ohlc.ts --ticker SPY --from 2024-10-01 --to 2025-05-16"
    );
    process.exit(1);
  }

  return {
    ticker: params.ticker.toUpperCase(),
    from: new Date(params.from),
    to: new Date(params.to),
  };
}

async function main() {
  const args = parseArgs();

  console.log(`\nIngesting OHLC data for ${args.ticker}`);
  console.log(`  From: ${args.from.toISOString()}`);
  console.log(`  To:   ${args.to.toISOString()}`);

  // Verify security exists
  const security = await prisma.security.findUnique({
    where: { symbol: args.ticker },
  });

  if (!security) {
    console.error(
      `\n✗ Security not found: ${args.ticker}\n`
    );
    process.exit(1);
  }

  try {
    const client = createMassiveClient();

    console.log("\nFetching candles from Massive API...");
    const fromMs = args.from.getTime();
    const toMs = args.to.getTime();

    const aggs = await client.get5MinBars(args.ticker, fromMs, toMs);
    console.log(`  Retrieved ${aggs.length} candles`);

    if (aggs.length === 0) {
      console.log("\n⚠ No candles returned for date range.");
      process.exit(0);
    }

    console.log("\nStoring candles in database...");
    const stats = await ingestCandles(args.ticker, aggs, args.from, args.to);

    console.log("\n✓ Ingestion complete");
    console.log(`  Inserted:  ${stats.candlesInserted}`);
    console.log(`  Updated:   ${stats.candlesUpdated}`);
    console.log(`  Duration:  ${stats.durationMs}ms\n`);
  } catch (error) {
    console.error("\n✗ Ingestion failed:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${error}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
