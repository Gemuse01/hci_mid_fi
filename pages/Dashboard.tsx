import React, { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, PieChart, Activity, ArrowRight, Wallet, History, BookOpen, Clock, X, Lightbulb, GraduationCap, CheckCircle2, XCircle } from 'lucide-react';
import { MOCK_DAILY_ADVICE, MOCK_STOCKS, MOCK_DAILY_QUIZ } from '../constants';
import ReactMarkdown from 'react-markdown';

const LEARNING_CARDS = [
  {
    id: 1,
    title: "What is Volatility?",
    duration: "3 min",
    category: "Basic Term",
    content: "**Volatility** is a statistical measure of the dispersion of returns for a given security or market index. \n\nIn simpler terms, it represents how much the price of an asset swings around the mean price. High volatility means the price can change dramatically over a short time period in either direction. Lower volatility means a security's value does not fluctuate dramatically, and tends to be more steady."
  },
  {
    id: 2,
    title: "Bull vs. Bear Markets",
    duration: "4 min",
    category: "Market Concepts",
    content: "A **Bull Market** is a market that is on the rise and where the economy is sound; while a **Bear Market** exists in an economy that is receding, where most stocks are declining in value. \n\nInvestors typically want to buy when they expect a bull market and sell when they expect a bear market, though timing this exactly is very difficult."
  },
  {
    id: 3,
    title: "The Power of Diversification",
    duration: "5 min",
    category: "Strategy",
    content: "**Diversification** is a risk management strategy that mixes a wide variety of investments within a portfolio. \n\nThe rationale behind this technique is that a portfolio constructed of different kinds of assets will, on average, yield higher long-term returns and lower the risk of any individual holding or security."
  }
];

