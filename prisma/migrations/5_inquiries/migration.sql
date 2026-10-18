-- Quote requests from the operator's website form. Tenant-scoped like every other business table.
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inquiry_no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "mode" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "ready_on" DATE,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inquiries_tenant_no_idx" ON "inquiries"("tenant_id", "inquiry_no");
CREATE INDEX "inquiries_tenant_status_idx" ON "inquiries"("tenant_id", "status", "created_at");

ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiries_tenant_isolation" ON "inquiries" AS PERMISSIVE FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
