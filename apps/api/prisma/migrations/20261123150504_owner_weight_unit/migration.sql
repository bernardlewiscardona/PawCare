-- CreateEnum
CREATE TYPE "weight_unit" AS ENUM ('KG', 'LB');

-- AlterTable
ALTER TABLE "owners" ADD COLUMN     "weight_unit" "weight_unit" NOT NULL DEFAULT 'KG';
