import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { parseStockSheet } from "@/lib/sync/parse-excel";
import { ingestStockSheet } from "@/lib/sync/ingest.service";

// Parsing + matching hundreds of rows against the DB can take a while.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded (field name must be 'file')" }, { status: 400 });
  }

  let rows;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rows = parseStockSheet(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse the file";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No stock rows found in the sheet" }, { status: 400 });
  }

  try {
    const summary = await ingestStockSheet(file.name, rows, email);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[sync:upload] ingest failed", error);
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
