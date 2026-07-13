# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

---

# Kayan Store — Inventory Matching System

## 🧠 Living Project Memory
This file is the **single source of truth** for this project.
It replaces the need to read chat history and must always reflect the current state of the system.

---

## 🎯 Purpose
Store all system knowledge, decisions, and progress in one place so development can continue without context loss.

---

## 1. Project Overview

**What the system does:** Internal web app for Kayan Store (Egyptian home/kitchen appliance retailer, kayanstore-eg.com) that (a) reliably syncs stock quantities between the warehouse's local Excel export and Shopify, and (b) gives non-technical sales staff a fast internal product lookup dashboard.

**Business problem:** Two inventory systems, no shared key between them. The local Excel export's model number often doesn't match the Shopify SKU/model number (e.g. Excel `SF3508` vs Shopify `SON-SF3508`, or formatting entirely different). This breaks reliable sync and risks wrong-product stock updates.

**Business goal:** Prevent incorrect product matching above all else — a wrong auto-match that silently overwrites the wrong product's stock is worse than no sync at all. Secondary goal: sub-one-minute-to-learn dashboard for sales employees to check product info without opening Shopify.

---

## 2. System Architecture

**Core pattern:** Master-data / crosswalk architecture, not a direct Excel↔Shopify sync script. A canonical `Product` entity is the single source of truth. Both Shopify and the Excel export map into it via a `ProductIdentifier` crosswalk table — this is how the mismatched-model-number problem is solved at scale, and how large retailers/ERPs handle heterogeneous SKUs across systems (vs. trying to make matching logic smarter every time a format changes).

**Main entities:**
- `Product` — canonical product (Arabic name, English name, brand, category, image).
- `ProductIdentifier` — crosswalk row: one external ID (Excel model number or Shopify SKU) → one `Product`, tagged with `source`, a `confidenceScore`, and (once a human confirms it) `confirmedBy`/`confirmedAt`. Unique per `(source, rawExternalId)`.
- `BrandPrefix` — per-brand known prefixes (e.g. `SON-`) used during normalization. Lives in DB, not code, so new prefixes don't need a redeploy.
- `InventorySnapshot` — append-only point-in-time stock reading per product per source. Never updated in place; full audit trail.
- `SyncRun` / `SyncRunItem` — one row per Excel upload, one row per line in that file, with match outcome and staged qty diff pending approval.
- `User` / `ActivityLog` — auth + generic audit log for every state-changing action, not just sync.

**High-level flow:** Shopify and Excel are both *inputs* that resolve to a `Product` via `ProductIdentifier`. Nothing writes to Shopify or to `Product`/`ProductIdentifier` directly from a sync job — all writes go through reviewed, explicit service-layer functions.

---

## 3. Data Flow

**Shopify → system (read path):**
Shopify Admin API (GraphQL bulk operation for initial catalog pull) → `Product` + `ProductIdentifier` (source=`SHOPIFY`) created/updated → webhooks (`products/update`, `products/create`, `products/delete`, `inventory_levels/update`) keep this incrementally fresh → each inventory change appends a new `InventorySnapshot` row (source=`SHOPIFY`).

**Excel → system (matching path):**
Excel upload → parsed into `ExcelRow[]` → each row run through `matchRow()` → result staged as a `SyncRunItem` (status: AUTO / MANUAL / UNMATCHED + confidence + candidates) → human reviews/approves the diff for MANUAL and flagged rows → approved rows call `confirmMapping()` (persists the identifier permanently) and write an `InventorySnapshot` (source=`LOCAL_EXCEL`) → approved quantity changes pushed to Shopify via Admin API.

**Key rule in this flow:** unmatched or low-confidence rows never touch Shopify inventory. They sit in the review queue until a human resolves them.

---

## 4. Matching Engine Logic

Pipeline: **normalize → exact match → fuzzy match → guardrails → confidence scoring → manual approval**

