-- CreateEnum
CREATE TYPE "RegimeType" AS ENUM ('TRENDING_LOW_VOL', 'NORMAL', 'CHOPPY_HIGH_VOL');

-- AlterTable
ALTER TABLE "BacktestTrade" ADD COLUMN     "regimeAtEntry" "RegimeType",
ADD COLUMN     "spyAtrPctAtEntry" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ExitScenario" ADD COLUMN     "targetIsHardExit" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MarketRegime" (
    "date" TIMESTAMP(3) NOT NULL,
    "spyAtr" DOUBLE PRECISION NOT NULL,
    "spyAtrPct" DOUBLE PRECISION NOT NULL,
    "spyClose" DOUBLE PRECISION NOT NULL,
    "spy20dSma" DOUBLE PRECISION,
    "spyAboveSma" BOOLEAN,
    "regime" "RegimeType" NOT NULL,

    CONSTRAINT "MarketRegime_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "MarketRegime_date_idx" ON "MarketRegime"("date");
