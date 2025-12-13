// services/geminiService.ts
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { UserProfile, Portfolio, MarketCondition, DiaryEntry } from "../types";
import { PERSONA_DETAILS, MOCK_STOCKS } from "../constants";

// Vite: 공개 환경변수는 VITE_* 만 주입됨 (데모/수업용)
// 배포 전 .env.local 과 Vercel 환경변수에 VITE_API_KEY를 설정하세요.
const apiKey = import.meta.env.VITE_API_KEY as string;
const hasApiKey = apiKey && apiKey.trim().length > 0;
const genAI = hasApiKey ? new GoogleGenerativeAI(apiKey) : null;

// 외부 감성분석 API (mlapi.run) 설정 - OpenAI 호환 프록시
// 기본 예시: base_url = "https://mlapi.run/abc-1234-xyz/v1"
const mlapiBaseUrl =
  (import.meta.env.VITE_MLAPI_BASE_URL as string | undefined) ||
  "https://mlapi.run/abc-1234-xyz/v1";
const SENTIMENT_API_URL = `${mlapiBaseUrl}/chat/completions`;
// 실제 키는 .env.local 에 VITE_SENTIMENT_API_KEY 로 저장 (교수님이 주신 커스텀 API KEY / JWT)
const sentimentApiKey = import.meta.env
  .VITE_SENTIMENT_API_KEY as string | undefined;

// 공통: 단일/대화 모델 핸들러
function model(name = "gemini-pro") {
  if (!genAI) {
    throw new Error("Gemini API key is not configured. Please set VITE_API_KEY in .env.local");
  }
  return genAI.getGenerativeModel({ model: name });
}

// 감성 분석 전용 모델 (별도로 분리하여 다른 기능에 영향 없도록)
function sentimentModel() {
  if (!genAI) {
    throw new Error(
      "Gemini API key is not configured. Please set VITE_API_KEY in .env.local"
    );
  }
  // 감성 분석 전용으로 gemini-pro 사용 (안정적)
  return genAI.getGenerativeModel({ model: "gemini-pro" });
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

type Sentiment = "positive" | "negative" | "neutral";

// 기존 규칙 기반 감성분석 로직을 헬퍼로 분리 (외부 API 실패 시 fallback)
function ruleBasedNewsSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();

  const positiveKeywords = [
    "surge",
    "soar",
    "rally",
    "jump",
    "spike",
    "record high",
    "all-time high",
    "beat expectations",
    "beats expectations",
    "beat estimates",
    "beats estimates",
    "strong growth",
    "strong demand",
    "solid growth",
    "better than expected",
    "raises guidance",
    "hikes guidance",
    "upgrade",
    "upgraded",
    "buy rating",
    "outperform",
    "overweight",
    "bullish",
    "profit surge",
    "rebound",
    "recovery",
    "top gainer",
    "optimistic",
    "beats on earnings",
    "strong quarter",
    "to buy",
    "worth buying",
    "buy now",
    "top pick",
    "could double",
    "multi-bagger",
  ];

  const negativeKeywords = [
    "plunge",
    "plunges",
    "slump",
    "slumps",
    "tumble",
    "tumbles",
    "fall",
    "falls",
    "drop",
    "drops",
    "sink",
    "sinks",
    "tank",
    "tanks",
    "crash",
    "crashes",
    "miss expectations",
    "misses expectations",
    "miss estimates",
    "misses estimates",
    "weak demand",
    "slowdown",
    "decline",
    "loss",
    "losses",
    "cut guidance",
    "cuts guidance",
    "downgrade",
    "downgraded",
    "underperform",
    "miss",
    "warning",
    "profit warning",
    "lawsuit",
    "scandal",
    "probe",
    "investigation",
    "regulatory",
    "fine",
    "penalty",
    "layoffs",
    "job cuts",
    "bankruptcy",
    "concern",
    "headwind",
  ];

  let score = 0;

  for (const kw of positiveKeywords) {
    if (lower.includes(kw)) score += 1;
  }

  for (const kw of negativeKeywords) {
    if (lower.includes(kw)) score -= 1;
  }

  if (
    lower.includes("up") ||
    lower.includes("higher") ||
    lower.includes("gain") ||
    lower.includes("rise")
  ) {
    score += 0.5;
  }
  if (
    lower.includes("down") ||
    lower.includes("lower") ||
    lower.includes("drop") ||
    lower.includes("fall")
  ) {
    score -= 0.5;
  }

  console.log(
    "[Sentiment] Rule-based score:",
    score,
    "for text:",
    lower.substring(0, 160)
  );

  if (score >= 0.5) return "positive";
  if (score <= -0.5) return "negative";
  return "neutral";
}

