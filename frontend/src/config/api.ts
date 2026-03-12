const rawApiUrl = import.meta.env.VITE_API_URL?.trim()

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function resolveApiBaseUrl(): string {
  if (rawApiUrl) return normalizeBaseUrl(rawApiUrl)
  if (typeof window !== 'undefined') return normalizeBaseUrl(window.location.origin)
  return 'http://localhost:8000'
}

export const API_BASE_URL = resolveApiBaseUrl()

export const WS_BASE_URL = API_BASE_URL.startsWith('https://')
  ? API_BASE_URL.replace(/^https:\/\//, 'wss://')
  : API_BASE_URL.replace(/^http:\/\//, 'ws://')
