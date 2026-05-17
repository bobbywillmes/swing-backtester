-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ETF', 'STOCK');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('TARGET', 'STOP', 'TRAIL', 'TIME', 'OPEN');

-- CreateTable
CREATE TABLE "Security" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "OhlcCandle" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT NOT NULL,
    "vwap" DOUBLE PRECISION,
    "transactions" INTEGER,

    CONSTRAINT "OhlcCandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualOrder" (
    "id" SERIAL NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawRow" JSONB NOT NULL,
    "etradeOrderId" INTEGER,
    "ticker" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceExecuted" DOUBLE PRECISION NOT NULL,
    "priceType" TEXT NOT NULL,
    "term" TEXT,
    "limitPrice" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "tradeId" INTEGER,

    CONSTRAINT "ActualOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualTrade" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "entryTs" TIMESTAMP(3) NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "capitalDeployed" DOUBLE PRECISION NOT NULL,
    "actualExitTs" TIMESTAMP(3),
    "actualExitPrice" DOUBLE PRECISION,
    "actualExitReason" TEXT,
    "actualPnlPct" DOUBLE PRECISION,
    "actualPnlDollar" DOUBLE PRECISION,
    "actualBarsHeld" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ActualTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitScenario" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetPct" DOUBLE PRECISION,
    "stopPct" DOUBLE PRECISION,
    "trailingStopPct" DOUBLE PRECISION,
    "trailActivateAfterPct" DOUBLE PRECISION,
    "maxHoldBars" INTEGER,
    "assetTypeScope" "AssetType",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "filterTickers" TEXT[],
    "filterDateFrom" TIMESTAMP(3),
    "filterDateTo" TIMESTAMP(3),

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRunScenario" (
    "runId" INTEGER NOT NULL,
    "scenarioId" INTEGER NOT NULL,

    CONSTRAINT "BacktestRunScenario_pkey" PRIMARY KEY ("runId","scenarioId")
);

-- CreateTable
CREATE TABLE "BacktestTrade" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "actualTradeId" INTEGER NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "exitTs" TIMESTAMP(3),
    "exitPrice" DOUBLE PRECISION,
    "exitReason" "ExitReason",
    "pnlPct" DOUBLE PRECISION,
    "pnlDollar" DOUBLE PRECISION,
    "pnlVsActualPct" DOUBLE PRECISION,
    "pnlVsActualDollar" DOUBLE PRECISION,
    "barsInTrade" INTEGER,
    "runningHighPrice" DOUBLE PRECISION,
    "runningHighPct" DOUBLE PRECISION,
    "trailActivatedAt" TIMESTAMP(3),

    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestSummary" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "openTrades" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "totalPnlPct" DOUBLE PRECISION NOT NULL,
    "avgPnlPct" DOUBLE PRECISION NOT NULL,
    "avgWinPct" DOUBLE PRECISION NOT NULL,
    "avgLossPct" DOUBLE PRECISION NOT NULL,
    "bestTradePct" DOUBLE PRECISION NOT NULL,
    "worstTradePct" DOUBLE PRECISION NOT NULL,
    "avgPnlVsActualPct" DOUBLE PRECISION NOT NULL,
    "totalPnlVsActualDollar" DOUBLE PRECISION NOT NULL,
    "tradesImproved" INTEGER NOT NULL,
    "tradesWorse" INTEGER NOT NULL,
    "avgBarsInTrade" DOUBLE PRECISION NOT NULL,
    "avgDaysInTrade" DOUBLE PRECISION NOT NULL,
    "avgRunningHighPct" DOUBLE PRECISION,

    CONSTRAINT "BacktestSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OhlcCandle_ticker_ts_idx" ON "OhlcCandle"("ticker", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "OhlcCandle_ticker_ts_key" ON "OhlcCandle"("ticker", "ts");

-- CreateIndex
CREATE INDEX "ActualOrder_ticker_executedAt_idx" ON "ActualOrder"("ticker", "executedAt");

-- CreateIndex
CREATE INDEX "ActualOrder_etradeOrderId_idx" ON "ActualOrder"("etradeOrderId");

-- CreateIndex
CREATE INDEX "ActualTrade_ticker_entryTs_idx" ON "ActualTrade"("ticker", "entryTs");

-- CreateIndex
CREATE UNIQUE INDEX "ExitScenario_name_key" ON "ExitScenario"("name");

-- CreateIndex
CREATE INDEX "BacktestTrade_runId_scenarioId_idx" ON "BacktestTrade"("runId", "scenarioId");

-- CreateIndex
CREATE INDEX "BacktestTrade_actualTradeId_idx" ON "BacktestTrade"("actualTradeId");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestTrade_runId_actualTradeId_scenarioId_key" ON "BacktestTrade"("runId", "actualTradeId", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestSummary_runId_scenarioId_key" ON "BacktestSummary"("runId", "scenarioId");

-- AddForeignKey
ALTER TABLE "OhlcCandle" ADD CONSTRAINT "OhlcCandle_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "Security"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualOrder" ADD CONSTRAINT "ActualOrder_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "ActualTrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualOrder" ADD CONSTRAINT "ActualOrder_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "Security"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualTrade" ADD CONSTRAINT "ActualTrade_ticker_fkey" FOREIGN KEY ("ticker") REFERENCES "Security"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRunScenario" ADD CONSTRAINT "BacktestRunScenario_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRunScenario" ADD CONSTRAINT "BacktestRunScenario_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ExitScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_actualTradeId_fkey" FOREIGN KEY ("actualTradeId") REFERENCES "ActualTrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ExitScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestSummary" ADD CONSTRAINT "BacktestSummary_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
