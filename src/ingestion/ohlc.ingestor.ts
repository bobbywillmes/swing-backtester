import prisma from "../db/prisma.js";
import { MassiveAgg, OhlcCandle, IngestionStats } from "../types/ohlc.types.js";

export async function ingestCandles(
  ticker: string,
  aggs: MassiveAgg[],
  from: Date,
  to: Date
): Promise<IngestionStats> {
  const startTime = Date.now();
  let inserted = 0;
  let updated = 0;

  for (const agg of aggs) {
    const candle: OhlcCandle = {
      ticker,
      ts: new Date(agg.t), // Unix ms to Date
      open: agg.o,
      high: agg.h,
      low: agg.l,
      close: agg.c,
      volume: BigInt(Math.floor(agg.v)),
      vwap: agg.vw,
      transactions: agg.n,
    };

    await prisma.ohlcCandle.upsert({
      where: {
        ticker_ts: {
          ticker: candle.ticker,
          ts: candle.ts,
        },
      },
      update: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        vwap: candle.vwap,
        transactions: candle.transactions,
      },
      create: {
        ticker: candle.ticker,
        ts: candle.ts,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        vwap: candle.vwap,
        transactions: candle.transactions,
      },
    });

    inserted++;
  }

  const durationMs = Date.now() - startTime;

  return {
    ticker,
    from,
    to,
    candlesRequested: aggs.length,
    candlesInserted: inserted,
    candlesUpdated: updated,
    durationMs,
  };
}
