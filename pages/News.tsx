// pages/News.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Tag,
  Search,
  Loader2,
} from "lucide-react";
import { fetchNews } from "../services/newsService";
import type { NewsItem, NewsImpact } from "../types";
import {
  classifyNewsImpact,
  summarizeNews,
} from "../services/geminiService";

// 검색 목록에 보여줄 티커들 (예시)
const TICKER_OPTIONS = [
  { symbol: "TSLA", label: "Tesla (TSLA)" },
  { symbol: "MSFT", label: "Microsoft (MSFT)" },
  { symbol: "AAPL", label: "Apple (AAPL)" },
  { symbol: "GOOGL", label: "Alphabet (GOOGL)" },
  { symbol: "005930.KS", label: "Samsung Electronics (005930.KS)" },
  { symbol: "000660.KS", label: "SK hynix (000660.KS)" },
];

const getImpactIcon = (impact: NewsImpact | string | undefined) => {
  switch (impact) {
    case "positive":
      return <TrendingUp className="text-green-500" size={20} />;
    case "negative":
      return <TrendingDown className="text-red-500" size={20} />;
    default:
      return <Minus className="text-gray-400" size={20} />;
  }
};

const getImpactClass = (impact: NewsImpact | string | undefined) => {
  switch (impact) {
    case "positive":
      return "bg-green-50 text-green-800 border-green-100";
    case "negative":
      return "bg-red-50 text-red-800 border-red-100";
    default:
      return "bg-gray-50 text-gray-800 border-gray-200";
  }
};

