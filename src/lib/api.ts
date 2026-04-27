'use client';

const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export function getApiBaseUrl(): string {
  const normalized = rawBaseUrl.trim().replace(/\/$/, '');
  if (normalized) return normalized;

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function toApiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path;
  return `${base}${path}`;
}
