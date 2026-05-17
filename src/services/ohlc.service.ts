import prisma from "../db/prisma.js";

export async function getCandlesByTicker(
  ticker: string,
  fromTs: Date,
  toTs?: Date
): Promise<
  {
    ts: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: bigint;
    vwap: number | null;
    transactions: number | null;
  }[]
> {
  const where: {
    ticker: string;
    ts: {
      gte: Date;
      lte?: Date;
    };
  } = {
    ticker,
    ts: {
      gte: fromTs,
    },
  };

  if (toTs) {
    where.ts.lte = toTs;
  }

  const candles = await prisma.ohlcCandle.findMany({
    where,
    orderBy: {
      ts: "asc",
    },
    select: {
      ts: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
      vwap: true,
      transactions: true,
    },
  });

  return candles;
}

export async function getCandleCount(ticker: string): Promise<number> {
  return prisma.ohlcCandle.count({
    where: { ticker },
  });
}

export async function getEarliestCandle(ticker: string): Promise<Date | null> {
  const candle = await prisma.ohlcCandle.findFirst({
    where: { ticker },
    orderBy: { ts: "asc" },
    select: { ts: true },
  });

  return candle?.ts ?? null;
}

export async function getLatestCandle(ticker: string): Promise<Date | null> {
  const candle = await prisma.ohlcCandle.findFirst({
    where: { ticker },
    orderBy: { ts: "desc" },
    select: { ts: true },
  });

  return candle?.ts ?? null;
}
