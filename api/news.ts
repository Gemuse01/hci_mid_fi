// api/news.ts
// Fetch stock & market news from Yahoo Finance-like sources and normalize

const YAHOO_SEARCH_URL =
  "https://query1.finance.yahoo.com/v1/finance/search";

interface YahooNewsItem {
  title?: string;
  publisher?: string;
  provider?: string;
  providerDisplay?: string;
  link?: string;
  clickThroughUrl?: string;
  clickThroughURL?: string;
  url?: string;
  canonicalUrl?: string;
  summary?: string;
  description?: string;
  content?: any;
  published_at?: number;
  providerPublishTime?: number;
  pubDate?: number | string;
  publishedAt?: string;
  relatedTickers?: string[];
}

function normalizeLink(raw: any): string {
  if (!raw) return "";
  const s = String(raw);
  if (!s.startsWith("http")) return "";
  return s;
}

function normalizeNewsItem(item: any): any | null {
  const content: any =
    typeof item?.content === "object" && item.content !== null
      ? item.content
      : item;

  let title =
    content.title ??
    content.headline ??
    item.title ??
    item.headline ??
    "";
  if (typeof title !== "string") title = "";
  title = title.trim();
  if (!title) return null;

  let publisher =
    content.publisher ??
    content.publisherName ??
    content.provider ??
    item.publisher ??
    item.publisherName ??
    item.provider ??
    "Market News";
  if (typeof publisher !== "string") publisher = "Market News";
  publisher = publisher.trim() || "Market News";

  let pubTime: any =
    content.providerPublishTime ??
    content.pubDate ??
    content.publishedAt ??
    content.pubDateUTC ??
    item.providerPublishTime ??
    item.pubDate ??
    item.publishedAt ??
    0;

  if (typeof pubTime === "string") {
    const t = Date.parse(pubTime);
    pubTime = isNaN(t) ? 0 : Math.floor(t / 1000);
  } else if (typeof pubTime === "number") {
    pubTime = Math.floor(pubTime);
  } else {
    pubTime = 0;
  }

  let summary =
    content.summary ??
    content.description ??
    content.text ??
    item.summary ??
    item.description ??
    title;
  if (typeof summary !== "string") summary = title;
  summary = summary.trim();

  let rawLink =
    content.link ??
    content.url ??
    content.canonicalUrl ??
    content.clickThroughUrl ??
    content.clickThroughURL ??
    item.link ??
    item.url ??
    item.canonicalUrl ??
    item.clickThroughUrl ??
    item.clickThroughURL ??
    "";

  const link = normalizeLink(rawLink);

  const related = new Set<string>();
  const baseSymbol = item.symbol as string | undefined;
  if (baseSymbol) related.add(baseSymbol);
  const rawRelated = content.relatedTickers || item.relatedTickers || [];
  if (Array.isArray(rawRelated)) {
    for (const r of rawRelated) {
      if (!r) continue;
      const s = String(r).trim();
      if (s) related.add(s.toUpperCase());
    }
  }

  const id =
    (content.id as string) ??
    (item.uuid as string) ??
    (item.id as string) ??
    (item.link as string) ??
    `${title}-${pubTime}`;

  return {
    id: String(id),
    title,
    source: publisher,
    date: pubTime,
    summary,
    impact: "neutral",
    related_symbols: Array.from(related),
    link,
  };
}

async function fetchNewsFromYahoo(query: string, count: number) {
  const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(
    query,
  )}&quotesCount=0&newsCount=${count}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Yahoo search error ${resp.status}: ${resp.statusText}`);
  }
  const data: any = await resp.json();
  const rawNews: any[] = data?.news || [];

  const seenKeys = new Set<string>();
  const items: any[] = [];

  for (const item of rawNews) {
    const normalized = normalizeNewsItem(item);
    if (!normalized) continue;
    const key = `${normalized.title.toLowerCase()}|${
      (normalized.source || "").toLowerCase()
    }`;
    if (seenKeyExists(seenKeys, key)) continue;
    seenKeys.add(key);
    items.push(normalized);
  }

  return items.slice(0, count);
}

function seenKeyExists(set: Set<string>, key: string): boolean {
  if (set.has(key)) return true;
  return false;
}

export default async function handler(req: any, res: any) {
  const symbol = (req.query?.symbol || "").toString().trim();

  try {
    const news: any[] = [];
    if (symbol) {
      // Symbol-specific news
      const items = await fetchNewsFromYahoo(symbol, 20);
      for (const it of items) {
        // Ensure symbol is in related_symbols
        const rel = new Set<string>(it.related_symbols || []);
        rel.add(symbol.toUpperCase());
        it.related_symbols = Array.from(rel);
        news.push(it);
      }
    } else {
      // Market-wide news
      const topics = ["stock market", "global markets", "economy"];
      const seen = new Set<string>();
      for (const topic of topics) {
        try {
          const items = await fetchNewsFromYahoo(topic, 10);
          for (const it of items) {
            const key = `${it.title.toLowerCase()}|${
              (it.source || "").toLowerCase()
            }`;
            if (seen.has(key)) continue;
            seen.add(key);
            news.push(it);
          }
        } catch (e) {
          console.warn("[api/news] topic fetch error:", e);
        }
      }
    }

    res.status(200).json({ news });
  } catch (err: any) {
    console.error("[api/news] error:", err);
    res
      .status(500)
      .json({ error: String(err?.message || err || "Unknown error"), news: [] });
  }
}


