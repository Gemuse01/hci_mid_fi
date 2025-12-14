// api/quote.ts
// Vercel Serverless Function: fetch latest price and 1-day change % from Yahoo Finance.

const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/";

export default async function handler(req: any, res: any) {
  const symbol = (req.query?.symbol || req.query?.Symbol || "").toString().trim();
  if (!symbol) {
    res.status(400).json({ error: "no symbol" });
    return;
  }

  try {
    const url = `${YAHOO_CHART_URL}${encodeURIComponent(
      symbol,
    )}?range=2d&interval=1d`;

    const resp = await fetch(url);
    if (!resp.ok) {
      res
        .status(502)
        .json({ error: `Yahoo Finance error ${resp.status}: ${resp.statusText}` });
      return;
    }
    const data: any = await resp.json();

    const result = data?.chart?.result?.[0];
    const quotes = result?.indicators?.quote?.[0];
    const closes: number[] = quotes?.close || [];

    if (!Array.isArray(closes) || closes.length === 0) {
      res.status(404).json({ error: "No price data" });
      return;
    }

    const price = Number(closes[closes.length - 1]);
    const prevClose =
      closes.length > 1 ? Number(closes[closes.length - 2]) : price;

    const change_pct =
      prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    res.status(200).json({
      symbol,
      price,
      change_pct,
    });
  } catch (err: any) {
    console.error("[api/quote] error:", err);
    res
      .status(500)
      .json({ error: String(err?.message || err || "Unknown error") });
  }
}


