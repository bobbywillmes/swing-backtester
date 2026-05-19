-- CreateEnum
CREATE TYPE "OrderRole" AS ENUM ('OPEN', 'ADD', 'CLOSE');

-- AlterTable
ALTER TABLE "ActualOrder" ADD COLUMN     "orderRole" "OrderRole";

-- AlterTable
ALTER TABLE "ActualTrade" ADD COLUMN     "addCount" INTEGER NOT NULL DEFAULT 0;
