// api/security-chat.ts
// Proxy endpoint for "Security Mode" AI mentor.
// This is a lightweight Node rewrite of the previous Python /api/security-chat.

const QWEN_API_URL =
  (process.env.QWEN_FINSEC_URL as string | undefined) ||
  "https://mlapi.run/0cd91e2f-6603-4699-b9d8-57c93f05b37e";
const QWEN_API_KEY = process.env.QWEN_FINSEC_KEY as string | undefined;

interface HistoryMessage {
  role: "user" | "model";
  content: string;
}

function buildSecurityPrompt(
  history: HistoryMessage[],
  latestUser: string,
): string {
  const convo = history
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content || ""}`,
    )
    .join("\n");

  return `
You are a cautious financial security and risk assistant.
Your job is to warn about leverage, regulatory risks, fraud, and unsafe behavior, NOT to recommend specific trades.

Conversation so far:
${convo}

User (latest question):
${latestUser}

Guidelines:
- Do NOT give direct buy/sell recommendations.
- Highlight regulatory/compliance issues, leverage/margin risks, concentration risk, fraud red flags, and suitability concerns.
- If the question is not clearly about financial security, reframe it in terms of risk control, worst-case scenarios, and safe behavior.
- Keep the answer under about 230 words, in clear, simple English.
`.trim();
}

async function callQwenFinsec(prompt: string): Promise<string> {
  if (!QWEN_API_URL || !QWEN_API_KEY) {
    throw new Error(
      "QWEN_FINSEC_URL / QWEN_FINSEC_KEY are not configured on the server",
    );
  }

  const res = await fetch(
    `${QWEN_API_URL.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen/qwen2.5-finsec-72b-instruct",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  const data: any = await res.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Empty response from Qwen Finsec");
  }
  return content.trim();
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await new Promise<any>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: any) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });

    const history: HistoryMessage[] = Array.isArray(body.history)
      ? body.history
          .map((m: any) => ({
            role: m.role === "model" ? "model" : "user",
            content: String(m.content || ""),
          }))
          .filter((m: HistoryMessage) => !!m.content.trim())
      : [];

    if (!history.length) {
      res.status(400).json({ error: "history is empty" });
      return;
    }

    const latest = history[history.length - 1];
    const prev = history.slice(0, -1);
    const prompt = buildSecurityPrompt(prev, latest.content);
    const answer = await callQwenFinsec(prompt);

    res.status(200).json({ answer });
  } catch (err: any) {
    console.error("[api/security-chat] error:", err);
    res
      .status(500)
      .json({ error: String(err?.message || err || "Unknown error") });
  }
}


