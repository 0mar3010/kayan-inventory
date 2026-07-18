/**
 * Derive a canonical brand from the Arabic item name in the local
 * Excel stock sheet, which has no brand column of its own.
 *
 * The brand string returned MUST exactly match a `Product.brand`
 * value already in the catalog (the matcher filters fuzzy candidates
 * by `p.brand = ${brand}` at the query level). Anything we can't map
 * returns "" — those rows simply find no candidates and land as
 * UNMATCHED, which is the safe outcome (never a wrong auto-match).
 *
 * Keywords are Arabic transliterations as they actually appear in the
 * sheet. Add more here as new brands show up — no schema change needed.
 */

// [keyword(s), canonical brand] — canonical strings verified against the
// live catalog's distinct Product.brand values.
const BRAND_KEYWORDS: Array<[string[], string]> = [
  [["راف"], "RAF"],
  [["سميج", "اسميج", "سمج"], "Smeg"],
  [["ارشيا", "أرشيا"], "Arshia"],
  [["يوكين", "يوكن", "يو كين"], "UAKEEN"],
  [["سوكاني", "سوكانى", "سوكانئ"], "Sokany"],
  [["كولاكس", "كولكس"], "Kolax"],
  [["هوفمان", "هوفمن"], "Hoffmans"],
  [["ديلونجي", "ديلونغي", "ديلونجى", "ديلونج", "ديديكا"], "De'Longhi"],
  [["سونيفر"], "Sonifer"],
  [["دايسون", "دايسن"], "Dyson"],
  [["ارزم", "ارزوم", "أرزوم"], "Arzum"],
  [["نينجا"], "Ninja"],
  [["ديسيني", "ديسينى"], "Dessini"],
  [["فيليبس", "فيلبس", "فليبس"], "Philips"],
  [["بيوما"], "Piuma"],
  [["نوتري كوك", "نيوتري كوك", "نوتريكوك", "نيوتريكوك"], "Nutricook"],
  [["بلاك اند ديكر", "بلاك ديكر", "بلاك+ديكر"], "BLACK+DECKER"],
  [["كينوود", "كنوود"], "Kenwood"],
  [["جيباس", "جيباز"], "Geepas"],
  [["يوجان", "يويجان", "يوغان"], "Yuegan"],
  [["جماكي", "جماكى"], "Jamaky"],
  [["فيتك", "فايتك"], "VITEK"],
  [["تورنيدو", "تورنادو"], "Tornado"],
  [["اورفيكا", "أورفيكا", "اورفيكه"], "ORVICA"],
  [["ملاي"], "Mlay"],
  [["بيكو"], "Beko"],
  [["دي اس بي", "دى اس بى"], "DSP"],
  [["ال جي", "ال جى", "إل جي"], "LG"],
];

/** Returns the canonical brand for a name, or "" if none can be derived. */
export function deriveBrand(name: string): string {
  const n = (name ?? "").replace(/ـ/g, "").trim(); // strip Arabic tatweel
  for (const [keywords, brand] of BRAND_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return brand;
  }
  return "";
}
