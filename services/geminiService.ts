// services/geminiService.ts
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import {
  UserProfile,
  Portfolio,
  MarketCondition,
  DiaryEntry,
  type NewsImpact,
} from "../types";
import { PERSONA_DETAILS, MOCK_STOCKS } from "../constants";

// ✅ Vite 환경 변수 (프론트에서 쓰는 키)
const apiKey = import.meta.env.VITE_API_KEY as string;
if (!apiKey) {
  console.warn("VITE_API_KEY is missing – Gemini features will not work.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// ✅ 공통 모델 핸들러 (이것만 쓰기)
const defaultModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


/* ------------------------------------------------------------------ */
/*  1) 개별 종목 분석 (기존 기능)                                      */
/* ------------------------------------------------------------------ */
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
    const res = await baseModel().generateContent({
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

/* ------------------------------------------------------------------ */
/*  2) 채팅형 금융 조언 (기존 기능)                                   */
/* ------------------------------------------------------------------ */
export const generateFinancialAdvice = async (
  history: Content[],
  user: UserProfile,
  portfolio: Portfolio
): Promise<string> => {
  const persona = PERSONA_DETAILS[user.persona];
  const holdingsSummary =
    portfolio.assets
      .map(
        (a) => `${a.quantity} shares of ${a.symbol} (Avg: $${a.avg_price.toFixed(2)})`
      )
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
    const res = await baseModel().generateContent({
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

/* ------------------------------------------------------------------ */
/*  3) 매매 일지 피드백 (기존 기능)                                   */
/* ------------------------------------------------------------------ */
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
    const res = await baseModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });
    return (
      res.response.text() ||
      "Good job reflecting on your trade. Consistency is key!"
    );
  } catch (err) {
    console.error("Gemini Diary Feedback Error:", err);
    return "Great job recording your thoughts. Keeping track of these moments is key to long-term improvement!";
  }
};

/* ------------------------------------------------------------------ */
/*  4) 뉴스 임팩트 분류 (버튼 눌렀을 때 호출)                         */
/* ------------------------------------------------------------------ */
function ruleBasedImpactFallback(fullLower: string): NewsImpact {
  // 간단한 가중치 기반 룰
  const positiveWords = [
    "beat expectations",
    "beats expectations",
    "better than expected",
    "surge",
    "rally",
    "record high",
    "raises guidance",
    "raise guidance",
    "upgrade",
    "upgraded",
    "profit",
    "strong results",
    "growth",
    "higher forecast",
    "bullish",
  ];

  const negativeWords = [
    "miss expectations",
    "misses expectations",
    "worse than expected",
    "plunge",
    "selloff",
    "cut guidance",
    "cuts guidance",
    "downgrade",
    "downgraded",
    "loss",
    "lawsuit",
    "regulatory probe",
    "weak results",
    "layoffs",
    "job cuts",
    "bearish",
  ];

  let score = 0;

  for (const w of positiveWords) {
    if (fullLower.includes(w)) score++;
  }
  for (const w of negativeWords) {
    if (fullLower.includes(w)) score--;
  }

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export async function classifyNewsImpact(
  headline: string,
  text: string
): Promise<NewsImpact> {
  const combined = (headline + " " + (text || "")).slice(0, 2000); // 안전하게 자르기

  const prompt = `
You are an equity analyst. Read the following news about a single stock and decide
the SHORT-TERM price impact on that stock.

First, internally think about:
- Is the news fundamentally good or bad for shareholders?
- Does it describe positive catalysts (strong earnings, upgrades, product success),
  or negative events (misses, scandals, downgrades, layoffs, lawsuits)?
- If it's clearly mixed or mostly irrelevant to the stock's fundamentals, treat it as neutral.

At the very end, output ONLY ONE WORD on the last line:
positive
negative
neutral

News headline:
"${headline}"

Details:
"${text || "(no additional text)"}"

Remember: the last line must be exactly one of: positive, negative, neutral.
`.trim();

  try {
    const res = await defaultModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 64 },
    });

    const raw = res.response.text().trim();
    console.debug("[Impact-LLM-raw-text]", raw);

    if (!raw) {
      console.warn("[Impact] Empty LLM answer, using rule-based fallback");
      return ruleBasedImpactFallback(combined.toLowerCase());
    }

    const lower = raw.toLowerCase();

    // 마지막 줄에서 라벨 추출 시도
    const lines = lower.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1] || "";

    const match = lastLine.match(/\b(positive|negative|neutral)\b/);
    if (match) {
      return match[1] as NewsImpact;
    }

    // 혹시 설명만 나오고 라벨이 안 찍힌 경우: 전체 텍스트에서 다시 한 번 찾기
    const anyMatch = lower.match(/\b(positive|negative|neutral)\b/);
    if (anyMatch) {
      return anyMatch[1] as NewsImpact;
    }

    console.warn("[Impact] Could not parse label, using rule-based fallback", {
      headline,
      raw,
    });
    return ruleBasedImpactFallback(combined.toLowerCase());
  } catch (err) {
    console.error("[Impact] Gemini error, using rule-based fallback:", err);
    return ruleBasedImpactFallback(combined.toLowerCase());
  }
}


/* ------------------------------------------------------------------ */
/*  5) 뉴스 요약 (버튼 눌렀을 때 호출)                                */
/* ------------------------------------------------------------------ */
export const summarizeNews = async (
  headline: string,
  originalSummary: string
): Promise<string> => {
  const prompt = `
You are a financial news summarizer.

Given a news headline and a raw summary or lead paragraph,
write a concise explanation in at most 2 sentences (max ~60 words) in English.

Rules:
- Focus on what happened and why it may matter to investors.
- Do NOT give any buy/sell/hold recommendation.
- Do NOT mention that you are an AI or refer to the prompt.

Headline: ${headline}
Raw summary: ${originalSummary}

Now provide your 1–2 sentence summary:
`.trim();

  try {
    const res = await defaultModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 80,
      },
    });

    const text = res.response.text().trim();
    if (!text) return originalSummary;
    return text;
  } catch (err) {
    console.error("Gemini News Summarize Error:", err);
    return originalSummary;
  }
};