// mlapi.run 응답(또는 LLM 출력 텍스트)에서 sentiment 라벨 뽑아내기
function parseSentimentFromApiResponse(data: any): Sentiment | null {
  if (!data) return null;

  const candidates: string[] = [];

  if (typeof data === "string") {
    candidates.push(data);
  }
  if (typeof data.label === "string") {
    candidates.push(data.label);
  }
  if (typeof (data as any).sentiment === "string") {
    candidates.push((data as any).sentiment);
  }
  if (typeof (data as any).result === "string") {
    candidates.push((data as any).result);
  }

  // {"positive":0.8,"negative":0.1,"neutral":0.1} 형태
  const probKeys = ["positive", "negative", "neutral"] as const;
  if (probKeys.every((k) => typeof (data as any)[k] === "number")) {
    const best = probKeys.reduce((prev, cur) =>
      (data as any)[cur] > (data as any)[prev] ? cur : prev
    );
    return best;
  }

  // HF-style: [{label:"POSITIVE", score:0.98}, ...]
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === "string") {
      candidates.push(first);
    } else if (first && typeof first.label === "string") {
      let best = first;
      if (typeof first.score === "number") {
        best = data.reduce(
          (acc: any, cur: any) =>
            typeof cur.score === "number" && cur.score > acc.score ? cur : acc,
          first
        );
      }
      candidates.push(best.label);
    }
  }

  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // 영어 단어가 그대로 온 경우 (가장 우선)
    if (lower === "positive") return "positive";
    if (lower === "negative") return "negative";
    if (lower === "neutral") return "neutral";

    // 한국어 단어 매핑
    if (lower.includes("긍정")) return "positive";
    if (lower.includes("부정")) return "negative";
    if (lower.includes("중립")) return "neutral";

    // 기존 휴리스틱 (POS / NEG / NEU 등)
    if (lower.includes("pos")) return "positive";
    if (lower.includes("neg")) return "negative";
    if (lower.includes("neu") || lower.includes("neutral")) return "neutral";
  }

  return null;
}

// 뉴스 감성분석: mlapi.run 호출 + 실패 시 규칙 기반 fallback
export const analyzeNewsSentiment = async (
  title: string,
  summary: string,
  relatedSymbols: string[]
): Promise<Sentiment> => {
  const text = `${title} ${summary}`.trim();

  // 키가 없으면 LLM 호출을 생략하고 안전한 기본값(neutral) 사용
  if (!sentimentApiKey) {
    console.warn(
      "[Sentiment] VITE_SENTIMENT_API_KEY not set. Falling back to neutral sentiment."
    );
    return "neutral";
  }

  try {
    // OpenAI 호환 프록시 엔드포인트 (/v1/chat/completions)
    const res = await fetch(SENTIMENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sentimentApiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-nano",
        messages: [
          {
            role: "system",
            content:
              "You are a financial news sentiment classifier. " +
              "Read the news headline and summary and respond ONLY with a single JSON object, no extra text. " +
              'The JSON must have exactly one field: {"sentiment": "<label>"}, ' +
              'where <label> is one of: "positive", "negative", or "neutral" (lowercase).',
          },
          {
            role: "user",
            content: `Title: ${title}\n\nSummary: ${summary}\n\nRelated symbols: ${
              relatedSymbols && relatedSymbols.length > 0
                ? relatedSymbols.join(", ")
                : "N/A"
            }`,
          },
        ],
        // GPT-5 nano 프록시는 temperature=1 (기본값)만 지원하므로 명시하지 않음
        // GPT-5 nano 프록시는 max_tokens 대신 max_completion_tokens 를 사용
        max_completion_tokens: 10,
      }),
    });

    if (!res.ok) {
      // 서버에서 내려주는 에러 메시지까지 같이 로깅해서 디버깅에 활용
      const errorBody = await res.text().catch(() => "");
      console.error(
        "[Sentiment] API error response:",
        res.status,
        errorBody || "<empty body>"
      );
      throw new Error(`Sentiment API HTTP error: ${res.status}`);
    }

    const data = await res.json();
    console.log("[Sentiment] API raw response:", data);

    // OpenAI 응답 형태 (신규 스펙): message.content 가 문자열 또는 content 파트 배열일 수 있음
    let content: string | undefined;
    const firstChoice = data?.choices?.[0];
    const message = firstChoice?.message ?? firstChoice?.delta;

    if (!message) {
      // message 구조를 디버깅하기 위한 로그 (1회용으로 생각)
      try {
        console.log(
          "[Sentiment] First choice (no message field found):",
          JSON.stringify(firstChoice, null, 2)
        );
      } catch {
        console.log("[Sentiment] First choice (raw):", firstChoice);
      }
    }

    if (message) {
      const rawContent = message.content;
      if (typeof rawContent === "string") {
        content = rawContent;
      } else if (Array.isArray(rawContent)) {
        // [{type:"text", text:{value:"positive", ...}}, ...] 등의 형태를 문자열로 병합
        const textParts = rawContent
          .map((part: any) => {
            if (!part) return "";
            if (typeof part === "string") return part;
            if (typeof part.text === "string") return part.text;
            if (part.type === "text" && part.text && typeof part.text.value === "string") {
              return part.text.value;
            }
            return "";
          })
          .join(" ")
          .trim();
        if (textParts) {
          content = textParts;
        }
      }
    }

    if (typeof content === "string" && content.trim().length > 0) {
      const trimmed = content.trim();
      console.log("[Sentiment] Model content:", trimmed);

      // 1차 시도: JSON 으로 파싱해서 sentiment 필드 읽기
      try {
        const jsonPayload = JSON.parse(trimmed);
        const parsedFromJson = parseSentimentFromApiResponse(jsonPayload);
        if (parsedFromJson) {
          return parsedFromJson;
        }
      } catch {
        // JSON 이 아니면 아래 일반 문자열 파싱으로 진행
      }

      // 2차 시도: 문자열 자체에서 라벨 추출
      const parsedFromText = parseSentimentFromApiResponse(trimmed);
      if (parsedFromText) {
        return parsedFromText;
      }
    }

    console.warn(
      "[Sentiment] Could not parse sentiment from API response. Falling back to neutral."
    );
    // 파싱 실패 시에도 사용자 경험을 위해 중립으로 처리
    return "neutral";
  } catch (err) {
    console.error(
      "[Sentiment] External API error, using neutral fallback:",
      err
    );
    // 외부 API 오류 시에도 neutral 로 고정
    return "neutral";
  }
};
