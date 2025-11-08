import { GoogleGenAI, Content } from "@google/genai";
import { UserProfile, Portfolio, MarketCondition, DiaryEntry } from "../types";
import { PERSONA_DETAILS, MOCK_STOCKS } from "../constants";

// Initialize the client with the API key from the environment variable.
// Adhering strictly to guidelines: NO hardcoded keys, NO user input for keys.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getStockAnalysis = async (
  symbol: string,
  marketCondition: MarketCondition,
  riskTolerance: string
): Promise<string> => {
  const stock = MOCK_STOCKS.find(s => s.symbol === symbol);
  const stockName = stock ? stock.name : symbol;

  const prompt = `
    Acting as a senior financial analyst, provide a concise 3-bullet point analysis of ${stockName} (${symbol}) for an investor with ${riskTolerance} risk tolerance.
    
    Current simulated market condition: ${marketCondition}.
    Stock Details: Sector: ${stock?.sector}, Volatility: ${stock?.volatility}, Recent Change: ${stock?.change_pct}%.

    Format the output exactly like this:
    **Snapshot**: [One sentence summary of current standing]
    • **Strength**: [Key competitive advantage or positive indicator]
    • **Risk**: [Main concern given current market/volatility]
    • **Verdict**: [Buy/Hold/Sell rating based on risk tolerance]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 300,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback mock data if API fails, ensuring UI always has content in demo
    return `**Snapshot**: ${stockName} is currently facing mixed signals in this ${marketCondition.toLowerCase()} market environment.\n• **Strength**: Strong historical performance in its sector.\n• **Risk**: Short-term volatility due to market conditions.\n• **Verdict**: HOLD for now, monitor closely.`;
  }
};

export const generateFinancialAdvice = async (
  history: Content[],
  user: UserProfile,
  portfolio: Portfolio
): Promise<string> => {
  const personaDetails = PERSONA_DETAILS[user.persona];
  
  const holdingsSummary = portfolio.assets.map(a => 
    `${a.quantity} shares of ${a.symbol} (Avg: $${a.avg_price.toFixed(2)})`
  ).join(', ') || "No current holdings";

  const systemInstruction = `
    You are FinGuide, an AI financial mentor.
    User Persona: ${personaDetails.label} (${personaDetails.description}).
    User Goal: ${user.goal}.
    Risk Tolerance: ${user.risk_tolerance}.
    Current Portfolio: Cash $${portfolio.cash.toFixed(2)}, Holdings: [${holdingsSummary}].

    Adapt your tone to their persona: ${personaDetails.advice}.
    Keep responses concise, encouraging, and educational. Avoid super long paragraphs.
    Do NOT give specific "buy this now" financial advice; always frame it as education or strategic options to consider.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having a little trouble connecting to the market data right now. Let's try again in a moment.";
  }
};

export const generateDiaryFeedback = async (entry: DiaryEntry, user: UserProfile): Promise<string> => {
  const personaDetails = PERSONA_DETAILS[user.persona];
  
  const prompt = `
    As an AI trading psychology coach, provide a brief (2-3 sentences) piece of feedback on this investment diary entry.
    
    User Persona: ${personaDetails.label}
    Entry Emotion: ${entry.emotion}
    Entry Driver: ${entry.reason}
    Entry Note: "${entry.note}"
    
    Your goal is to help them recognize behavioral patterns (like FOMO, revenge trading, or good discipline) based on their persona. Be encouraging but insightful.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 300,
      }
    });
    return response.text || "Good job reflecting on your trade. Consistency is key!";
  } catch (error) {
    console.error("Gemini Diary Feedback Error:", error);
    return "Great job recording your thoughts. Keeping track of these moments is key to long-term improvement!";
  }
};