// services/stockService.ts
import type { Stock } from "../types";
import { apiUrl, API_BASE_URL } from "./apiClient";

// yfinance backend proxy URL (quote endpoint)
const YFINANCE_API_URL = apiUrl("/api/quote");

// 여러 심볼의 실시간 시세 (yfinance 백엔드에 요청)
export async function getYFinanceQuotes(
  symbols: string[]
): Promise<Record<string, { price: number; change_pct: number }>> {
  const quotes: Record<string, { price: number; change_pct: number }> = {};

  const hasExternalBackend =
    typeof API_BASE_URL === "string" && API_BASE_URL.trim().length > 0;
  const isDev = import.meta.env.DEV;

  // 순수 Vite dev 환경에서 별도 백엔드가 없으면,
  // /api/quote 는 TS 소스를 그대로 반환하고,
  // Yahoo Finance CORS 차단 때문에 브라우저에서 직접 호출도 어렵다.
  // → 이 경우에는 조용히 live quote 업데이트를 건너뛴다.
  if (!hasExternalBackend && isDev) {
    console.warn(
      "[yfinance] No backend configured in dev; skipping live quotes (avoid CORS / TS-source responses)."
    );
    return quotes;
  }

  // 프로덕션 또는 별도 백엔드가 있는 경우: 기존 yfinance 프록시 엔드포인트 사용
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `${YFINANCE_API_URL}?symbol=${encodeURIComponent(symbol)}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(
            `[yfinance] Failed to fetch ${symbol}: ${res.status} ${res.statusText}`
          );
          return;
        }
        const data = await res.json();
        if (data.price && data.price > 0) {
          quotes[symbol] = {
            price: data.price,
            change_pct: data.change_pct || 0,
          };
        }
      } catch (err) {
        console.error(`[yfinance] Error fetching ${symbol}:`, err);
      }
    })
  );

  return quotes;
}

// --- 종목검색: yfinance 백엔드를 통한 실제 검색 (나스닥 + 한국 주식 전체)
export async function searchNasdaqStocks(query: string): Promise<Stock[]> {
  if (!query.trim()) return [];

  const hasExternalBackend =
    typeof API_BASE_URL === "string" && API_BASE_URL.trim().length > 0;
  const isDev = import.meta.env.DEV;

  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();

  // dev 에서 별도 백엔드가 없으면 /api/search 역시 TS 소스를 돌려주게 되므로,
  // 이 경우에는 조용히 빈 배열만 반환한다 (UI 에서는 "API 오류" 메시지로 처리됨).
  if (!hasExternalBackend && isDev) {
    console.warn(
      "[yfinance] No backend configured in dev; skipping /api/search to avoid TS-source / loader errors."
    );
    return [];
  }

  try {
    const res = await fetch(
      apiUrl(`/api/search?query=${encodeURIComponent(trimmed)}`)
    );

    let results: Stock[] = [];

    if (res.ok) {
      const data = await res.json();
      results = (data.results || []).map((r: any) => ({
        symbol: r.symbol,
        name: r.name,
        price: r.price || 0,
        change_pct: r.change_pct || 0,
        sector: r.sector || "N/A",
        volatility: r.volatility || "medium",
      }));
    } else {
      console.warn(
        `[yfinance] Search failed: ${res.status} ${res.statusText}`
      );
    }

    // 기본 검색 결과가 있으면 그대로 사용
    if (results.length > 0) {
      return results;
    }

    // -----------------------------
    // Fallback: 쿼리가 이미 "완전한 심볼" 형태이면 quote 엔드포인트를 통해 직접 시세를 가져와
    // 최소한 한 개의 결과라도 돌려준다.
    // - 예시: "005930.KS", "123456.KQ", "AAPL", "TSLA"
    // -----------------------------
    const isKoreanTicker = /^[0-9]{6}\.(KS|KQ)$/i.test(upper);
    const isSimpleTicker = /^[A-Z.]{1,10}$/.test(upper);

    if (!isKoreanTicker && !isSimpleTicker) {
      return [];
    }

    try {
      const quoteRes = await fetch(
        apiUrl(`/api/quote?symbol=${encodeURIComponent(upper)}`)
      );
      if (!quoteRes.ok) {
        console.warn(
          `[yfinance] Quote fallback failed for ${upper}: ${quoteRes.status} ${quoteRes.statusText}`
        );
        return [];
      }
      const qData: any = await quoteRes.json();
      const price = Number(qData?.price ?? 0);
      if (!price || price <= 0) {
        return [];
      }

      const stock: Stock = {
        symbol: upper,
        name: upper, // 이름을 못 가져오더라도 최소한 심볼 기준으로는 거래 가능하게
        price,
        change_pct: Number(qData?.change_pct ?? 0),
        sector: "N/A",
        volatility: "medium",
      };

      return [stock];
    } catch (err) {
      console.warn("[yfinance] Quote fallback search error:", err);
      return [];
    }
  } catch (err) {
    console.error("[yfinance] Search error:", err);
    return [];
  }
}


