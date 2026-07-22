import { prisma } from "@/lib/prisma";
import { shopifyGraphQL } from "./client";
import { SourceSystem } from "@prisma/client";

export interface ShopifySyncSummary {
  variantsPulled: number;
  matched: number; // variants matched to a catalog product by SKU
  priceUpdated: number;
  snapshotsWritten: number;
}

interface VariantNode {
  sku: string | null;
  price: string | null;
  inventoryQuantity: number | null;
  product: { featuredImage: { url: string } | null } | null;
}

const VARIANTS_QUERY = `
  query($after: String) {
    productVariants(first: 100, after: $after) {
      edges { node { sku price inventoryQuantity product { featuredImage { url } } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

/**
 * Pull every Shopify variant (price, live stock, image) and fold it into the
 * catalog: refresh Product.price + imageUrl and append a fresh SHOPIFY
 * InventorySnapshot per product (drives the "available" flag). Read-only
 * toward Shopify — never writes back. Matches variants to products by SKU
 * via the SHOPIFY ProductIdentifier crosswalk.
 */
export async function syncFromShopify(): Promise<ShopifySyncSummary> {
  const variants: Array<{ sku: string; price: number | null; qty: number; image: string | null }> = [];

  let after: string | null = null;
  do {
    const data: {
      productVariants: {
        edges: { node: VariantNode }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await shopifyGraphQL(VARIANTS_QUERY, { after });

    for (const { node } of data.productVariants.edges) {
      if (!node.sku) continue;
      const price = node.price != null ? Number(node.price) : null;
      variants.push({
        sku: node.sku,
        price: price != null && Number.isFinite(price) && price > 0 ? price : null,
        qty: node.inventoryQuantity ?? 0,
        image: node.product?.featuredImage?.url ?? null,
      });
    }
    after = data.productVariants.pageInfo.hasNextPage ? data.productVariants.pageInfo.endCursor : null;
  } while (after);

  // Map SKU -> productId via the SHOPIFY crosswalk.
  const idents = await prisma.productIdentifier.findMany({
    where: { source: SourceSystem.SHOPIFY, rawExternalId: { in: variants.map((v) => v.sku) } },
    select: { rawExternalId: true, productId: true },
  });
  const skuToProduct = new Map(idents.map((i) => [i.rawExternalId, i.productId]));

  const matched = variants
    .filter((v) => skuToProduct.has(v.sku))
    .map((v) => ({ ...v, productId: skuToProduct.get(v.sku)! }));

  // Fresh stock snapshot for every matched product (append-only).
  if (matched.length > 0) {
    await prisma.inventorySnapshot.createMany({
      data: matched.map((m) => ({ productId: m.productId, source: SourceSystem.SHOPIFY, quantity: m.qty })),
    });
  }

  // Bulk price + image refresh in one statement (only where a price exists).
  const priced = matched.filter((m) => m.price != null);
  if (priced.length > 0) {
    const ids = priced.map((m) => m.productId);
    const prices = priced.map((m) => m.price as number);
    const images = priced.map((m) => m.image);
    await prisma.$executeRaw`
      UPDATE "Product" p
      SET price = d.price,
          "imageUrl" = COALESCE(d.image, p."imageUrl")
      FROM unnest(${ids}::text[], ${prices}::float8[], ${images}::text[]) AS d(id, price, image)
      WHERE p.id = d.id`;
  }

  return {
    variantsPulled: variants.length,
    matched: matched.length,
    priceUpdated: priced.length,
    snapshotsWritten: matched.length,
  };
}
