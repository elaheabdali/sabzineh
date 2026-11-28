-- Week 6: admin panel + two-sided subscription + payouts.
-- Written by hand (no DATABASE_URL in this environment to run
-- `prisma migrate dev` against); verify it with
-- `prisma migrate deploy` once Neon exists.
--
-- PayoutStatus gains REQUESTED and APPROVED (flow: REQUESTED ->
-- APPROVED -> PAID). The old PENDING value is kept in the enum for
-- backwards compatibility: it means "computed by the platform, not
-- yet claimed by the vendor" and is never written by Week 6 code.
ALTER TYPE "PayoutStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "PayoutStatus" ADD VALUE 'APPROVED';

-- Rejection reason an admin leaves when declining a vendor request;
-- the vendor sees it on their dashboard.
ALTER TABLE "VendorProfile" ADD COLUMN "rejectionReason" TEXT;

-- Weekly box order generated for a box delivery.
ALTER TABLE "BoxDelivery" ADD COLUMN "orderId" TEXT;

ALTER TABLE "BoxDelivery" ADD CONSTRAINT "BoxDelivery_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BoxDelivery_orderId_idx" ON "BoxDelivery"("orderId");
