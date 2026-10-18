-- Freight quotes and invoices. Line items are stored as JSON on the document (description, quantity, unit price in minor units);
-- totals are stored too so lists and the dashboard never recompute them.

CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "quote_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "inquiry_id" UUID,
    "shipment_id" UUID,
    "customer_name" TEXT NOT NULL,
    "customer_company" TEXT,
    "customer_email" TEXT,
    "customer_address" TEXT,
    "mode" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "valid_until" DATE,
    "currency" TEXT NOT NULL,
    "tax_bp" INTEGER NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax_total" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freight_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "shipment_id" UUID,
    "quote_id" UUID,
    "customer_name" TEXT NOT NULL,
    "customer_company" TEXT,
    "customer_email" TEXT,
    "customer_address" TEXT,
    "reference" TEXT,
    "issued_on" DATE NOT NULL,
    "due_on" DATE NOT NULL,
    "paid_on" DATE,
    "currency" TEXT NOT NULL,
    "tax_bp" INTEGER NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax_total" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freight_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quotes_tenant_no_idx" ON "quotes"("tenant_id", "quote_no");
CREATE INDEX "quotes_tenant_status_idx" ON "quotes"("tenant_id", "status", "created_at");
CREATE UNIQUE INDEX "freight_invoices_tenant_no_idx" ON "freight_invoices"("tenant_id", "invoice_no");
CREATE INDEX "freight_invoices_tenant_status_idx" ON "freight_invoices"("tenant_id", "status", "due_on");

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freight_invoices" ADD CONSTRAINT "freight_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_tenant_isolation" ON "quotes" AS PERMISSIVE FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "freight_invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freight_invoices_tenant_isolation" ON "freight_invoices" AS PERMISSIVE FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
