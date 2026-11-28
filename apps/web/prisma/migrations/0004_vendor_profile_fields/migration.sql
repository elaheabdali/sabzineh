-- Week 5: vendor profile settings — contact + payout fields.
-- Written by hand (no DATABASE_URL in this environment to run
-- `prisma migrate dev` against); verify it with
-- `prisma migrate deploy` once Neon exists. All columns are nullable:
-- existing vendor rows are unaffected. Payout fields are stored only;
-- the public shop page never renders them.
ALTER TABLE "VendorProfile" ADD COLUMN "phone" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "payoutIban" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "payoutAccountHolder" TEXT;