1. **Normalize** (`normalize.ts`): uppercase, strip all non-alphanumeric characters, then strip the longest matching brand prefix from `BrandPrefix` (longest-first, avoids a short prefix false-matching before a longer one).
2. **Exact match** (`candidates.ts: findExactMatch`): lookup by normalized ID + source against the unique/btree index. O(1). This is the target path once a product's mapping is confirmed — cost is paid once per product, ever.
3. **Fuzzy match** (`candidates.ts: findFuzzyCandidates`): Postgres `pg_trgm` `similarity()` over `normalizedId`, filtered to the same `brand` **at the query level** (never even fetches a cross-brand candidate), top 5 by score, threshold `> 0.3`.
4. **Guardrails** (`guardrails.ts: applyGuardrails`): non-negotiable checks above string similarity.
   - Brand mismatch → hard fail (defense-in-depth; should be unreachable since step 3 already filters by brand).
   - Quantity jump > 5x vs last known snapshot → forces manual review regardless of similarity score.
5. **Confidence scoring** (`confidence.ts: computeConfidence`): `similarity × 0.8 + 0.2` (brand-match flat bonus, since brand match is already a precondition to reach this function). A `forceManualReview` guardrail caps the score at `0.89`, permanently below the AUTO threshold — the guardrail always wins over the string score.
6. **Status decision** (`matcher.service.ts: matchRow`): 
   - `confidence < 0.5` → `UNMATCHED` (untouched, no write).
   - Ambiguous (top-2 candidates within `0.05` of each other) OR `confidence < 0.9` → `MANUAL` (review queue).
   - Otherwise → `AUTO`.
7. **Manual approval / confirmation** (`matcher.service.ts: confirmMapping`): append-only write. Refuses to silently overwrite an existing confirmed identifier pointed at a different product — throws a conflict error instead, so a real data conflict is never hidden.

Thresholds live in `types.ts: CONFIDENCE_THRESHOLDS` (`AUTO: 0.9`, `MANUAL: 0.5`).

---

## 5. Sync Processes

**Excel ingestion flow (Phase 1 — not yet built):**
Upload → background job parses file → each row through `matchRow()` → results staged as `SyncRunItem` rows under one `SyncRun` → employee reviews MANUAL/flagged rows in review-queue UI → approved rows write `InventorySnapshot` + call `confirmMapping()` → approved diffs queued for Shopify push.

**Shopify ingestion flow (Phase 0 — not yet built):**
Initial full catalog pull via `bulkOperationRunQuery` (not paginated REST — avoids rate-limit pain for a full-catalog pull). Ongoing freshness via webhooks rather than polling. Writes only ever land in `Product` / `ProductIdentifier` (source=`SHOPIFY`) / `InventorySnapshot` — this phase is read-only with respect to Shopify itself (no writes back to Shopify yet).

**Shopify write-back (Phase 2 — not yet built):** approved `SyncRunItem` diffs pushed to Shopify Admin API, respecting rate limits. Every push logged to `ActivityLog`.

---

## 6. Database Notes

