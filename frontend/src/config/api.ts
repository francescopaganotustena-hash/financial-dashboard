const rawApiUrl = import.meta.env.VITE_API_URL?.trim()

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function resolveLanAwareApiUrl(value: string): string {
  if (typeof window === 'undefined') return value

  try {
    const url = new URL(value)
    const isLocalApiHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    const clientHost = window.location.hostname
    const isLanClient = /^10\.0\.0\.\d{1,3}$/.test(clientHost)

    if (isLocalApiHost && isLanClient) {
      url.hostname = clientHost
      return url.toString()
    }
  } catch {
    return value
  }

  return value
}

function resolveApiBaseUrl(): string {
  if (rawApiUrl) return normalizeBaseUrl(resolveLanAwareApiUrl(rawApiUrl))
  if (typeof window !== 'undefined') return normalizeBaseUrl(window.location.origin)
  return 'http://localhost:8000'
}

export const API_BASE_URL = resolveApiBaseUrl()

export const WS_BASE_URL = API_BASE_URL.startsWith('https://')
  ? API_BASE_URL.replace(/^https:\/\//, 'wss://')
  : API_BASE_URL.replace(/^http:\/\//, 'ws://')
