// services/geminiService.ts
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import type { UserProfile, Portfolio, DiaryEntry } from "../types";
import { PERSONA_DETAILS } from "../constants";

/**
 * NOTE
 * - This file is written to NEVER cause infinite loading in UI:
 *   → It always throws errors quickly with a user-readable message.
 * - UI must wrap calls with try/catch/finally and always clear loading in finally.
 */

// Vite: only VITE_* env vars are exposed to client
const apiKey = import.meta.env.VITE_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

function model(name = "gemini-2.5-flash") {
  return genAI.getGenerativeModel({ model: name });
}

/* -----------------------------
 * Utilities
 * ----------------------------- */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Try to parse Gemini "Please retry in XXs." hints.
function parseRetryAfterSeconds(err: any): number | null {
  const msg = String(err?.message || err);
  // "Please retry in 34.78s."
  const m = msg.match(/retry in\s+([0-9.]+)s/i);
  if (!m?.[1]) return null;
  const sec = Number(m[1]);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return Math.ceil(sec);
}

function isRateLimitOrQuota(err: any): boolean {
  const msg = String(err?.message || err);
  const low = msg.toLowerCase();
  return (
    msg.includes("429") ||
    low.includes("quota") ||
    low.includes("rate limit") ||
    low.includes("rate-limit") ||
    low.includes("too many requests")
  );
}

function isOverloadedOrTransient(err: any): boolean {
  const msg = String(err?.message || err);
  const low = msg.toLowerCase();
  return (
    msg.includes("503") ||
    low.includes("overloaded") ||
    low.includes("timeout") ||
    low.includes("network") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("504")
  );
}

/**
 * Normalize errors to a message your UI can show.
 * IMPORTANT: We intentionally keep "429" in the message so UI can detect it.
 */
function toUserFacingError(err: any): Error {
  const msg = String(err?.message || err);

  // If Gemini tells you retry time, keep it.
  if (isRateLimitOrQuota(err)) {
    const sec = parseRetryAfterSeconds(err) ?? 60;
    return new Error(`429: Rate limited. Please retry in ${sec}s.`);
  }

  if (isOverloadedOrTransient(err)) {
    return new Error("503: The AI service is temporarily overloaded. Please try again soon.");
  }

  // Unknown
  return new Error(`AI_ERROR: ${msg}`);
}

function looksCutOff(text: string, minChars = 80) {
  const t = (text || "").trim();
  if (!t) return true;
  if (t.length < minChars) return true;
  // if it doesn't end like a finished sentence, might be cut off
  if (!/[.!?]["')\]]?$/.test(t)) return true;
  return false;
}

/* -----------------------------
 * Core generator with safe retry
 * ----------------------------- */
async function generateWithRetry(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number; maxRetries?: number }
): Promise<string> {
  const maxOutputTokens = opts?.maxTokens ?? 320;
  const temperature = opts?.temperature ?? 0.6;

  // Keep retries LOW to avoid burning quota (and triggering more 429s).
  const maxRetries = opts?.maxRetries ?? 1; // 0 or 1 is usually best on client

  let lastErr: any = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await model("gemini-2.5-flash").generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      });

      const text = (res.response.text() || "").trim();
      if (!text) throw new Error("Empty model response.");
      return text;
    } catch (err) {
      lastErr = err;

      // If rate-limited, do NOT keep retrying many times.
      if (isRateLimitOrQuota(err)) {
        // Optional: wait a tiny bit once, but don't loop.
        if (i < maxRetries) {
          const sec = parseRetryAfterSeconds(err);
          const waitMs = sec ? Math.min(sec * 1000, 1200) : 600;
          await sleep(waitMs);
          continue;
        }
        throw toUserFacingError(err);
      }

      // transient overload: allow small backoff retry
      if (isOverloadedOrTransient(err) && i < maxRetries) {
        await sleep(450 + i * 250);
        continue;
      }

      throw toUserFacingError(err);
    }
  }

  throw toUserFacingError(lastErr);
}

/* -----------------------------
 * Public APIs
 * ----------------------------- */

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
    const res = await model("gemini-2.5-flash").generateContent({
      contents: history ?? [],
      systemInstruction,
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    });
    const text = (res.response.text() || "").trim();
    if (!text) throw new Error("Empty model response.");
    return text;
  } catch (err) {
    // IMPORTANT: Throw so UI can stop loading and show a message
    throw toUserFacingError(err);
  }
};

export const generateDiaryFeedback = async (
  entry: DiaryEntry,
  user: UserProfile,
  recentTxs: any[] = [],
  recentDiaryLite: any[] = []
): Promise<string> => {
  const persona = PERSONA_DETAILS[user.persona];

  // Keep context small to reduce token usage (less likely to hit quota)
  const compactTxs = (recentTxs || []).slice(0, 12);
  const compactDiary = (recentDiaryLite || []).slice(0, 8);

  const basePrompt = `
You are a practical trading coach speaking directly to the user.
Write in a supportive, realistic tone. No price predictions. No buy/sell calls.

Style rules:
- Use 2nd person ("you").
- Exactly 4 sentences, under 90 words total.
- No bullet points.
- End the final sentence with a period.

Context:
Persona: ${persona.label}
Emotion: ${entry.emotion}
Driver: ${entry.reason}
Ticker: ${entry.related_symbol || "N/A"}
Note: "${(entry.note || "").slice(0, 800)}"
Recent transactions (latest first): ${JSON.stringify(compactTxs)}
Recent diary patterns: ${JSON.stringify(compactDiary)}
`.trim();

  try {
    // ✅ maxRetries=1 (kept low to avoid quota burn)
    let text = await generateWithRetry(basePrompt, { maxTokens: 220, temperature: 0.6, maxRetries: 1 });

    // If looks cut off, ONE rewrite attempt (still maxRetries=1 inside)
    if (looksCutOff(text, 70)) {
      const rewritePrompt =
        basePrompt +
        `

Your previous answer was cut off or too short.
Rewrite fully as exactly 4 complete sentences, under 90 words, and end with a period.
`.trim();

      text = await generateWithRetry(rewritePrompt, { maxTokens: 240, temperature: 0.6, maxRetries: 1 });
    }

    const out = (text || "").trim();
    if (!out) throw new Error("Empty model response.");
    return out;
  } catch (err) {
    // IMPORTANT: Throw so Diary.tsx can stop spinner in finally (no infinite loading)
    throw toUserFacingError(err);
  }
};
