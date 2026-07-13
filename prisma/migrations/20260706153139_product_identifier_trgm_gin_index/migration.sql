CREATE INDEX product_identifier_normalized_trgm_idx
ON "ProductIdentifier" USING gin ("normalizedId" gin_trgm_ops);
