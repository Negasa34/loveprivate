// Database utilities for the client side
// The actual MongoDB connection is handled by the custom server.js
// This file provides helper types and constants for the frontend

export const API_BASE = '';

export async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  return res;
}
