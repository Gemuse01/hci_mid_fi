// services/apiClient.ts
// Shared helper for calling the backend from the frontend.
// - In production on Vercel, leave VITE_BACKEND_URL undefined so that calls go to
//   the same origin (e.g. '/api/quote' → Vercel Serverless Function).
// - In local development, you can set VITE_BACKEND_URL=http://localhost:5002
//   to point to the existing Python backend if you want.

export const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || '';

export function apiUrl(path: string): string {
  // Ensure there is exactly one slash between base and path
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}


