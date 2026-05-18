import prisma from "../src/db/prisma.js";
import { getCandlesByTicker } from "../src/services/ohlc.service.js";

interface DailyCandle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface RegimeData {
  date: Date;
  spyAtr: number;
  spyAtrPct: number;
  spyClose: number;
  spy20dSma: number | null;
  spyAboveSma: boolean | null;
  regime: "TRENDING_LOW_VOL" | "NORMAL" | "CHOPPY_HIGH_VOL";
}

// Get UTC midnight for a given date
function getUTCMidnight(date: Date): Date {
  const midnight = new Date(date);
  midnight.setUTCHours(0, 0, 0, 0);
  return midnight;
}

// Group 5-min candles by trading day and aggregate to daily OHLC
function aggregateToDailyCandles(
  candles: Array<{
    ts: Date;
    open: number;
    high: number;
    low: number;
    close: number;
  }>
): Map<string, DailyCandle> {
  const dailyMap = new Map<string, DailyCandle>();

  for (const candle of candles) {
    const dateKey = getUTCMidnight(candle.ts).toISOString();

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: getUTCMidnight(candle.ts),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    } else {
      const daily = dailyMap.get(dateKey)!;
      daily.high = Math.max(daily.high, candle.high);
      daily.low = Math.min(daily.low, candle.low);
      daily.close = candle.close; // Last close of the day
    }
  }

  return dailyMap;
}

// Calculate True Range for a day given previous close
function calculateTrueRange(
  high: number,
  low: number,
  prevClose: number
): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

// Calculate Wilder's 14-day ATR
function calculateATR(trueRanges: number[]): number[] {
  if (trueRanges.length === 0) return [];

  const atr: number[] = [];

  // First ATR is simple average of first 14 TRs
  if (trueRanges.length >= 14) {
    const firstAtr = trueRanges.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
    atr.push(firstAtr);

    // Then use Wilder's smoothing: ATR[n] = (ATR[n-1] × 13 + TR[n]) / 14
    for (let i = 14; i < trueRanges.length; i++) {
      const newAtr = (atr[i - 14] * 13 + trueRanges[i]) / 14;
      atr.push(newAtr);
    }
  }

  return atr;
}

// Calculate 20-day SMA
function calculateSMA(closes: number[], period: number = 20): (number | null)[] {
  const sma: (number | null)[] = Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    sma[i] = slice.reduce((a, b) => a + b, 0) / period;
  }

  return sma;
}

// Classify regime based on normalized ATR
function classifyRegime(
  atrPct: number
): "TRENDING_LOW_VOL" | "NORMAL" | "CHOPPY_HIGH_VOL" {
  if (atrPct < 0.008) {
    return "TRENDING_LOW_VOL";
  } else if (atrPct <= 0.015) {
    return "NORMAL";
  } else {
    return "CHOPPY_HIGH_VOL";
  }
}

async function main() {
  console.log("Starting market regime computation...");

  // Fetch all SPY candles
  const allCandles = await getCandlesByTicker("SPY", new Date("1900-01-01"));
  console.log(`Fetched ${allCandles.length} SPY candles`);

  if (allCandles.length === 0) {
    console.log("No SPY candles found. Run ingest-ohlc-bulk first.");
    return;
  }

  // Aggregate to daily candles
  const dailyMap = aggregateToDailyCandles(allCandles);
  const dailyCandlesSorted = Array.from(dailyMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  console.log(`Aggregated to ${dailyCandlesSorted.length} trading days`);

  // Calculate True Ranges and ATR
  const trueRanges: number[] = [];
  const closes: number[] = [];

  for (let i = 0; i < dailyCandlesSorted.length; i++) {
    const daily = dailyCandlesSorted[i];
    closes.push(daily.close);

    if (i === 0) {
      // For first day, use day's open as previous close (conservative)
      trueRanges.push(calculateTrueRange(daily.high, daily.low, daily.open));
    } else {
      const prevClose = dailyCandlesSorted[i - 1].close;
      trueRanges.push(calculateTrueRange(daily.high, daily.low, prevClose));
    }
  }

  const atrValues = calculateATR(trueRanges);
  const smaValues = calculateSMA(closes, 20);

  // Prepare regime data starting from day 14 (when we have enough ATR data)
  const regimeDataList: RegimeData[] = [];

  for (let i = 13; i < dailyCandlesSorted.length; i++) {
    const daily = dailyCandlesSorted[i];
    const atrIndex = i - 13; // ATR starts at index 0 for day 14

    if (atrIndex >= atrValues.length) break;

    const atr = atrValues[atrIndex];
    const atrPct = atr / daily.close;
    const sma20 = smaValues[i];
    const spyAboveSma = sma20 !== null ? daily.close > sma20 : null;

    regimeDataList.push({
      date: daily.date,
      spyAtr: atr,
      spyAtrPct: atrPct,
      spyClose: daily.close,
      spy20dSma: sma20,
      spyAboveSma: spyAboveSma,
      regime: classifyRegime(atrPct),
    });
  }

  console.log(`Computed regime data for ${regimeDataList.length} days`);

  // Upsert into MarketRegime table
  let upsertCount = 0;
  for (const regime of regimeDataList) {
    await prisma.marketRegime.upsert({
      where: { date: regime.date },
      update: {
        spyAtr: regime.spyAtr,
        spyAtrPct: regime.spyAtrPct,
        spyClose: regime.spyClose,
        spy20dSma: regime.spy20dSma,
        spyAboveSma: regime.spyAboveSma,
        regime: regime.regime,
      },
      create: {
        date: regime.date,
        spyAtr: regime.spyAtr,
        spyAtrPct: regime.spyAtrPct,
        spyClose: regime.spyClose,
        spy20dSma: regime.spy20dSma,
        spyAboveSma: regime.spyAboveSma,
        regime: regime.regime,
      },
    });
    upsertCount++;

    if (upsertCount % 50 === 0) {
      console.log(`  Upserted ${upsertCount}/${regimeDataList.length} records`);
    }
  }

  console.log(`\n✅ Market regimes computed and upserted successfully`);
  console.log(`Total regimes: ${upsertCount}`);

  // Distribution summary
  const distribution = regimeDataList.reduce(
    (acc, r) => {
      acc[r.regime] = (acc[r.regime] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\nRegime Distribution:");
  Object.entries(distribution).forEach(([regime, count]) => {
    const pct = ((count / regimeDataList.length) * 100).toFixed(1);
    console.log(`  ${regime}: ${count} days (${pct}%)`);
  });
}

main()
  .catch((err) => {
    console.error("Error computing regimes:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
