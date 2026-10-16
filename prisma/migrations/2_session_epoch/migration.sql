-- Lets a person end every session they have open (after a password change, or "sign out everywhere").
-- The default of 1970 means nobody is signed out when this migration is applied.
ALTER TABLE "users" ADD COLUMN "sessions_valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT '1970-01-01 00:00:00+00';
