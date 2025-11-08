import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { MOCK_STOCKS } from '../constants';
import { Stock } from '../types';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Briefcase, BarChart2, Loader2, X, PieChart, History, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getStockAnalysis } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

const VirtualTrading: React.FC = () => {
  const { user, portfolio, transactions, marketCondition, executeTrade, addDiaryEntry, updateDiaryEntry } = useApp();
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [lastTrade, setLastTrade] = useState<{ type: 'BUY' | 'SELL', symbol: string } | null>(null);
  const [reflectionData, setReflectionData] = useState({ emotion: 'neutral', reason: 'analysis', note: '' });
  const [activeTab, setActiveTab] = useState<'holdings' | 'history'>('holdings');

  // --- Portfolio Calculations ---
  const currentHoldingsValue = useMemo(() => {
    return portfolio.assets.reduce((sum, asset) => {
      const currentPrice = MOCK_STOCKS.find(s => s.symbol === asset.symbol)?.price || asset.avg_price;
      return sum + (asset.quantity * currentPrice);
    }, 0);
  }, [portfolio.assets]);

  const totalEquity = portfolio.cash + currentHoldingsValue;
  const totalPL = totalEquity - user.initial_capital;
  const totalPLPercent = (totalPL / user.initial_capital) * 100;

  // --- Handlers ---
  const handleOpenTrade = (stock: Stock) => {
    setSelectedStock(stock);
    setTradeType('BUY');
    setQuantity(1);
    setAiAnalysis(null);
  };

  const handleCloseTrade = () => {
    setSelectedStock(null);
    setAiAnalysis(null);
  };

  const handleAnalyze = async () => {
    if (!selectedStock) return;
    setAnalyzing(true);
    try {
      const analysis = await getStockAnalysis(selectedStock.symbol, marketCondition, user.risk_tolerance);
      setAiAnalysis(analysis);
    } catch (e) {
      setAiAnalysis("**Error**: Could not fetch analysis at this time.");
    } finally {
      setAnalyzing(false);
    }
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
    handleCloseTrade();
    setShowReflection(true);
  };

  const handleSaveReflection = () => {
    if (lastTrade) {
       addDiaryEntry({
         emotion: reflectionData.emotion as any,
         reason: reflectionData.reason as any,
         note: `[Post-Trade Reflection for ${lastTrade.type} ${lastTrade.symbol}] ${reflectionData.note}`,
         related_symbol: lastTrade.symbol
       });
    }
    setShowReflection(false);
    setReflectionData({ emotion: 'neutral', reason: 'analysis', note: '' });
  };

  const getOwnedQuantity = (symbol: string) => {
    return portfolio.assets.find(a => a.symbol === symbol)?.quantity || 0;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header & Key Stats */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-primary-600" size={28} />
            Virtual Trading Floor
          </h1>
          <p className="text-gray-600 mt-1">Practice trading with real-time simulated market data.</p>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <PieChart size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Equity</span>
                </div>
                <p className="text-xl font-extrabold text-gray-900">${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Wallet size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Buying Power</span>
                </div>
                <p className="text-xl font-extrabold text-gray-900">${portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 col-span-2 md:col-span-2">
                 <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <BarChart2 size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Total P/L</span>
                </div>
                <div className={`flex items-center text-xl font-extrabold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalPL >= 0 ? '+' : ''}${totalPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className={`ml-2 text-sm font-bold px-2 py-0.5 rounded-md ${totalPL >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {totalPLPercent.toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* Stock Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_STOCKS.map(stock => {
          const owned = getOwnedQuantity(stock.symbol);
          return (
            <div key={stock.symbol} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{stock.symbol}</h3>
                    <p className="text-sm text-gray-500 font-medium">{stock.name}</p>
                  </div>
                  <div className={`flex items-center text-sm font-bold ${stock.change_pct >= 0 ? 'text-green-600 bg-green-50 px-2 py-1 rounded-md' : 'text-red-600 bg-red-50 px-2 py-1 rounded-md'}`}>
                    {stock.change_pct >= 0 ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
                    {stock.change_pct > 0 ? '+' : ''}{stock.change_pct}%
                  </div>
                </div>

                <div className="flex justify-between items-end mb-6">
                   <div>
                     <p className="text-3xl font-extrabold text-gray-900">${stock.price.toFixed(2)}</p>
                   </div>
                   <div className="text-right">
                      <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${stock.volatility === 'high' ? 'bg-orange-100 text-orange-800' : stock.volatility === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                        {stock.volatility} Vol
                      </span>
                   </div>
                </div>

                {owned > 0 && (
                  <div className="mb-4 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg flex items-center text-sm font-medium">
                    <Briefcase size={16} className="mr-2" />
                    Owned: <strong>&nbsp;{owned}</strong>
                  </div>
                )}

                <button
                  onClick={() => handleOpenTrade(stock)}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  Trade
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portfolio Details Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
              <button
                  onClick={() => setActiveTab('holdings')}
                  className={`flex-1 py-4 text-sm font-bold text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'holdings' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <PieChart size={18} /> Current Holdings
              </button>
              <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-4 text-sm font-bold text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <History size={18} /> Trade History
              </button>
          </div>

          <div className="p-0">
              {activeTab === 'holdings' && (
                  <div className="overflow-x-auto">
                      {portfolio.assets.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                              <Briefcase size={48} className="mx-auto mb-3 opacity-30" />
                              <p className="font-medium">No active holdings.</p>
                          </div>
                      ) : (
                          <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                      <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 uppercase">Symbol</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Qty</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Avg Price</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Mkt Price</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">P/L</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Action</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {portfolio.assets.map(asset => {
                                      const stock = MOCK_STOCKS.find(s => s.symbol === asset.symbol);
                                      const currentPrice = stock?.price || 0;
                                      const marketValue = asset.quantity * currentPrice;
                                      const costBasis = asset.quantity * asset.avg_price;
                                      const pl = marketValue - costBasis;
                                      const plPercent = (pl / costBasis) * 100;

                                      return (
                                          <tr key={asset.symbol} className="hover:bg-gray-50">
                                              <td className="py-4 px-6 font-bold text-gray-900">{asset.symbol}</td>
                                              <td className="py-4 px-6 text-right font-medium">{asset.quantity}</td>
                                              <td className="py-4 px-6 text-right text-gray-600">${asset.avg_price.toFixed(2)}</td>
                                              <td className="py-4 px-6 text-right font-bold">${currentPrice.toFixed(2)}</td>
                                              <td className={`py-4 px-6 text-right font-bold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                  <div className="flex flex-col items-end">
                                                      <span>{pl >= 0 ? '+' : ''}${pl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                      <span className="text-xs opacity-80">{plPercent.toFixed(2)}%</span>
                                                  </div>
                                              </td>
                                              <td className="py-4 px-6 text-right">
                                                  {stock && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedStock(stock);
                                                            setTradeType('SELL');
                                                            setQuantity(asset.quantity);
                                                        }}
                                                        className="px-3 py-1 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-md hover:bg-red-50 transition-colors"
                                                    >
                                                        Sell
                                                    </button>
                                                  )}
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      )}
                  </div>
              )}

              {activeTab === 'history' && (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                      {transactions.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                              <History size={48} className="mx-auto mb-3 opacity-30" />
                              <p className="font-medium">No transactions yet.</p>
                          </div>
                      ) : (
                          <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                                  <tr>
                                      <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 uppercase">Date</th>
                                      <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 uppercase">Type</th>
                                      <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 uppercase">Symbol</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Qty</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Price</th>
                                      <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase">Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {transactions.map(tx => (
                                      <tr key={tx.id} className="hover:bg-gray-50">
                                          <td className="py-3 px-6 text-sm text-gray-500">{new Date(tx.date).toLocaleString()}</td>
                                          <td className="py-3 px-6">
                                              <span className={`px-2 py-0.5 text-xs font-bold rounded-md uppercase ${tx.type === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                  {tx.type}
                                              </span>
                                          </td>
                                          <td className="py-3 px-6 font-bold text-gray-900">{tx.symbol}</td>
                                          <td className="py-3 px-6 text-right font-medium">{tx.quantity}</td>
                                          <td className="py-3 px-6 text-right text-gray-600">${tx.price.toFixed(2)}</td>
                                          <td className="py-3 px-6 text-right font-bold text-gray-900">${(tx.quantity * tx.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* Trade Modal (Existing) */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-full p-4">
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={handleCloseTrade} />
            <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                     {tradeType === 'BUY' ? 'Buy' : 'Sell'} {selectedStock.symbol}
                   </h2>
                   <p className="text-gray-500 font-medium">${selectedStock.price.toFixed(2)} per share</p>
                </div>
                <button onClick={handleCloseTrade} className="text-gray-400 hover:text-gray-500 p-1 bg-gray-50 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* AI Analysis Section */}
                {tradeType === 'BUY' && (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <BarChart2 size={18} />
                        AI Quick Analysis
                        </h3>
                        {!aiAnalysis && (
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            {analyzing ? <Loader2 size={12} className="animate-spin" /> : null}
                            {analyzing ? 'Analyzing...' : 'Get Insight'}
                        </button>
                        )}
                    </div>
                    {aiAnalysis ? (
                        <div className="prose prose-sm text-indigo-900">
                        <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-indigo-700/70 italic">
                        Tap "Get Insight" to see how {selectedStock.symbol} fits your {user.risk_tolerance} risk profile in this market.
                        </p>
                    )}
                    </div>
                )}

                {/* Trade Form */}
                <div>
                  <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                    <button
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tradeType === 'BUY' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      onClick={() => setTradeType('BUY')}
                    >
                      BUY
                    </button>
                    <button
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tradeType === 'SELL' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      onClick={() => setTradeType('SELL')}
                    >
                      SELL
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Quantity {tradeType === 'SELL' && `(Max: ${getOwnedQuantity(selectedStock.symbol)})`}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={tradeType === 'SELL' ? getOwnedQuantity(selectedStock.symbol) : undefined}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="block w-full border-gray-300 bg-blue-50 text-gray-900 rounded-xl py-3 px-4 focus:ring-primary-500 focus:border-primary-500 text-lg font-bold"
                    />
                  </div>

                  <div className="flex justify-between py-3 border-t border-b border-gray-100 mb-6 text-sm">
                    <span className="text-gray-500 font-medium">Estimated Total</span>
                    <span className="font-extrabold text-gray-900 text-lg">
                      ${(Number(quantity) * selectedStock.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {tradeType === 'BUY' && (Number(quantity) * selectedStock.price) > portfolio.cash && (
                     <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-bold">
                       <AlertCircle size={18} />
                       Insufficient buying power.
                     </div>
                  )}

                  {tradeType === 'SELL' && Number(quantity) > getOwnedQuantity(selectedStock.symbol) && (
                      <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm font-bold">
                        <AlertCircle size={18} />
                        Not enough shares to sell.
                      </div>
                  )}

                  <button
                    onClick={handleExecute}
                    disabled={
                      (tradeType === 'BUY' && (Number(quantity) * selectedStock.price) > portfolio.cash) ||
                      (tradeType === 'SELL' && Number(quantity) > getOwnedQuantity(selectedStock.symbol)) ||
                      Number(quantity) <= 0
                    }
                    className={`w-full py-4 rounded-xl font-extrabold text-white text-lg transition-all ${
                      tradeType === 'BUY' 
                        ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300' 
                        : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                    }`}
                  >
                    Confirm {tradeType}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* Post-Trade Reflection Modal (Existing) */}
       {showReflection && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
             <div className="flex items-center justify-center min-h-full p-4">
                <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <TrendingUp size={32} className="text-green-600" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-900">Trade Executed!</h2>
                        <p className="text-gray-600 font-medium">Take a second to reflect. Why did you make this trade?</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Main Reason</label>
                            <select 
                                className="w-full p-3 bg-blue-50 border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-primary-500 focus:border-primary-500"
                                value={reflectionData.reason}
                                onChange={e => setReflectionData({...reflectionData, reason: e.target.value})}
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
                                onChange={e => setReflectionData({...reflectionData, emotion: e.target.value})}
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
                                placeholder="E.g., Betting on strong earnings..."
                                value={reflectionData.note}
                                onChange={e => setReflectionData({...reflectionData, note: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={handleSaveReflection}
                            className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors"
                        >
                            Save to Diary
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