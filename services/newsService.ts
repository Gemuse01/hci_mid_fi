// services/newsService.ts
import type { NewsItem } from "../types";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/+$/, "");

// ✅ 이제는 "단일 티커"만 받게 변경
export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const trimmed = symbol.trim();
  if (!trimmed) return [];

  const url = `${API_BASE}/api/news?symbols=${encodeURIComponent(trimmed)}`;
  console.log("[fetchNews] symbol:", trimmed, "url:", url);

  const res = await fetch(url);
  if (!res.ok) {
    console.error("News API error:", res.status, res.statusText, "url:", url);
    throw new Error("Failed to fetch news");
  }

  const data = await res.json();
  const items = (data.items || []) as NewsItem[];

  console.log("[fetchNews] response items length:", items.length);
  return items;
}
