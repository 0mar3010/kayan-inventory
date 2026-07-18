import { prisma } from "@/lib/prisma";
import { Prisma, SourceSystem } from "@prisma/client";

export interface ProductStockRow {
  id: string;
  arabicName: string;
  englishName: string | null;
  brand: string;
  category: string | null;
  imageUrl: string | null;
  sku: string | null; // a representative external identifier, for display
  localStock: number | null; // latest LOCAL_EXCEL snapshot
  shopifyStock: number | null; // latest SHOPIFY snapshot
}

/**
 * Sales-facing product lookup. Read-only. Matches across Arabic/English name,
 * brand, and any crosswalk identifier (Excel model number or Shopify SKU), then
 * attaches the latest stock reading from BOTH sources so staff can see
 * warehouse vs Shopify side by side without opening Shopify.
 *
 * Latest-per-(product,source) uses Postgres DISTINCT ON — one query for all
 * matched products, not an N+1 per-row snapshot fetch.
 */
export async function searchProducts(q: string, limit = 30): Promise<ProductStockRow[]> {
  const term = q.trim();

  const products = await prisma.product.findMany({
    where: term
      ? {
          OR: [
            { arabicName: { contains: term, mode: "insensitive" } },
            { englishName: { contains: term, mode: "insensitive" } },
            { brand: { contains: term, mode: "insensitive" } },
            { identifiers: { some: { rawExternalId: { contains: term, mode: "insensitive" } } } },
          ],
        }
      : {},
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      identifiers: {
        take: 1,
        orderBy: { createdAt: "asc" }, // stable, first-known identifier for display
      },
    },
  });

  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);

  const snaps = await prisma.$queryRaw<
    Array<{ productId: string; source: SourceSystem; quantity: number }>
  >`
    SELECT DISTINCT ON ("productId", source) "productId", source, quantity
    FROM "InventorySnapshot"
    WHERE "productId" IN (${Prisma.join(ids)})
    ORDER BY "productId", source, "recordedAt" DESC
  `;

  const stock = new Map<string, { local: number | null; shopify: number | null }>();
  for (const id of ids) stock.set(id, { local: null, shopify: null });
  for (const s of snaps) {
    const e = stock.get(s.productId)!;
    if (s.source === SourceSystem.LOCAL_EXCEL) e.local = s.quantity;
    else if (s.source === SourceSystem.SHOPIFY) e.shopify = s.quantity;
  }

  return products.map((p) => ({
    id: p.id,
    arabicName: p.arabicName,
    englishName: p.englishName,
    brand: p.brand,
    category: p.category,
    imageUrl: p.imageUrl,
    sku: p.identifiers[0]?.rawExternalId ?? null,
    localStock: stock.get(p.id)!.local,
    shopifyStock: stock.get(p.id)!.shopify,
  }));
}