- **Hosted on Supabase Postgres** — project "Kayan inventory" (ref `olzzdmehgbjcxyuugblw`, eu-west-1). Schema is live: all 8 tables, enums, indexes, foreign keys, and the `pg_trgm` GIN index have been applied via 3 migrations (`prisma/migrations/`: `init`, `product_identifier_trgm_gin_index`, `enable_rls_all_tables`) — applied directly through the Supabase MCP connection since only `.env` had placeholder credentials at the time; the SQL was generated via `prisma migrate diff --from-empty` so it's byte-identical to what `prisma migrate dev` would have produced, and the migration folders are checked into version control normally.
- **Row Level Security is enabled on all 8 tables, with zero policies** — intentional. Supabase auto-exposes every `public` table over a REST/GraphQL API (PostgREST) to anyone holding the project's `anon` key; this app never uses that API (Prisma connects directly as the database role, which isn't subject to RLS), so RLS-with-no-policies means "deny the anon/authenticated roles entirely, unaffected app access" — closes an API surface that otherwise bypassed every guardrail in this system. If a future feature needs the Supabase client library/anon key (e.g. realtime, storage), add explicit policies then — don't disable RLS to unblock it.
- Two connection strings required: `DATABASE_URL` (pooled, PgBouncer, port 6543, `?pgbouncer=true` — used at runtime) and `DIRECT_URL` (direct, port 5432 — used only by `prisma migrate`). Both come from Supabase dashboard → Project Settings → Database — the password isn't retrievable via the Supabase API/MCP, only from the dashboard or by resetting it there. `.env` has the correct host/project-ref already; only `<password>` needs filling in.
- Full schema: `schema.prisma` (repo root / `prisma/schema.prisma`).
- Postgres, `pg_trgm` extension declared via `previewFeatures = ["postgresqlExtensions"]` + `extensions = [pg_trgm]`. On Supabase, `pg_trgm` is available but not enabled by default — enable it once via the SQL editor (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`) or Database → Extensions in the dashboard, before the GIN index step below will work.
- **Manual step required after every fresh migration:** Prisma cannot declare a GIN/trgm index natively. Must run manually once:
  ```sql
  CREATE INDEX product_identifier_normalized_trgm_idx
  ON "ProductIdentifier" USING gin ("normalizedId" gin_trgm_ops);
  ```
  Without this, fuzzy matching falls back to a sequential scan — works, but slow past a few thousand rows.
- `ProductIdentifier` unique constraint: `(source, rawExternalId)` — prevents the same raw external ID being mapped twice under the same source.
- `InventorySnapshot` is append-only by design — never `UPDATE`, only `INSERT`. This is what gives the full audit trail per product per source.
- `SyncRunItem.approved` is a boolean gate — nothing pushes to Shopify until this is explicitly set true by a human (until Phase 3 graduates specific high-confidence brand/category paths to auto-approve).

---

## 7. Key Design Decisions

- **Crosswalk/MDM pattern over smarter regex.** Chose a canonical `Product` + `ProductIdentifier` crosswalk instead of trying to make string matching cleverer. This is how large retailers/ERPs solve heterogeneous-SKU problems, and it means format drift in either source system doesn't require a matching-logic rewrite.
- **Guardrails outrank similarity, always.** A guardrail (brand mismatch, quantity-jump sanity) can force manual review or reject a candidate no matter how high the trigram score is. Correctness over automation coverage.
- **Ambiguity is a signal, not noise.** Near-tied top-2 candidates always route to manual, regardless of the absolute confidence score of the top candidate.
- **Append-only writes everywhere it matters.** `InventorySnapshot` and confirmed `ProductIdentifier` mappings are never overwritten in place — conflicts throw and get surfaced to a human instead of silently resolving.
- **Phase order reversed from the original request.** Dashboard/lookup (Goals 2–3, read-only against Shopify) is built *before* the sync engine (Goal 1, write-risk). This is lower-risk, ships faster, and — importantly — its usage naturally seeds/confirms product identity data that the matching engine later depends on.
- **Postgres-native search chosen over a dedicated search engine** (Meilisearch/Typesense) at current catalog scale (thousands of SKUs). Revisit only past roughly 100k SKUs or a genuine sub-50ms concurrent-load requirement — added infra isn't justified yet.
- **Shopify catalog sync via bulk operation + webhooks**, not scheduled polling — avoids repeated full-catalog pulls and rate-limit exhaustion.

---

## 8. Current Progress

**Implemented (design + code):**
- Full `schema.prisma` — all Phase 0–2 tables (`Product`, `BrandPrefix`, `ProductIdentifier`, `InventorySnapshot`, `SyncRun`, `SyncRunItem`, `User`, `ActivityLog`), enums, indexes, trgm extension declaration.
- `lib/prisma.ts` — Prisma client singleton.
- `lib/matching/types.ts` — shared types + confidence thresholds.
- `lib/matching/normalize.ts` — identifier normalization.
- `lib/matching/candidates.ts` — exact + fuzzy candidate lookup. **Patched (autoplan T3):** uses `Map` lookup instead of non-null-asserted `.find()!` — a candidate whose Product/ProductIdentifier was deleted between the raw SQL query and the batch fetch is now dropped defensively instead of throwing an uncaught TypeError.
- `lib/matching/guardrails.ts` — brand/quantity guardrail checks.
- `lib/matching/confidence.ts` — confidence scoring.
- `lib/matching/matcher.service.ts` — `matchRow()` orchestrator + `confirmMapping()` append-only write path.
- `lib/matching/review-queue.service.ts` — review-queue read/approve/reject service. **Patched (autoplan T1):** `approveReviewItem` now re-derives candidates server-side and rejects (409) if `selectedProductId` isn't among them, instead of trusting the client-supplied id blindly.
- Review-queue API routes + UI (approve/reject, candidate cards, guardrail-reason banners).
- **Minimal auth (autoplan T2):** `lib/auth.ts` + `middleware.ts` gate `/review-queue` and `/api/review-queue/*` behind a signed-in session; `confirmedBy` is now derived server-side from the session, never from the request body.

**Not yet implemented:** anything below in section 9 (Auth.js/RBAC is still the full Phase 0 implementation — T2 above is a minimal stopgap, not the final auth system), plus test coverage (T4-T9 in the autoplan review — see `~/.gstack/projects/0mar3010-kayan-inventory/`).

**Shopify catalog seeded (2026-07-06, one-time manual pull via Shopify MCP, not yet the automated bulkOperationRunQuery+webhooks job):**
- 252 `Product` + `ProductIdentifier`(source=`SHOPIFY`) + `InventorySnapshot`(source=`SHOPIFY`) rows created from the live store (254 Shopify products, ACTIVE+DRAFT only).
- **Key finding: Shopify's `vendor` field is not usable as brand directly** — it's `"kayan"` or `"Kayan Store"` (the store name) on ~90% of listings; only newer listings (e.g. all `UAKEEN` products) have it set to the real manufacturer. Brand-derivation logic used for this import: use `vendor` when it isn't the store-name sentinel, else match a known-brand-keyword list against the product title (anywhere in the title, not just first word). 29 distinct brands resolved this way (DSP, Smeg, Arshia, UAKEEN, RAF, Sokany, Kolax, De'Longhi, Hoffmans, Sonifer, Dyson, Arzum, Ninja, Philips, Dessini, Beko, BLACK+DECKER, ORVICA, Kenwood, Jamaky, Piuma, Yuegan, Nutricook, Tornado, VITEK, Mlay, LG, Geepas, Uakeen).
- **Each Shopify variant (each distinct SKU/color) maps to its own canonical `Product`**, not the parent Shopify listing — confirmed deliberately, since `InventorySnapshot` is per-Product and Shopify tracks stock per-variant, not per-listing.
- **Excluded from import, not present in the DB at all:** 4 `ARCHIVED`-status products; 21 promotional/bundle listings (Arabic "عرض..." seasonal offer pages, and "X + Y" combo listings mixing two brands in one product) — these aren't real individually-stocked SKUs; 21 products where every variant had a null SKU in Shopify (nothing to key a `ProductIdentifier` off).
- **Flagged, needs a human-assigned brand before import** (title has zero known-brand keywords — genuinely can't be inferred): "3-in-1 All-in-One Espresso Machine", "2-in-1 Coffee Grinder & Juicer", "Foldable Clothes Dryer", "Espresso Coffee Machine with Grinder", "Hoover Steam Mop".
- `arabicName` currently mirrors `englishName` for all Shopify-sourced products — **Shopify has no Arabic name field at all**, this store is English-only. Needs real Arabic content later; not blocking.
- No `BrandPrefix` rows needed yet — no "SON-"-style prefix pattern found in this catalog's actual SKUs (they're already clean manufacturer model numbers).
- Import script (one-off, not part of the app): `import_shopify.js`, run manually against the 6 pages of raw Shopify GraphQL responses. Not checked into the repo — this was a one-time backfill, not the production ingestion path. The production path (Phase 0) is still the bulk-operation + webhook job described in section 3/5.

---

## 9. Pending Work / Roadmap

- **Phase 0 (foundation, read-only):** Shopify bulk-operation ingestion job, webhook handlers, search/lookup dashboard UI (`/`, `/product/[id]`), full Auth.js setup with `SALES`/`ADMIN` roles wired into middleware (upgrading from the T2 stopgap).
- **Phase 1 (matching, no Shopify writes):** Excel upload endpoint + background parsing job, `SyncRun`/`SyncRunItem` creation. (Review-queue UI already built.)
- **Phase 2 (write path):** approved-diff push to Shopify Admin API, sync run history UI, `ActivityLog` surfaced in UI.
- **Phase 3 (automation):** scheduled auto-sync for consistently high-confidence brand/category mappings, low-stock alerts, barcode/QR scan-to-search.
- **Phase 4 (scale features):** analytics dashboard, bulk inventory tools, admin mapping-management UI, finer-grained role permissions.
- **Infra pending:** background job queue (BullMQ + Redis, or Upstash equivalent) — needed once Excel parsing + bulk Shopify calls exist.
- **From the /autoplan review (2026-07-06):** pagination on `listPendingReviewItems` (P2), surface raw pre-cap confidence alongside the guardrail-capped score (P2), CI check for the GIN trgm index (P3), unit tests for the matching engine (P2), integration/E2E test for the approve transaction (P3), success toast after approve (P3). Full findings: `~/.gstack/projects/0mar3010-kayan-inventory/`.

---

## 10. System Rules & Constraints

- Never auto-write inventory for an `UNMATCHED` or low-confidence row. Fail safe: leave stock untouched and flag it.
- A guardrail (brand mismatch, quantity-jump) always overrides similarity score — never the reverse.
- Fuzzy candidates are never fetched cross-brand — filtered at the query itself, not just after.
- Near-tied top-2 candidates always force manual review, regardless of top score.
- Confirmed `ProductIdentifier` mappings are permanent and append-only. A conflicting re-map attempt throws; it never silently overwrites.
- `InventorySnapshot` rows are never updated in place — insert-only, full history retained.
- The `pg_trgm` GIN index must be added manually via raw SQL after every fresh migration — Prisma cannot declare it natively.
- Shopify Admin API rate limits must be respected in any bulk write path (Phase 2+).
- `SALES` role must never see admin screens or settings; enforced at the middleware/role level, not just hidden in the UI.
- **`approveReviewItem` must always re-validate `selectedProductId` against the item's actual candidates server-side** — never trust a client-supplied product id blindly (autoplan T1).
- **`confirmedBy` must always come from the authenticated session**, never from request body input (autoplan T2).

---

## 11. Build Environment Notes

- **Prisma pinned to 6.19.3**, not latest (7.x). Prisma 7 removed `datasource.url` from schema files in favor of `prisma.config.ts` + driver adapters — a real architecture change to how the client connects, not requested. Pinning to 6.x preserves the schema exactly as designed (classic `url = env("DATABASE_URL")` + `extensions = [pg_trgm]`). Revisit only as a deliberate, separate migration.
- **`middleware.ts` → `proxy.ts`.** Next.js 16 renamed the middleware convention to `proxy.ts` (export name `proxy`, not `middleware`) specifically so request-time code can use full Node.js APIs (needed here for `crypto.createHmac` in the session-signing logic) instead of being restricted to the Edge runtime.
- **`/review-queue` is `export const dynamic = "force-dynamic"`** — it's a live, per-session, DB-backed page behind auth; Next was attempting to statically prerender it at build time otherwise, which fails without a reachable database.
- Local dev needs a real Postgres reachable at `DATABASE_URL` (see `.env.example`) before `prisma migrate dev` will work; `.env` currently has placeholder values.
- **Database is Supabase**, not a local/self-hosted Postgres — see section 6 for the pooled-vs-direct connection-string split (`DATABASE_URL` + `DIRECT_URL`).

## 🔄 Update Rules (VERY IMPORTANT)
This file MUST be updated after every meaningful change, including: new features, Prisma schema changes, matching logic updates, sync pipeline changes (Excel/Shopify), architecture decisions, performance improvements, or any structural/implementation change.

## ⚙️ File Behavior
Primary source of truth. Must always be concise, structured, up to date, free of outdated information. Replaces the need to read chat history.

## 🧱 Expected Outcome
At any time, this file should let any developer understand the full system instantly and continue development without reading previous conversations.

## ⚠️ Critical Rule
Not documentation. Live system state — must always reflect the latest truth of the project.
