// Minimal Shopify Admin GraphQL client. Credentials come from env:
//   SHOPIFY_STORE_DOMAIN  e.g. wjk5cv-nt.myshopify.com
//   SHOPIFY_ADMIN_TOKEN   Admin API access token (shpat_...) from a custom app
const API_VERSION = "2024-10";

export function shopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_TOKEN);
}

export async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) {
    throw new Error("Shopify not configured — set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN");
  }

  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Diagnostic detail (domain + token shape only — never the token itself)
    // so a wrong domain vs a wrong/!shpat_ credential is obvious immediately.
    const shape = `${token.slice(0, 6)}…, ${token.length} chars`;
    throw new Error(
      `Shopify API returned ${res.status} for domain "${domain}" (token ${shape}). ` +
        `Domain must be the *.myshopify.com one, and the token must be the Admin API access token (starts with shpat_).`
    );
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error("Shopify GraphQL error: " + JSON.stringify(json.errors));
  if (!json.data) throw new Error("Shopify returned no data");
  return json.data;
}
