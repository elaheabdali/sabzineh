-- Week 3: server-side sessions + order money/address snapshots.
-- Written by hand (no DATABASE_URL in this environment to run
-- `prisma migrate dev` against); verify it with
-- `prisma migrate deploy` once Neon exists.

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "walletApplied" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "payable" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "addressId" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey"
    FOREIGN KEY ("addressId") REFERENCES "Address"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
