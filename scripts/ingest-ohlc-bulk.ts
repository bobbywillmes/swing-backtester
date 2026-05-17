import prisma from "../src/db/prisma.js";
import { createMassiveClient } from "../src/ingestion/massive.client.js";
import { ingestCandles } from "../src/ingestion/ohlc.ingestor.js";

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURATION — Edit these constants before running
// ═════════════════════════════════════════════════════════════════════════════

const TICKERS = [
  "SPY",
  "QQQ",
  "DIA",
  "IWM",
  "AAPL",
  "AMZN",
  "GOOG",
  "META",
  "MSFT",
  "NVDA",
  "QQQM",
  "RSP",
  "TSLA",
  "VOO",
  "VTV",
  "DIA",
  // Add more tickers here as needed
];

const DATE_FROM = new Date("2024-10-01"); // Adjust to your earliest trade
const DATE_TO = new Date("2026-12-31"); // Adjust to your latest trade

// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\nBulk OHLC Ingestion`);
  console.log("=".repeat(60));
  console.log(`Date Range: ${DATE_FROM.toISOString().split("T")[0]} to ${DATE_TO.toISOString().split("T")[0]}`);
  console.log(`Tickers: ${TICKERS.length} securities\n`);

  const client = createMassiveClient();
  const results: {
    ticker: string;
    candles: number;
    duration: number;
    status: "success" | "error";
    message?: string;
  }[] = [];

  for (const ticker of TICKERS) {
    try {
      // Verify security exists
      const security = await prisma.security.findUnique({
        where: { symbol: ticker },
      });

      if (!security) {
        results.push({
          ticker,
          candles: 0,
          duration: 0,
          status: "error",
          message: `Security not found (create manually or re-run trade import)`,
        });
        continue;
      }

      const startTime = Date.now();

      console.log(`⏳ ${ticker}...`);

      const fromMs = DATE_FROM.getTime();
      const toMs = DATE_TO.getTime();

      const aggs = await client.get5MinBars(ticker, fromMs, toMs);

      if (aggs.length === 0) {
        results.push({
          ticker,
          candles: 0,
          duration: Date.now() - startTime,
          status: "error",
          message: "No candles returned",
        });
        continue;
      }

      const stats = await ingestCandles(ticker, aggs, DATE_FROM, DATE_TO);

      results.push({
        ticker,
        candles: stats.candlesInserted,
        duration: stats.durationMs,
        status: "success",
      });

      console.log(`✓ ${ticker}: ${stats.candlesInserted} candles (${stats.durationMs}ms)`);
    } catch (error) {
      results.push({
        ticker,
        candles: 0,
        duration: 0,
        status: "error",
        message:
          error instanceof Error ? error.message : String(error),
      });
      console.log(
        `✗ ${ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "error");
  const totalCandles = successful.reduce((sum, r) => sum + r.candles, 0);
  const totalDuration = successful.reduce((sum, r) => sum + r.duration, 0);

  console.log(`✓ Successful: ${successful.length}/${TICKERS.length}`);
  console.log(`✗ Failed: ${failed.length}/${TICKERS.length}`);
  console.log(`\nTotal candles ingested: ${totalCandles.toLocaleString()}`);
  console.log(`Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);

  if (failed.length > 0) {
    console.log("\nFailed tickers:");
    for (const result of failed) {
      console.log(`  ${result.ticker}: ${result.message}`);
    }
  }

  console.log("\n");
  await prisma.$disconnect();
}

main();
