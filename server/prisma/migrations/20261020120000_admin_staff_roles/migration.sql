CREATE TYPE "AdminStaffRole" AS ENUM (
  'super_admin',
  'merchant_operations',
  'customer_support',
  'finance_reconciliation'
);

ALTER TABLE "User"
ADD COLUMN "adminStaffRole" "AdminStaffRole";

UPDATE "User"
SET "adminStaffRole" = 'super_admin'
WHERE "role" = 'admin';

CREATE INDEX "User_role_adminStaffRole_status_idx"
ON "User"("role", "adminStaffRole", "status");
