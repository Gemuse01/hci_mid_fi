// services/geminiService.ts
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { UserProfile, Portfolio, MarketCondition, DiaryEntry } from "../types";
import { PERSONA_DETAILS, MOCK_STOCKS } from "../constants";

// Vite: 공개 환경변수는 VITE_* 만 주입됨 (데모/수업용)
// 배포 전 .env.local 과 Vercel 환경변수에 VITE_API_KEY를 설정하세요.
const apiKey = import.meta.env.VITE_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

// 공통: 단일/대화 모델 핸들러
function model(name = "gemini-2.5-flash") {
  return genAI.getGenerativeModel({ model: name });
}

export const getStockAnalysis = async (
  symbol: string,
  marketCondition: MarketCondition,
  riskTolerance: string
): Promise<string> => {
  const stock = MOCK_STOCKS.find((s) => s.symbol === symbol);
  const stockName = stock ? stock.name : symbol;

  const prompt = `
Act as a senior financial analyst. Give a concise 3-bullet analysis of ${stockName} (${symbol})
for an investor with ${riskTolerance} risk tolerance.

Current simulated market: ${marketCondition}.
Stock details: Sector: ${stock?.sector}, Volatility: ${stock?.volatility}, Recent Change: ${stock?.change_pct}%.
Format exactly:
**Snapshot**: [one sentence]
• **Strength**: [...]
• **Risk**: [...]
• **Verdict**: [Buy/Hold/Sell]
`.trim();

  try {
    const res = await model().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });
    return res.response.text();
  } catch (err) {
    console.error("Gemini Analysis Error:", err);
    return `**Snapshot**: ${stockName} shows mixed signals in a ${marketCondition.toLowerCase()} market.
• **Strength**: Solid historical performance within its sector.
• **Risk**: Short-term volatility remains elevated.
• **Verdict**: HOLD for now and monitor closely.`;
  }
};

export const generateFinancialAdvice = async (
  history: Content[],
  user: UserProfile,
  portfolio: Portfolio
): Promise<string> => {
  const persona = PERSONA_DETAILS[user.persona];
  const holdingsSummary =
    portfolio.assets
      .map((a) => `${a.quantity} shares of ${a.symbol} (Avg: $${a.avg_price.toFixed(2)})`)
      .join(", ") || "No current holdings";

  const systemInstruction = `
You are FinGuide, an AI financial mentor.
Persona: ${persona.label} (${persona.description})
Goal: ${user.goal}
Risk Tolerance: ${user.risk_tolerance}
Portfolio: Cash $${portfolio.cash.toFixed(2)}, Holdings [${holdingsSummary}]
Tone: ${persona.advice}
Keep responses concise, encouraging, and educational. No direct "buy now" advice; present options to consider.
`.trim();

  try {
    const res = await model().generateContent({
      contents: history ?? [],
      systemInstruction,
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    });
    return res.response.text();
  } catch (err) {
    console.error("Gemini Chat Error:", err);
    return "I'm having trouble reaching the model right now. Please try again in a moment.";
  }
};

export const generateDiaryFeedback = async (
  entry: DiaryEntry,
  user: UserProfile
): Promise<string> => {
  const persona = PERSONA_DETAILS[user.persona];

  const prompt = `
As a trading psychology coach, give brief (2–3 sentences) feedback.

Persona: ${persona.label}
Emotion: ${entry.emotion}
Driver: ${entry.reason}
Note: "${entry.note}"

Goal: Help them spot patterns (FOMO, revenge trading, or good discipline). Be encouraging and insightful.
`.trim();

  try {
    const res = await model().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });
    return res.response.text() || "Good job reflecting on your trade. Consistency is key!";
  } catch (err) {
    console.error("Gemini Diary Feedback Error:", err);
    return "Great job recording your thoughts. Keeping track of these moments is key to long-term improvement!";
  }
};
