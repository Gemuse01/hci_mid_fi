import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { MOCK_STOCKS } from '../constants';
import { Stock } from '../types';
import {
  TrendingUp,
  PieChart,
  Wallet,
  BarChart2,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  AlertCircle,
  History,
} from 'lucide-react';
import { searchNasdaqStocks, getRealtimeQuotes } from '../services/stockService';

const QUOTE_CACHE_KEY = 'finguide_live_quotes_v1';

const VirtualTrading: React.FC = () => {
  const { user, portfolio, transactions, executeTrade, addDiaryEntry } = useApp();
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | string>(1);

  // --- 검색 & 실시간 시세 상태 ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchCache, setSearchCache] = useState<Record<string, Stock[]>>({});
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; change_pct: number }>>({});
  const [lastTrade, setLastTrade] = useState<{ type: 'BUY' | 'SELL'; symbol: string } | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionData, setReflectionData] = useState({
    emotion: 'neutral',
    reason: 'analysis',
    note: '',
  });

  // 화면에 보여줄 종목 리스트 (검색 결과가 있으면 그걸 우선 사용)
  const visibleStocks: Stock[] =
    searchQuery.trim() && searchResults.length > 0 ? searchResults : MOCK_STOCKS;

  // --- 로컬 캐시에서 마지막 실시간 시세 복원 ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUOTE_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, { price: number; change_pct: number }>;
        setLivePrices(parsed);
      }
    } catch (e) {
      console.warn('Failed to load quote cache', e);
    }
  }, []);

  // --- Portfolio Calculations (실시간 시세를 반영한 총 평가액) ---
  const currentHoldingsValue = useMemo(() => {
    return portfolio.assets.reduce((sum, asset) => {
      const live = livePrices[asset.symbol];
      const fallbackPrice =
        MOCK_STOCKS.find((s) => s.symbol === asset.symbol)?.price || asset.avg_price;
      const currentPrice = live?.price ?? fallbackPrice;
      return sum + asset.quantity * currentPrice;
    }, 0);
  }, [livePrices, portfolio.assets]);

  const totalEquity = portfolio.cash + currentHoldingsValue;
  const totalPL = totalEquity - user.initial_capital;
  const totalPLPercent = (totalPL / user.initial_capital) * 100;

  // --- 나스닥 종목 검색 ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    // 같은 쿼리는 캐시에서 즉시 반환 (API 한도 회피 + 안정성)
    if (searchCache[q]) {
      setSearchResults(searchCache[q]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchNasdaqStocks(q);
      if (results.length === 0) {
        // API 한도 초과나 일시 오류일 수 있으므로, 이전 결과는 유지하고 메시지만 보여줌
        setSearchError('지금은 외부 주가 API 한도/오류로 검색 결과를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setSearchResults(results);
        setSearchCache((prev) => ({ ...prev, [q]: results }));
      }
    } catch (err) {
      console.error("Stock search failed:", err);
      setSearchError('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  // --- 실시간 시세 업데이트 (폴링: 기본 6종목 + 검색 종목 + 보유 종목 전체에 대해, 몇 분에 한 번만) ---
  useEffect(() => {
    const symbols = Array.from(
      new Set([
        ...MOCK_STOCKS.map((s) => s.symbol),
        ...searchResults.map((s) => s.symbol),
        ...portfolio.assets.map((a) => a.symbol),
      ])
    );
    if (symbols.length === 0) return;

    let isCancelled = false;

    const fetchQuotes = async () => {
      try {
        const quotes = await getRealtimeQuotes(symbols);
        if (!isCancelled) {
          setLivePrices((prev) => {
            const merged = { ...prev, ...quotes };
            try {
              localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(merged));
            } catch (e) {
              console.warn('Failed to save quote cache', e);
            }
            return merged;
          });
        }
      } catch (err) {
        console.error("Realtime quote fetch error:", err);
      }
    };

    // 첫 로딩 + 3분마다 갱신 (너무 자주 바뀌지 않도록)
    fetchQuotes();
    const id = window.setInterval(fetchQuotes, 3 * 60 * 1000);
    return () => {
      isCancelled = true;
      window.clearInterval(id);
    };
  }, [searchResults, portfolio.assets]);

  // --- Handlers ---
  const handleOpenTrade = (stock: Stock) => {
    const live = livePrices[stock.symbol];
    const stockWithLivePrice: Stock = live
      ? { ...stock, price: live.price, change_pct: live.change_pct }
      : stock;
    setSelectedStock(stockWithLivePrice);
    setTradeType('BUY');
    setQuantity(1);
  };

  const handleCloseTrade = () => {
    setSelectedStock(null);
  };

  const handleExecute = () => {
    if (!selectedStock) return;
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    executeTrade(tradeType, selectedStock.symbol, qty, selectedStock.price);
    setLastTrade({ type: tradeType, symbol: selectedStock.symbol });
    setShowReflection(true);
  };

  const getOwnedQuantity = (symbol: string) => {
    return portfolio.assets.find((a) => a.symbol === symbol)?.quantity || 0;
  };

  const handleSaveReflection = () => {
    if (lastTrade) {
       addDiaryEntry({
         emotion: reflectionData.emotion as any,
         reason: reflectionData.reason as any,
         note: `[Post-Trade Reflection for ${lastTrade.type} ${lastTrade.symbol}] ${reflectionData.note}`,
        related_symbol: lastTrade.symbol,
       });
    }
    setShowReflection(false);
    setReflectionData({ emotion: 'neutral', reason: 'analysis', note: '' });
  };

  // --- JSX ---
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* 상단 요약 카드 */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-primary-600" size={28} />
            Virtual Trading Floor
          </h1>
          <p className="text-gray-600 mt-1">
            나스닥 종목을 검색해서 가상으로 매매해보면서, 실시간 시세 변화에 익숙해져 보세요.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <PieChart size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Equity</span>
                </div>
            <p className="text-xl font-extrabold text-gray-900">
              ${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Wallet size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Buying Power</span>
                </div>
            <p className="text-xl font-extrabold text-gray-900">
              ${portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 col-span-2 md:col-span-2">
                 <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <BarChart2 size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Total P/L</span>
                </div>
            <div
              className={`flex items-center text-xl font-extrabold ${
                totalPL >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
                    {totalPL >= 0 ? '+' : ''}${totalPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span
                className={`ml-2 text-sm font-bold px-2 py-0.5 rounded-md ${
                  totalPL >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                        {totalPLPercent.toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* 검색 + 종목 그리드 */}
      <div className="space-y-4">
        {/* 검색 바 */}
        <form
          onSubmit={handleSearch}
          className="flex flex-col md:flex-row gap-3 md:items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200"
        >
          <div className="flex-1 flex items-center gap-2">
            <Search className="text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="나스닥 종목 심볼이나 이름으로 검색 (예: AAPL, NVIDIA)..."
              className="w-full border-none focus:ring-0 text-sm md:text-base text-gray-900 placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {searchError && (
          <p className="text-xs text-red-500 px-1">{searchError}</p>
        )}

        {/* 종목 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleStocks.map((stock) => {
          const owned = getOwnedQuantity(stock.symbol);
            const live = livePrices[stock.symbol];
            // 1순위: 마지막으로 성공적으로 받은 실시간 API 가격
            // 2순위: 과거에 저장돼 있는 stock.price (검색 직후 0일 수 있음)
            // 3순위: 0 (아예 정보가 없을 때만)
            const price = live?.price ?? stock.price ?? 0;
            const changePct = live?.change_pct ?? stock.change_pct ?? 0;

          return (
              <div
                key={stock.symbol}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group"
              >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {stock.symbol}
                      </h3>
                    <p className="text-sm text-gray-500 font-medium">{stock.name}</p>
                  </div>
                    <div
                      className={`flex items-center text-sm font-bold ${
                        changePct >= 0
                          ? 'text-green-600 bg-green-50 px-2 py-1 rounded-md'
                          : 'text-red-600 bg-red-50 px-2 py-1 rounded-md'
                      }`}
                    >
                      {changePct >= 0 ? (
                        <ArrowUpRight size={16} className="mr-1" />
                      ) : (
                        <ArrowDownRight size={16} className="mr-1" />
                      )}
                      {changePct > 0 ? '+' : ''}
                      {changePct.toFixed(2)}%
                  </div>
                </div>

                <div className="flex justify-between items-end mb-6">
                   <div>
                      <p className="text-3xl font-extrabold text-gray-900">${price.toFixed(2)}</p>
                   </div>
                   <div className="text-right">
                      <span className="inline-block px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wider bg-blue-100 text-blue-800">
                        Live
                      </span>
                   </div>
                </div>

                {owned > 0 && (
                  <div className="mb-4 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg flex items-center text-sm font-medium">
                    <Briefcase size={16} className="mr-2" />
                      Owned:&nbsp;<strong>{owned}</strong>
                  </div>
                )}

                <button
                    onClick={() => handleOpenTrade({ ...stock, price })}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  Trade
                </button>
              </div>
            </div>
          );
        })}
          </div>
      </div>

      {/* 선택한 종목에 대한 간단한 거래 패널 */}
      {selectedStock && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
                <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                     {tradeType === 'BUY' ? 'Buy' : 'Sell'} {selectedStock.symbol}
                   </h2>
              <p className="text-sm text-gray-500">
                현재가 ${selectedStock.price.toFixed(2)} · 보유 수량 {getOwnedQuantity(selectedStock.symbol)}
              </p>
                    </div>
            <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  tradeType === 'BUY' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                      onClick={() => setTradeType('BUY')}
                    >
                      BUY
                    </button>
                    <button
                className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  tradeType === 'SELL' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                      onClick={() => setTradeType('SELL')}
                    >
                      SELL
                    </button>
            </div>
                  </div>

          <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
              수량 {tradeType === 'SELL' && `(최대: ${getOwnedQuantity(selectedStock.symbol)})`}
                    </label>
                    <input
                      type="number"
              min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="block w-full border-gray-300 bg-blue-50 text-gray-900 rounded-xl py-3 px-4 focus:ring-primary-500 focus:border-primary-500 text-lg font-bold"
                    />
                  </div>

          <div className="flex justify-between py-3 border-t border-b border-gray-100 text-sm">
            <span className="text-gray-500 font-medium">예상 거래금액</span>
                    <span className="font-extrabold text-gray-900 text-lg">
              ${(Number(quantity || 0) * selectedStock.price).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
                    </span>
                  </div>

          {tradeType === 'BUY' && Number(quantity) * selectedStock.price > portfolio.cash && (
            <div className="mb-1 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-bold">
                       <AlertCircle size={18} />
              보유 현금이 부족합니다.
                     </div>
                  )}

                  {tradeType === 'SELL' && Number(quantity) > getOwnedQuantity(selectedStock.symbol) && (
            <div className="mb-1 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-bold">
                        <AlertCircle size={18} />
              보유 수량보다 많이 팔 수 없습니다.
                      </div>
                  )}

          <div className="flex gap-3">
                  <button
                    onClick={handleExecute}
                    disabled={
                Number(quantity) <= 0 ||
                (tradeType === 'BUY' && Number(quantity) * selectedStock.price > portfolio.cash) ||
                (tradeType === 'SELL' && Number(quantity) > getOwnedQuantity(selectedStock.symbol))
              }
              className={`flex-1 py-3 rounded-xl font-extrabold text-white text-lg transition-all ${
                      tradeType === 'BUY' 
                        ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300' 
                        : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                    }`}
                  >
                    Confirm {tradeType}
                  </button>
            <button
              type="button"
              onClick={handleCloseTrade}
              className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 보유 종목 / 거래 내역 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <div className="flex-1 py-4 text-sm font-bold text-center flex items-center justify-center gap-2 bg-gray-50">
            <PieChart size={18} /> Current Holdings
          </div>
          <div className="flex-1 py-4 text-sm font-bold text-center flex items-center justify-center gap-2 bg-gray-50 border-l border-gray-200">
            <History size={18} /> Trade History
          </div>
        </div>

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {/* Holdings */}
          <div className="p-4 md:p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3">보유 종목</h3>
            {portfolio.assets.length === 0 ? (
              <p className="text-sm text-gray-400">아직 보유 중인 종목이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                      Symbol
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                      Avg
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                      Mkt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {portfolio.assets.map((asset) => {
                    const live = livePrices[asset.symbol];
                    const currentPrice = live?.price ?? asset.avg_price;
                    return (
                      <tr key={asset.symbol}>
                        <td className="py-2 px-2 font-bold text-gray-900">{asset.symbol}</td>
                        <td className="py-2 px-2 text-right">{asset.quantity}</td>
                        <td className="py-2 px-2 text-right text-gray-500">
                          ${asset.avg_price.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-bold">
                          ${currentPrice.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Trade history */}
          <div className="p-4 md:p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3">가상 매매 내역</h3>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400">아직 실행된 주문이 없습니다.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                        Symbol
                      </th>
                      <th className="text-right py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="text-right py-2 px-2 text-xs font-bold text-gray-500 uppercase">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 px-2 text-xs text-gray-500">
                          {new Date(tx.date).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded-md uppercase ${
                              tx.type === 'BUY'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-bold text-gray-900">{tx.symbol}</td>
                        <td className="py-2 px-2 text-right">{tx.quantity}</td>
                        <td className="py-2 px-2 text-right text-gray-600">
                          ${tx.price.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
                        </div>
                    </div>

      {/* Post-Trade Reflection Modal (트레이딩 다이어리 연동) */}
      {showReflection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-gray-900 mb-4">Trade Executed</h2>
            <p className="text-sm text-gray-600 mb-4">
              방금 실행한 가상 매매에 대해 간단히 기록해두면, 트레이딩 다이어리에서 다시 볼 수 있어요.
            </p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Main Reason</label>
                            <select 
                                className="w-full p-3 bg-blue-50 border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-primary-500 focus:border-primary-500"
                                value={reflectionData.reason}
                  onChange={(e) => setReflectionData({ ...reflectionData, reason: e.target.value })}
                            >
                                <option value="analysis">📈 My Analysis</option>
                                <option value="news">📰 News Event</option>
                                <option value="impulse">⚡ Impulse / FOMO</option>
                                <option value="recommendation">🗣️ Recommendation</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Current Emotion</label>
                             <select 
                                className="w-full p-3 bg-blue-50 border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-primary-500 focus:border-primary-500"
                                value={reflectionData.emotion}
                  onChange={(e) => setReflectionData({ ...reflectionData, emotion: e.target.value })}
                            >
                                <option value="neutral">😐 Neutral</option>
                                <option value="confident">😌 Confident</option>
                                <option value="excited">🤩 Excited</option>
                                <option value="anxious">😰 Anxious</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Quick Note (Optional)</label>
                            <textarea 
                                className="w-full p-3 bg-blue-50 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-primary-500 focus:border-primary-500"
                                rows={2}
                  placeholder="예: 실적 기대감으로 단기 상승을 노렸음..."
                                value={reflectionData.note}
                  onChange={(e) => setReflectionData({ ...reflectionData, note: e.target.value })}
                            />
                        </div>

              <div className="flex gap-3 mt-2">
                        <button 
                            onClick={handleSaveReflection}
                  className="flex-1 py-3.5 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors"
                        >
                            Save to Diary
                        </button>
                <button
                  type="button"
                  onClick={() => setShowReflection(false)}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  건너뛰기
                        </button>
                    </div>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default VirtualTrading;