-- Subscription state per operator. Existing operators become "comped" (full access, no billing) so nothing changes for them.
ALTER TABLE "tenants" ADD COLUMN "billing_status" TEXT NOT NULL DEFAULT 'comped';
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" TIMESTAMPTZ(6);
ALTER TABLE "tenants" ADD COLUMN "current_period_end" TIMESTAMPTZ(6);
ALTER TABLE "tenants" ADD COLUMN "past_due_since" TIMESTAMPTZ(6);
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" TEXT;
-- The operator's own Stripe account, so ticket money goes straight to them.
ALTER TABLE "tenants" ADD COLUMN "stripe_account_id" TEXT;

CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");
CREATE UNIQUE INDEX "tenants_stripe_account_id_key" ON "tenants"("stripe_account_id");