const News: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  // 티커별 뉴스 묶음
  const [newsByTicker, setNewsByTicker] = useState<Record<string, NewsItem[]>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기사별 요약 / 임팩트 / 로딩 상태 / 에러
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [impacts, setImpacts] = useState<Record<string, NewsImpact>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 검색어로 필터링된 티커 목록
  const filteredTickers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TICKER_OPTIONS;
    return TICKER_OPTIONS.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q)
    );
  }, [search]);

  const toggleTicker = (symbol: string) => {
    setSelectedTickers((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  // 🔹 선택된 티커가 바뀔 때마다 뉴스 가져오기
useEffect(() => {
  if (!selectedTickers.length) {
    setNewsByTicker({});
    return;
  }

  let cancelled = false;

  (async () => {
    setLoading(true);
    setError(null);

    try {
      // ✅ 각 티커마다 별도로 API 호출
      const results = await Promise.all(
        selectedTickers.map(async (symbol) => {
          try {
            const items = await fetchNews(symbol);
            return { symbol, items };
          } catch (e) {
            console.error("News load error for symbol:", symbol, e);
            return { symbol, items: [] as NewsItem[] };
          }
        })
      );

      if (cancelled) return;

      const grouped: Record<string, NewsItem[]> = {};

      for (const { symbol, items } of results) {
        // 각 티커당 최대 5개만 사용
        grouped[symbol] = (items || []).slice(0, 5);
      }

      setNewsByTicker(grouped);
    } catch (e) {
      if (!cancelled) {
        console.error("News load error (fetch or parsing):", e);
        setError("뉴스를 불러오는 데 실패했습니다.");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [selectedTickers]);


  const handleAnalyze = async (item: NewsItem) => {
    const id = item.id;
    setAnalyzing((prev) => ({ ...prev, [id]: true }));
    setErrors((prev) => ({ ...prev, [id]: "" }));

    try {
      const baseSummary = item.summary ?? "";
      const summaryFromLLM = await summarizeNews(item.title, baseSummary);
      const finalSummary =
        summaryFromLLM && summaryFromLLM.trim().length > 0
          ? summaryFromLLM.trim()
          : baseSummary;

      const impactFromLLM = await classifyNewsImpact(item.title, finalSummary);

      setSummaries((prev) => ({ ...prev, [id]: finalSummary }));
      if (impactFromLLM) {
        setImpacts((prev) => ({ ...prev, [id]: impactFromLLM }));
      }
    } catch (e) {
      console.error("Gemini analyze error:", item.title, e);
      setErrors((prev) => ({
        ...prev,
        [item.id]: "AI 분석 중 오류가 발생했습니다.",
      }));
    } finally {
      setAnalyzing((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Newspaper className="text-primary-600" size={28} />
          Market News & Reports
        </h1>
        <p className="text-gray-600 mt-1">
          티커를 검색해서 관련 뉴스를 보고, 필요한 기사만 AI로 요약·임팩트 분석해보세요.
        </p>
      </div>

      {/* 검색 + 티커 선택 섹션 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="티커 또는 종목명으로 검색 (예: TSLA, 삼성전자, 005930.KS)"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="max-h-40 overflow-y-auto border-t border-gray-100 pt-3 space-y-1">
          {filteredTickers.length === 0 && (
            <p className="text-sm text-gray-500">
              일치하는 티커가 없습니다. 다른 키워드로 검색해 보세요.
            </p>
          )}

          {filteredTickers.map((t) => (
            <label
              key={t.symbol}
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTickers.includes(t.symbol)}
                  onChange={() => toggleTicker(t.symbol)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-mono text-xs text-gray-800">
                  {t.symbol}
                </span>
                <span className="text-gray-500 text-xs">{t.label}</span>
              </div>
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          선택된 티커 수:{" "}
          <span className="font-semibold text-primary-700">
            {selectedTickers.length}
          </span>
        </p>
      </section>

      {/* 로딩 / 에러 */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="animate-spin" size={18} />
          <span>뉴스를 불러오는 중입니다...</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 뉴스 카드 리스트 */}
      <div className="space-y-8">
        {selectedTickers.length === 0 && (
          <div className="text-sm text-gray-500">
            상단 검색창에서 티커를 선택하면 해당 종목의 뉴스가 표시됩니다.
          </div>
        )}

        {selectedTickers.map((ticker) => {
          const items = newsByTicker[ticker] || [];
          if (!items.length) {
            return (
              <section key={ticker} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                    {ticker}
                  </span>
                  <span className="text-xs text-gray-500">
                    이 티커에 대한 최근 뉴스를 찾지 못했습니다.
                  </span>
                </div>
              </section>
            );
          }

          return (
            <section key={ticker} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                  {ticker}
                </span>
                <span className="text-xs text-gray-500">
                  최근 기사 {items.length}개 (최대 5개까지 표시)
                </span>
              </div>

              <div className="space-y-4">
                {items.map((item) => {
                  const effectiveImpact: NewsImpact =
                    impacts[item.id] ?? item.impact ?? "neutral";
                  const effectiveSummary =
                    summaries[item.id] ?? item.summary ?? "";

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4 gap-4">
                          <div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                              <span className="font-bold text-primary-700">
                                {item.publisher || item.source || "Unknown"}
                              </span>
                              <span>•</span>
                              <span className="flex items-center">
                                <Clock size={14} className="mr-1" />
                                {item.date || "N/A"}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 leading-tight">
                              {item.title}
                            </h3>
                          </div>

                          <div
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 border ${getImpactClass(
                              effectiveImpact
                            )}`}
                          >
                            {getImpactIcon(effectiveImpact)}
                            {effectiveImpact}
                          </div>
                        </div>

                        <p className="text-gray-700 leading-relaxed mb-4 text-sm">
                          {effectiveSummary || "요약 정보가 없습니다."}
                        </p>

                        <div className="flex flex-col gap-2">
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                            >
                              Read full article →
                            </a>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            <Tag size={16} className="text-gray-400" />
                            <div className="flex flex-wrap gap-2">
                              {(item.related_symbols || []).map((s) => (
                                <span
                                  key={s}
                                  className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md border border-blue-100"
                                >
                                  ${s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleAnalyze(item)}
                            disabled={analyzing[item.id]}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {analyzing[item.id] ? (
                              <>
                                <Loader2
                                  size={14}
                                  className="mr-1 animate-spin"
                                />
                                분석 중...
                              </>
                            ) : (
                              "AI로 요약·임팩트 분석"
                            )}
                          </button>

                          {errors[item.id] && (
                            <p className="text-xs text-red-500">
                              {errors[item.id]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* 바닥 문구 */}
      <div className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500">
        <Newspaper size={32} className="mx-auto mb-2 opacity-50" />
        <p className="font-medium">That's all the news for now.</p>
        <p className="text-sm">
          다른 티커를 선택하면 해당 종목의 뉴스가 새로 표시됩니다.
        </p>
      </div>
    </div>
  );
};

export default News;
