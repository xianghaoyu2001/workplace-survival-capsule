-- Add database-driven scenario runtime configuration.
ALTER TABLE "Scenario" ADD COLUMN "openingMessageJson" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "initialBlackboardJson" TEXT;