const Dashboard: React.FC = () => {
  const { user, portfolio, transactions, marketCondition } = useApp();
  const [selectedCard, setSelectedCard] = useState<typeof LEARNING_CARDS[0] | null>(null);
  
  // Quiz State
  const [quizState, setQuizState] = useState<{ answered: boolean; selectedIndex: number | null; isCorrect: boolean }>({
    answered: false,
    selectedIndex: null,
    isCorrect: false
  });

  // Calculate current total portfolio value
  const currentHoldingsValue = useMemo(() => {
    return portfolio.assets.reduce((sum, asset) => {
      const currentPrice = MOCK_STOCKS.find(s => s.symbol === asset.symbol)?.price || asset.avg_price;
      return sum + (asset.quantity * currentPrice);
    }, 0);
  }, [portfolio.assets]);

  const totalValue = portfolio.cash + currentHoldingsValue;
  const initialValue = user.initial_capital;
  const totalReturn = totalValue - initialValue;
  const totalReturnPct = (totalReturn / initialValue) * 100;

  const dailyAdvice = useMemo(() => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return MOCK_DAILY_ADVICE[dayOfYear % MOCK_DAILY_ADVICE.length];
  }, []);

  const handleQuizAnswer = (index: number) => {
    if (quizState.answered) return;
    setQuizState({
      answered: true,
      selectedIndex: index,
      isCorrect: index === MOCK_DAILY_QUIZ.correctIndex
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome & Daily Tip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome back, {user.name} 👋</h1>
          <p className="text-gray-600 mt-1">Here's your {user.goal} portfolio overview.</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-start max-w-md shadow-sm">
           <Lightbulb className="text-indigo-600 shrink-0 mr-3" size={24} />
           <p className="text-sm text-indigo-900 font-medium leading-relaxed">{dailyAdvice}</p>
        </div>
      </div>

      {/* Key Metrics - Responsive Font Sizing Applied */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Value Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Net Worth</h3>
            <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
              <PieChart size={20} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-2">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className={`flex items-center text-sm font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalReturn >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
            <span>{totalReturn >= 0 ? '+' : ''}{totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({totalReturnPct.toFixed(2)}%)</span>
            <span className="text-gray-400 font-medium ml-2">all time</span>
          </div>
        </div>

        {/* Cash Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
           <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Available Cash</h3>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Wallet size={20} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-2">
            ${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center text-sm font-medium text-gray-500">
             <span>Ready to deploy</span>
          </div>
        </div>

        {/* Market Status Card */}
        <div className={`p-6 rounded-2xl shadow-sm border ${marketCondition === 'BULL' ? 'bg-green-50 border-green-100' : marketCondition === 'BEAR' ? 'bg-orange-50 border-orange-100' : marketCondition === 'CRASH' ? 'bg-red-50 border-red-100' : marketCondition === 'LIVE' ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'}`}>
           <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold uppercase tracking-wider ${marketCondition === 'BULL' ? 'text-green-800' : marketCondition === 'BEAR' ? 'text-orange-800' : marketCondition === 'CRASH' ? 'text-red-800' : marketCondition === 'LIVE' ? 'text-purple-800' : 'text-blue-800'}`}>Market Condition</h3>
            <div className={`p-2 rounded-lg ${marketCondition === 'BULL' ? 'bg-green-100 text-green-800' : marketCondition === 'BEAR' ? 'bg-orange-100 text-orange-800' : marketCondition === 'CRASH' ? 'bg-red-100 text-red-800' : marketCondition === 'LIVE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
              <Activity size={20} />
            </div>
          </div>
          <p className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-2 ${marketCondition === 'BULL' ? 'text-green-900' : marketCondition === 'BEAR' ? 'text-orange-900' : marketCondition === 'CRASH' ? 'text-red-900' : marketCondition === 'LIVE' ? 'text-purple-900' : 'text-blue-900'}`}>
            {marketCondition}
          </p>
          <div className={`flex items-center text-sm font-medium ${marketCondition === 'BULL' ? 'text-green-700' : marketCondition === 'BEAR' ? 'text-orange-700' : marketCondition === 'CRASH' ? 'text-red-700' : marketCondition === 'LIVE' ? 'text-purple-700' : 'text-blue-700'}`}>
             <span>Simulated Environment</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Learning & Quiz Column */}
        <div className="lg:col-span-3 space-y-6">
           {/* Daily 5-Minute Learning Section */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
              <BookOpen className="text-primary-600" size={24} />
              Daily 5-Minute Learning
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {LEARNING_CARDS.map(card => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-primary-300 transition-all text-left group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-md uppercase tracking-wider group-hover:bg-primary-100 transition-colors">
                      {card.category}
                    </span>
                    <div className="flex items-center text-xs font-medium text-gray-400">
                      <Clock size={14} className="mr-1" />
                      {card.duration}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors">{card.title}</h3>
                </button>
              ))}
            </div>
          </div>

          {/* Daily Quiz Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-indigo-500 to-primary-600 text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Daily Financial Quiz</h2>
                <p className="text-indigo-100 text-sm">Test your knowledge with today's question!</p>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{MOCK_DAILY_QUIZ.question}</h3>
              <div className="space-y-3">
                {MOCK_DAILY_QUIZ.options.map((option, index) => {
                  let btnClass = "w-full text-left p-4 rounded-xl border-2 font-medium transition-all ";
                  if (!quizState.answered) {
                    btnClass += "border-gray-200 hover:border-primary-500 hover:bg-primary-50 text-gray-700";
                  } else {
                    if (index === MOCK_DAILY_QUIZ.correctIndex) {
                       btnClass += "border-green-500 bg-green-50 text-green-800 font-bold";
                    } else if (quizState.selectedIndex === index) {
                       btnClass += "border-red-300 bg-red-50 text-red-800 opacity-70";
                    } else {
                       btnClass += "border-gray-100 text-gray-400 opacity-50 cursor-not-allowed";
                    }
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleQuizAnswer(index)}
                      disabled={quizState.answered}
                      className={btnClass}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {quizState.answered && index === MOCK_DAILY_QUIZ.correctIndex && <CheckCircle2 className="text-green-600 shrink-0 ml-2" size={20} />}
                        {quizState.answered && quizState.selectedIndex === index && index !== MOCK_DAILY_QUIZ.correctIndex && <XCircle className="text-red-500 shrink-0 ml-2" size={20} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quiz Explanation */}
              {quizState.answered && (
                <div className={`mt-6 p-4 rounded-xl animate-in fade-in slide-in-from-top-2 ${quizState.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-indigo-50 border border-indigo-100'}`}>
                  <p className={`font-bold mb-1 ${quizState.isCorrect ? 'text-green-800' : 'text-indigo-800'}`}>
                    {quizState.isCorrect ? '🎉 Correct!' : '💡 Learning Opportunity'}
                  </p>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {MOCK_DAILY_QUIZ.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[300px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Current Holdings</h2>
            <Link to="/trading" className="text-primary-600 text-sm font-bold hover:underline flex items-center">
              Trade <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            {portfolio.assets.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                  <PieChart size={32} className="text-gray-300" />
                </div>
                <p className="font-medium mb-4">Your portfolio is currently empty.</p>
                <Link to="/trading" className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-sm">
                  Make your first trade
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Asset</th>
                    <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Cost</th>
                    <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Current</th>
                    <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {portfolio.assets.map(asset => {
                    const currentPrice = MOCK_STOCKS.find(s => s.symbol === asset.symbol)?.price || 0;
                    const marketValue = asset.quantity * currentPrice;
                    const costBasis = asset.quantity * asset.avg_price;
                    const gainLoss = marketValue - costBasis;
                    const gainLossPct = (gainLoss / costBasis) * 100;

                    return (
                      <tr key={asset.symbol} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-gray-900">{asset.symbol}</div>
                        </td>
                        <td className="py-4 px-6 text-right font-medium text-gray-700">
                          {asset.quantity}
                        </td>
                        <td className="py-4 px-6 text-right text-gray-600">
                          ${asset.avg_price.toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-gray-900">
                          ${currentPrice.toFixed(2)}
                        </td>
                         <td className={`py-4 px-6 text-right font-bold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {gainLoss >= 0 ? '+' : ''}{gainLossPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[500px]">
           <div className="p-6 border-b border-gray-100 flex items-center gap-2 shrink-0">
             <History className="text-gray-400" size={20} />
             <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
           </div>
           <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
             {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 italic py-6">
                  <History size={32} className="mb-2 opacity-50" />
                  <p>No transactions yet.</p>
                </div>
             ) : (
               transactions.slice(0, 10).map(tx => (
                 <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${tx.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tx.type === 'BUY' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{tx.type === 'BUY' ? 'Bought' : 'Sold'} {tx.symbol}</p>
                        <p className="text-xs text-gray-500 font-medium">{new Date(tx.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{tx.quantity} @ ${tx.price.toFixed(2)}</p>
                      <p className="text-xs font-medium text-gray-500">${(tx.quantity * tx.price).toFixed(2)} total</p>
                    </div>
                 </div>
               ))
             )}
           </div>
        </div>
      </div>

      {/* Learning Card Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-full p-4 text-center">
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedCard(null)} />
            <div className="relative bg-white rounded-2xl max-w-md w-full p-6 text-left shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                 <div>
                   <span className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-md uppercase tracking-wider mb-2 inline-block">
                      {selectedCard.category}
                    </span>
                   <h3 className="text-2xl font-extrabold text-gray-900">{selectedCard.title}</h3>
                 </div>
                 <button onClick={() => setSelectedCard(null)} className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors">
                    <X size={24} />
                  </button>
              </div>
              <div className="prose prose-sm prose-indigo max-w-none text-gray-700">
                 <ReactMarkdown>{selectedCard.content}</ReactMarkdown>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                 <div className="flex items-center text-sm font-medium text-gray-500">
                  <Clock size={16} className="mr-1" />
                  {selectedCard.duration} read
                </div>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
