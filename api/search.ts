// api/search.ts
// Search stocks using Yahoo Finance quote/search APIs.

import type { IncomingMessage, ServerResponse } from "http";

const YAHOO_SEARCH_URL =
  "https://query1.finance.yahoo.com/v1/finance/search";
const YAHOO_QUOTE_URL =
  "https://query1.finance.yahoo.com/v7/finance/quote";

function buildCandidateSymbols(query: string): string[] {
  const symbols: string[] = [];
  const upper = query.toUpperCase();

  // If query already ends with .KS or .KQ, treat as Korean ticker
  if (upper.endsWith(".KS") || upper.endsWith(".KQ")) {
    symbols.push(upper);
    return symbols;
  }

  // Extract 6-digit code if present (e.g. "삼성전자 005930")
  const m = query.match(/\d{6}/);
  if (m) {
    const code = m[0];
    symbols.push(`${code}.KS`, `${code}.KQ`);
  } else if (/^\d+$/.test(query) && query.length < 6) {
    // Pad shorter numeric codes to 6 digits
    const padded = query.padStart(6, "0");
    symbols.push(`${padded}.KS`, `${padded}.KQ`);
  } else {
    // Fallback: treat as NASDAQ-style symbol
    symbols.push(upper);
  }

  return symbols;
}

async function yahooSearchSymbols(query: string): Promise<string[]> {
  try {
    const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(
      query,
    )}&quotesCount=8&newsCount=0&listsCount=0`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data: any = await resp.json();
    const quotes = data?.quotes || [];
    const out: string[] = [];
    for (const q of quotes) {
      const sym = (q?.symbol ?? "").toString().trim();
      if (sym && !out.includes(sym)) out.push(sym);
    }
    return out;
  } catch (err) {
    console.warn("[api/search] yahooSearchSymbols error:", err);
    return [];
  }
}

async function fetchQuotes(symbols: string[]) {
  if (!symbols.length) return [];
  const batches: string[][] = [];
  const maxBatch = 10;
  for (let i = 0; i < symbols.length; i += maxBatch) {
    batches.push(symbols.slice(i, i + maxBatch));
  }

  const results: any[] = [];

  for (const batch of batches) {
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(
      batch.join(","),
    )}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data: any = await resp.json();
      const quotes = data?.quoteResponse?.result || [];
      for (const q of quotes) {
        results.push(q);
      }
    } catch (err) {
      console.warn("[api/search] fetchQuotes batch error:", err);
    }
  }

  return results;
}

export default async function handler(req: any, res: any) {
  const rawQuery =
    (req.query?.query as string | undefined) ||
    (req.query?.q as string | undefined) ||
    "";
  const query = rawQuery.trim();

  if (!query) {
    res.status(200).json({ results: [] });
    return;
  }

  try {
    const candidates = new Set<string>();

    // 1) heuristic-based candidates
    for (const s of buildCandidateSymbols(query)) {
      candidates.add(s);
    }

    // 2) Yahoo search-based candidates
    const yahooSyms = await yahooSearchSymbols(query);
    yahooSyms.forEach((s) => candidates.add(s.toUpperCase()));

    const allSymbols = Array.from(candidates).slice(0, 25);
    const quotes = await fetchQuotes(allSymbols);

    const results = quotes
      .map((q: any) => {
        const symbol = (q?.symbol ?? "").toString().trim();
        if (!symbol) return null;
        const name =
          (q?.longName ?? q?.shortName ?? "").toString().trim() || symbol;
        const price = Number(q?.regularMarketPrice ?? 0);
        if (!price || price <= 0) return null;
        const change_pct = Number(
          q?.regularMarketChangePercent ?? 0,
        );
        const sector =
          (q?.sector ?? q?.industry ?? "N/A").toString().trim() || "N/A";

        return {
          symbol,
          name,
          price,
          change_pct,
          sector,
          volatility: "medium",
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    res.status(200).json({ results });
  } catch (err: any) {
    console.error("[api/search] error:", err);
    res
      .status(500)
      .json({ error: String(err?.message || err || "Unknown error") });
  }
}


