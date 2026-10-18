-- What a workspace is for. Existing operators are ferry operators; freight forwarders choose "freight" at signup.
ALTER TABLE "tenants" ADD COLUMN "workspace_kind" TEXT NOT NULL DEFAULT 'ferry';
