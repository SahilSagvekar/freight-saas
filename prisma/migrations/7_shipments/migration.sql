-- Freight shipments, their package lines and their status history. Tenant-scoped like every other business table.
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shipment_no" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "inquiry_id" UUID,
    "quote_id" UUID,
    "customer_ref" TEXT,
    "shipper" JSONB NOT NULL,
    "consignee" JSONB NOT NULL,
    "notify_party" JSONB,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "incoterm" TEXT,
    "carrier" TEXT,
    "vessel_or_flight" TEXT,
    "voyage_no" TEXT,
    "master_no" TEXT,
    "house_no" TEXT,
    "container_no" TEXT,
    "seal_no" TEXT,
    "etd" DATE,
    "eta" DATE,
    "goods" TEXT NOT NULL,
    "marks" TEXT,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipment_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "package_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "length_cm" DOUBLE PRECISION,
    "width_cm" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "gross_weight_kg" DOUBLE PRECISION,
    "marks" TEXT,
    "hs_code" TEXT,
    "declared_value" INTEGER,

    CONSTRAINT "shipment_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "note" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipments_tenant_no_idx" ON "shipments"("tenant_id", "shipment_no");
CREATE INDEX "shipments_tenant_status_idx" ON "shipments"("tenant_id", "status", "created_at");
CREATE INDEX "shipment_packages_shipment_idx" ON "shipment_packages"("shipment_id", "sort_order");
CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events"("shipment_id", "created_at");

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_packages" ADD CONSTRAINT "shipment_packages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_packages" ADD CONSTRAINT "shipment_packages_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments_tenant_isolation" ON "shipments" AS PERMISSIVE FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "shipment_packages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipment_packages_tenant_isolation" ON "shipment_packages" AS PERMISSIVE FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "shipment_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipment_events_tenant_isolation" ON "shipment_events" AS PERMISSIVE FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
