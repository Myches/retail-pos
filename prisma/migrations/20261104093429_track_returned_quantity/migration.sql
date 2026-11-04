
-- Add the returned quantity counter to SaleItem.
ALTER TABLE "SaleItem"
ADD COLUMN "returnedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Backfill the counter using all existing return records.
UPDATE "SaleItem"
SET "returnedQuantity" = COALESCE(
    (
        SELECT SUM("SaleReturnItem"."quantity")
        FROM "SaleReturnItem"
        WHERE "SaleReturnItem"."saleItemId" = "SaleItem"."id"
    ),
    0
);

-- Prevent invalid return counters.
CREATE TRIGGER "SaleItem_returnedQuantity_insert_check"
BEFORE INSERT ON "SaleItem"
WHEN NEW."returnedQuantity" < 0
  OR NEW."returnedQuantity" > NEW."quantity"
BEGIN
    SELECT RAISE(ABORT, 'Invalid returned quantity');
END;

CREATE TRIGGER "SaleItem_returnedQuantity_update_check"
BEFORE UPDATE OF "returnedQuantity", "quantity" ON "SaleItem"
WHEN NEW."returnedQuantity" < 0
  OR NEW."returnedQuantity" > NEW."quantity"
BEGIN
    SELECT RAISE(ABORT, 'Invalid returned quantity');
END;
