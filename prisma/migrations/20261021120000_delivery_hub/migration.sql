-- Last-mile logistics hub.
--
-- Stores gain an optional physical pickup address and spatial origin (captured
-- via pin drop in settings). Orders gain a fulfillment branch, an optional
-- saved customer entrance, a server-computed integer delivery fee and the rider
-- identity that accepted the public gig link.

CREATE TYPE "FulfillmentMethod" AS ENUM ('DIRECT_PICKUP', 'LOCAL_DELIVERY');
CREATE TYPE "DeliveryStatus" AS ENUM (
  'NOT_APPLICABLE',
  'PENDING_DISPATCH',
  'RIDER_ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED'
);

ALTER TABLE "Store"
ADD COLUMN "address" TEXT,
ADD COLUMN "lat" DOUBLE PRECISION,
ADD COLUMN "lng" DOUBLE PRECISION;

ALTER TABLE "Order"
ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'DIRECT_PICKUP',
ADD COLUMN "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN "customerLat" DOUBLE PRECISION,
ADD COLUMN "customerLng" DOUBLE PRECISION,
ADD COLUMN "deliveryFeePesewas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "riderId" TEXT;

CREATE INDEX "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");
