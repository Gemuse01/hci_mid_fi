import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { EMOTION_OPTIONS, REASON_OPTIONS } from '../constants';
import { generateDiaryFeedback } from '../services/geminiService';
import { BookHeart, Plus, X, SmilePlus, Frown, Meh, LineChart, Newspaper, MessageCircle, Zap, Sparkles, Loader2 } from 'lucide-react';

const Diary: React.FC = () => {
  const { user, diary, addDiaryEntry, updateDiaryEntry } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({
    emotion: 'neutral',
    reason: 'analysis',
    note: '',
    related_symbol: ''
  });

  const handleSave = async () => {
    if (!newEntry.note.trim()) return;
    
    // 1. Add entry immediately for UI responsiveness
    const newId = addDiaryEntry({
      emotion: newEntry.emotion as any,
      reason: newEntry.reason as any,
      note: newEntry.note,
      related_symbol: newEntry.related_symbol.toUpperCase() || undefined
    });

    // Reset form and close modal
    setNewEntry({ emotion: 'neutral', reason: 'analysis', note: '', related_symbol: '' });
    setIsAdding(false);

    // 2. Trigger AI feedback generation in background
    setGeneratingId(newId);
    try {
        // Re-construct entry object for the API call
        const entryForAi = {
            id: newId,
            date: new Date().toISOString(),
            emotion: newEntry.emotion as any,
            reason: newEntry.reason as any,
            note: newEntry.note,
            related_symbol: newEntry.related_symbol.toUpperCase() || undefined
        };
        const feedback = await generateDiaryFeedback(entryForAi, user);
        updateDiaryEntry(newId, { aiFeedback: feedback });
    } catch (error) {
        console.error("Failed to generate feedback immediately:", error);
        updateDiaryEntry(newId, { aiFeedback: "Couldn't generate feedback at this moment. Keep reflecting!" });
    } finally {
        setGeneratingId(null);
    }
  };

  const getEmotionIcon = (emotion: string) => {
    switch (emotion) {
      case 'confident': return <SmilePlus className="text-blue-500" />;
      case 'excited': return <SmilePlus className="text-green-500" />;
      case 'anxious': return <Frown className="text-yellow-500" />;
      case 'regretful': return <Frown className="text-red-500" />;
      default: return <Meh className="text-gray-500" />;
    }
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'news': return <Newspaper size={16} />;
      case 'analysis': return <LineChart size={16} />;
      case 'recommendation': return <MessageCircle size={16} />;
      case 'impulse': return <Zap size={16} />;
      default: return <LineChart size={16} />;
    }
  };

  const getReasonLabel = (val: string) => REASON_OPTIONS.find(o => o.value === val)?.label || val;
  const getEmotionLabel = (val: string) => EMOTION_OPTIONS.find(o => o.value === val)?.label || val;
  const getEmotionColor = (val: string) => EMOTION_OPTIONS.find(o => o.value === val)?.color || 'bg-gray-100 text-gray-800';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <BookHeart className="text-primary-600" />
            Investment Diary
          </h1>
          <p className="text-gray-600">Track your emotional state and reasoning behind every decision.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-bold shadow-md shadow-primary-200 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Plus size={20} strokeWidth={2.5} /> New Entry
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
           <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
              <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsAdding(false)} />
              <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white px-6 py-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-extrabold text-gray-900">New Journal Entry</h3>
                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-full">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">How are you feeling?</label>
                        <div className="flex flex-wrap gap-2">
                            {EMOTION_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setNewEntry({ ...newEntry, emotion: opt.value })}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${newEntry.emotion === opt.value ? `${opt.color} ring-2 ring-offset-1 ring-primary-300 border-transparent` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-900 mb-2">Primary Driver</label>
                          <select
                              value={newEntry.reason}
                              onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                              className="block w-full border-gray-300 rounded-xl py-3 px-4 focus:ring-primary-500 focus:border-primary-500 bg-gray-50 text-gray-900 font-medium"
                          >
                              {REASON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-900 mb-2">Ticker (Optional)</label>
                          <input
                              type="text"
                              value={newEntry.related_symbol}
                              onChange={(e) => setNewEntry({ ...newEntry, related_symbol: e.target.value })}
                              placeholder="e.g. AAPL"
                              className="block w-full border-gray-300 rounded-xl py-3 px-4 focus:ring-primary-500 focus:border-primary-500 bg-gray-50 text-gray-900 font-bold uppercase placeholder:text-gray-400 placeholder:normal-case placeholder:font-normal"
                          />
                      </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">Your Thoughts</label>
                        <textarea
                            rows={4}
                            value={newEntry.note}
                            onChange={(e) => setNewEntry({ ...newEntry, note: e.target.value })}
                            placeholder="What's on your mind? Why did you make this decision? What did you learn?"
                            className="block w-full border-gray-300 rounded-xl py-3 px-4 focus:ring-primary-500 focus:border-primary-500 bg-gray-50 text-gray-900 placeholder-gray-400"
                        />
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={!newEntry.note.trim()}
                      className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:scale-100 text-lg"
                    >
                      Save Entry
                    </button>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      <div className="space-y-6">
        {diary.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-gray-100 border-dashed flex flex-col items-center">
            <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <BookHeart size={48} className="text-primary-300" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-3">Your diary is empty</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-8 text-lg">Keeping a record of your emotions helps you identify patterns and improve your decision-making over time.</p>
            <button 
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary-200 hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
            >
                <Plus size={24} strokeWidth={3} /> Write First Entry
            </button>
          </div>
        ) : (
          diary.map(entry => (
            <div key={entry.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${getEmotionColor(entry.emotion)}`}>
                    {getEmotionIcon(entry.emotion)}
                    {getEmotionLabel(entry.emotion).split(' ')[1] || getEmotionLabel(entry.emotion)}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold flex items-center gap-1.5 border border-gray-200">
                    {getReasonIcon(entry.reason)}
                    {getReasonLabel(entry.reason).split(' ')[1] || getReasonLabel(entry.reason)}
                  </span>
                   {entry.related_symbol && (
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                      ${entry.related_symbol}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                  {new Date(entry.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone:'Asia/Seoul' })}
                </span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed mb-4">{entry.note}</p>
              
              {/* AI Coach Feedback Section */}
              {(entry.aiFeedback || generatingId === entry.id) && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in duration-500">
                    <div className="flex items-start gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div className="p-2 bg-white rounded-full border border-indigo-100 shrink-0">
                            {generatingId === entry.id ? (
                                <Loader2 size={18} className="text-indigo-500 animate-spin" />
                            ) : (
                                <Sparkles size={18} className="text-indigo-600" />
                            )}
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-indigo-950 mb-1">AI Coach Insight</h4>
                            {generatingId === entry.id ? (
                                <p className="text-sm text-indigo-700 animate-pulse font-medium">Analyzing your entry...</p>
                            ) : (
                                <p className="text-sm text-indigo-900 leading-relaxed font-medium">{entry.aiFeedback}</p>
                            )}
                        </div>
                    </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Diary;