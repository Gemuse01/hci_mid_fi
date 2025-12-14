// services/apiClient.ts
// Shared helper for calling the Python backend (yfinance_api.py) from the frontend.
// In development we default to http://localhost:5002, but in production (e.g. Vercel)
// you should set VITE_BACKEND_URL to your deployed backend URL.

export const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5002';

export function apiUrl(path: string): string {
  // Ensure there is exactly one slash between base and path
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }
  return `${API_BASE_URL}${path}`;
}


