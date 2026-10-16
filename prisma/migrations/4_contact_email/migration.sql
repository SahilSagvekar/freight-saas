-- Customers who book online give an email so we can send their ticket.
ALTER TABLE "bookings" ADD COLUMN "contact_email" TEXT;
