// api/news-sentiment.ts
// Simple rule-based sentiment classifier for news titles/summaries.

function ruleBasedSentiment(
  title: string,
  summary: string,
): "positive" | "negative" | "neutral" {
  const text = `${title} ${summary}`.toLowerCase();

  const positive = [
    "rally",
    "surge",
    "soar",
    "record high",
    "gain",
    "beat",
    "beats",
    "growth",
    "upgraded",
    "upgrade",
    "strong",
    "rebound",
    "rebound",
    "recovery",
    "profit",
    "bull",
  ];

  const negative = [
    "plunge",
    "plunges",
    "tumble",
    "slump",
    "drop",
    "falls",
    "fall",
    "crash",
    "plunging",
    "plummets",
    "bankruptcy",
    "default",
    "crisis",
    "loss",
    "losses",
    "fraud",
    "scandal",
    "investigation",
    "probe",
    "lawsuit",
    "downgrade",
    "downgraded",
    "warning",
  ];

  let score = 0;
  for (const p of positive) {
    if (text.includes(p)) score += 1;
  }
  for (const n of negative) {
    if (text.includes(n)) score -= 1;
  }

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export default async function handler(req: any, res: any) {
  try {
    const body = await (async () => {
      if (req.method === "GET") {
        return {
          title: req.query?.title ?? "",
          summary: req.query?.summary ?? "",
        };
      }
      return await new Promise<any>((resolve, reject) => {
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
    })();

    const title = (body.title || "").toString();
    const summary = (body.summary || "").toString();
    if (!title && !summary) {
      res.status(400).json({ error: "missing title or summary" });
      return;
    }

    const sentiment = ruleBasedSentiment(title, summary);
    res.status(200).json({ sentiment });
  } catch (err: any) {
    console.error("[api/news-sentiment] error:", err);
    res
      .status(500)
      .json({ error: String(err?.message || err || "Unknown error"), sentiment: "neutral" });
  }
}


