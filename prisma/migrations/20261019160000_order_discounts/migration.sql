-- Coupon redemption on the order. The discount is already netted out of
-- "amountPesewas"; "promoCode" is denormalized so deleting a promotion never
-- rewrites order history.
ALTER TABLE "Order"
ADD COLUMN "discountPesewas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promoCode" TEXT;
