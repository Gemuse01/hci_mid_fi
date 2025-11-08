import React from 'react';
import { MOCK_NEWS } from '../constants';
import { Newspaper, TrendingUp, TrendingDown, Minus, Clock, Tag } from 'lucide-react';

const News: React.FC = () => {
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <TrendingUp className="text-green-500" size={20} />;
      case 'negative': return <TrendingDown className="text-red-500" size={20} />;
      default: return <Minus className="text-gray-400" size={20} />;
    }
  };

  const getImpactClass = (impact: string) => {
    switch (impact) {
      case 'positive': return 'bg-green-50 text-green-800 border-green-100';
      case 'negative': return 'bg-red-50 text-red-800 border-red-100';
      default: return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Newspaper className="text-primary-600" size={28} />
          Market News & Reports
        </h1>
        <p className="text-gray-600 mt-1">Stay updated with simulated market events affecting your virtual portfolio.</p>
      </div>

      <div className="space-y-6">
        {MOCK_NEWS.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <span className="font-bold text-primary-700">{item.source}</span>
                        <span>•</span>
                        <span className="flex items-center"><Clock size={14} className="mr-1"/> {item.date}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{item.title}</h3>
                </div>
                <div className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 border ${getImpactClass(item.impact)}`}>
                    {getImpactIcon(item.impact)}
                    {item.impact}
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed mb-4">{item.summary}</p>

              <div className="flex items-center gap-2">
                <Tag size={16} className="text-gray-400" />
                <div className="flex flex-wrap gap-2">
                    {item.related_symbols.map(symbol => (
                        <span key={symbol} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md border border-blue-100">
                            ${symbol}
                        </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500">
        <Newspaper size={32} className="mx-auto mb-2 opacity-50" />
        <p className="font-medium">That's all the news for now.</p>
        <p className="text-sm">Check back later for more market updates.</p>
      </div>
    </div>
  );
};

export default News;
