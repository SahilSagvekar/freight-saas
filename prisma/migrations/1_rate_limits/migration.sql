-- Counters for throttling sign-in, password setup and signup attempts across all server instances.
-- Platform-level (no tenant), so it is reached only through the admin connection.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_reset_idx" ON "rate_limits"("reset_at");
