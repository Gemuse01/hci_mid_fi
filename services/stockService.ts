// services/stockService.ts
// 실제 나스닥 종목 검색 + 실시간 시세 조회용 서비스 레이어
// 주의: 이 파일은 프론트엔드에서 직접 외부 API를 호출하므로,
//      실 서비스에서는 프록시/백엔드로 감추는 것이 안전합니다.
//      (수업/데모용으로 설계)
import type { Stock } from "../types";

// 예시: Alpha Vantage (https://www.alphavantage.co/documentation/)
// .env.local 에 VITE_STOCK_API_KEY 를 넣어 사용하세요.
const STOCK_API_KEY = import.meta.env.VITE_STOCK_API_KEY as string | undefined;

if (!STOCK_API_KEY) {
  // 개발 편의를 위해 콘솔 경고만 출력 (UI는 기존 MOCK_STOCKS 로 동작)
  console.warn(
    "[stockService] VITE_STOCK_API_KEY 가 설정되지 않았습니다. " +
      "나스닥 검색 / 실시간 시세는 동작하지 않고, 기본 MOCK_STOCKS 만 사용됩니다."
  );
}

// 간단한 검색 결과 타입 (Stock 타입과 거의 동일하게 맞춤)
export interface RealtimeStock extends Stock {}

// 나스닥 종목 검색
export async function searchNasdaqStocks(query: string): Promise<RealtimeStock[]> {
  if (!STOCK_API_KEY || !query.trim()) return [];

  // Alpha Vantage SYMBOL_SEARCH 사용 (컴퍼니/심볼 검색)
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "SYMBOL_SEARCH");
  url.searchParams.set("keywords", query.trim());
  url.searchParams.set("apikey", STOCK_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("Stock search error:", res.status, res.statusText);
    return [];
  }

  const data = await res.json();
  const matches = data?.bestMatches ?? [];

  // Alpha Vantage 응답 예시 키: "1. symbol", "2. name", "4. region" 등
  // region 이 "United States" 이고, 나스닥 심볼에 많이 포함되는 ".O" 등 필터는
  // 실제 환경에 맞게 조정 가능. 여기선 기본적인 미국 주식만 필터링.
  const results: RealtimeStock[] = matches
    .filter((m: any) => m["4. region"]?.includes("United States"))
    .slice(0, 10)
    .map((m: any) => ({
      symbol: m["1. symbol"],
      name: m["2. name"],
      price: 0, // 실시간 가격은 별도 quote API 에서 채움
      change_pct: 0,
      sector: "N/A",
      volatility: "medium",
    }));

  return results;
}

// 여러 심볼에 대한 실시간 시세 조회
// Alpha Vantage 는 배치가 약해서, 심볼 수가 많으면 호출을 나눠야 합니다.
// 여기서는 간단히 하나씩 순회 (데모/과제용).
export async function getRealtimeQuotes(
  symbols: string[]
): Promise<Record<string, { price: number; change_pct: number }>> {
  const quotes: Record<string, { price: number; change_pct: number }> = {};

  if (!STOCK_API_KEY || symbols.length === 0) return quotes;

  // 심볼 수가 많으면 API 한도에 걸릴 수 있으니 상한 설정
  const limitedSymbols = symbols.slice(0, 15);

  await Promise.all(
    limitedSymbols.map(async (symbol) => {
      try {
        const url = new URL("https://www.alphavantage.co/query");
        url.searchParams.set("function", "GLOBAL_QUOTE");
        url.searchParams.set("symbol", symbol);
        url.searchParams.set("apikey", STOCK_API_KEY);

        const res = await fetch(url.toString());
        if (!res.ok) return;

        const data = await res.json();
        const q = data?.["Global Quote"];
        if (!q) return;

        const price = Number(q["05. price"]) || 0;
        const changePct = Number(q["10. change percent"]?.replace("%", "")) || 0;

        if (price > 0) {
          quotes[symbol] = { price, change_pct: changePct };
        }
      } catch (e) {
        console.error("Quote fetch error for", symbol, e);
      }
    })
  );

  return quotes;
}


