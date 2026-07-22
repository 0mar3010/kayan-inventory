import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSessionEmail } from "@/lib/auth";
import { OAUTH_STATE_COOKIE } from "../start/route";

export const dynamic = "force-dynamic";

/** Shopify signs callback params with the app secret — verify before trusting. */
function validHmac(params: URLSearchParams, secret: string): boolean {
  const received = params.get("hmac");
  if (!received) return false;

  const message = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .map(([k, v]) => [k, v] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function page(title: string, body: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
     <style>body{font-family:system-ui,sans-serif;background:#f7f5f5;color:#242021;margin:0;padding:32px}
     .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e7e4e4;border-radius:16px;padding:24px}
     h1{font-size:19px;margin:0 0 12px;color:${ok ? "#2f7d4f" : "#b32229"}}
     code{display:block;direction:ltr;text-align:left;background:#f7f5f5;border:1px solid #e7e4e4;border-radius:10px;
     padding:12px;font-family:ui-monospace,monospace;font-size:13px;word-break:break-all;margin:12px 0}
     ol{line-height:1.9;padding-inline-start:20px} a{color:#b32229}</style></head>
     <body><div class="card">${body}</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const shop = params.get("shop");
  const state = params.get("state");

  const secret = process.env.SHOPIFY_API_SECRET;
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!secret || !apiKey) {
    return page("خطأ", "<h1>الإعداد ناقص</h1><p>SHOPIFY_API_KEY و SHOPIFY_API_SECRET غير مضبوطين.</p>", false);
  }

  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return page("خطأ", "<h1>state غير مطابق</h1><p>ابدأ الربط من جديد.</p>", false);
  }
  if (!validHmac(params, secret)) {
    return page("خطأ", "<h1>توقيع HMAC غير صالح</h1><p>تحقق من SHOPIFY_API_SECRET.</p>", false);
  }
  if (!code || !shop) {
    return page("خطأ", "<h1>رد ناقص من شوبيفاي</h1>", false);
  }

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, client_secret: secret, code }),
    cache: "no-store",
  });

  if (!res.ok) {
    return page("خطأ", `<h1>فشل تبادل الرمز (${res.status})</h1><p>تحقق من Client ID / Secret.</p>`, false);
  }

  const data = (await res.json()) as { access_token?: string; scope?: string };
  if (!data.access_token) return page("خطأ", "<h1>لم يصل رمز وصول</h1>", false);

  const response = page(
    "تم الربط",
    `<h1>✔ تم الحصول على الرمز</h1>
     <p>انسخ هذا الرمز الآن — لن يظهر مرة أخرى:</p>
     <code>${data.access_token}</code>
     <p>الصلاحيات: <b>${data.scope ?? "-"}</b></p>
     <ol>
       <li>في Vercel: Settings ← Environment Variables ← <b>SHOPIFY_ADMIN_TOKEN</b> = الرمز أعلاه (Production).</li>
       <li>تأكد أن <b>SHOPIFY_STORE_DOMAIN</b> = <code style="display:inline">${shop}</code></li>
       <li>أعد النشر (Redeploy) ثم اضغط «تحديث الآن» في صفحة <a href="/sync">المزامنة</a>.</li>
     </ol>`,
    true
  );
  response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
