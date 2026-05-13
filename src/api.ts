import type { Database, RegisterInput, SetupInput, User } from './types'

const TOKEN_KEY = 'pharmacy-inventory-session-token'

type ApiResult<T> = T & {
  token?: string
  expiresAt?: string
  db?: Database
  currentUser?: User
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = getStoredToken()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Backend API is not available. Run npx vercel dev with DATABASE_URL for API-backed flows.')
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) throw new Error(body.error || 'Request failed')
  return body as ApiResult<T>
}

export async function bootstrap() {
  return request<{ hasUsers: boolean; settings: Database['settings'] }>('/api/bootstrap')
}

export async function loadState() {
  return request<{ db: Database; currentUser: User }>('/api/state')
}

export async function setupWorkspace(input: SetupInput) {
  const result = await request<{ db: Database; currentUser: User; token: string; expiresAt: string }>('/api/setup', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (result.token) storeToken(result.token)
  return result
}

export async function login(email: string, password: string) {
  const result = await request<{ db: Database; currentUser: User; token: string; expiresAt: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (result.token) storeToken(result.token)
  return result
}

export async function registerUser(input: RegisterInput) {
  return request<{ ok: boolean }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function requestPasswordReset(input: { email: string; phone: string }) {
  return request<{ ok: boolean; emailConfigured: boolean }>('/api/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function completePasswordReset(input: { email: string; code: string; password: string }) {
  return request<{ ok: boolean }>('/api/auth/complete-password-reset', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function logout() {
  try {
    await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
  } finally {
    clearStoredToken()
  }
}

export async function runAction(action: string, payload: Record<string, unknown>) {
  return request<{ db: Database; currentUser: User }>('/api/action', {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
  })
}
