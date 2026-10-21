import type {PatientRecord,PatientCareVisit} from "./patientRegistry";
import type { Database, RegisterInput, SetupInput, User, Sale } from "./types";
import type { DatabasePatch } from "./databasePatch";

const SESSION_HINT_KEY = "rxledger-session-active";
const COMPANY_KEY = "rxledger-company-slug";

type ApiResult<T> = T & {
  token?: string;
  expiresAt?: string;
  db?: Database;
  currentUser?: User;
};

export function getStoredToken() {
  return localStorage.getItem(SESSION_HINT_KEY) || "";
}

export function storeToken() {
  localStorage.setItem(SESSION_HINT_KEY, "true");
}

export function clearStoredToken() {
  localStorage.removeItem(SESSION_HINT_KEY);
  localStorage.removeItem("pharmacy-inventory-session-token");
}

export function getStoredCompanySlug() {
  return localStorage.getItem(COMPANY_KEY) || "";
}

export function storeCompanySlug(slug: string) {
  if (slug) localStorage.setItem(COMPANY_KEY, slug);
}

export function clearStoredCompanySlug() {
  localStorage.removeItem(COMPANY_KEY);
}

export function clearWorkspaceBrowserData(slug: string) {
  if (!slug) return;
  const prefix = `rxledger:${slug}:`;
  for (const storage of [localStorage, sessionStorage]) {
    Object.keys(storage).forEach(key => {
      if (key.startsWith(prefix)) storage.removeItem(key);
    });
  }
  if (getStoredCompanySlug() === slug) {
    clearStoredToken();
    clearStoredCompanySlug();
  }
}

export type ActionResult = {
  db: Database;
  databasePatch: DatabasePatch;
  currentUser: User;
  patient?: PatientRecord;
  patientCareHistory?: PatientCareVisit[];
  checkout?: {state: "confirmed" | "cancelled" | "not_found"; sale?: Sale; replayed?: boolean};
};

export class ApiError extends Error {
  status: number;
  checkoutState?: string;
  constructor(message: string, status: number, checkoutState?: string) {
    super(message);
    this.status = status;
    this.checkoutState = checkoutState;
  }
}

async function request<T>(path: string, options: RequestInit = {}) {
  const companySlug = getStoredCompanySlug();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (companySlug) headers.set("X-RxLedger-Company", companySlug);

  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "Backend API is not available. Run npx vercel dev with DATABASE_URL for API-backed flows.",
    );
  }
  const body = (await response.json().catch((error: unknown) => {
    throw new Error("The server response was interrupted or unreadable. Check confirmation before retrying.", {cause: error});
  })) as {error?: string; checkoutState?: string} & T;
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("The server returned an incomplete response. Check confirmation before retrying.");
  if (!response.ok) throw new ApiError(body.error || "Request failed", response.status, body.checkoutState);
  return body as ApiResult<T>;
}

export async function bootstrap() {
  const result = await request<{
    hasUsers: boolean;
    tenantExists: boolean;
    requestedSlug: string;
    settings: Database["settings"];
  }>("/api/bootstrap");
  if (!result.tenantExists && result.requestedSlug) {
    clearWorkspaceBrowserData(result.requestedSlug);
  }
  return result;
}

export async function loadState() {
  return request<{ db: Database; currentUser: User }>("/api/state");
}

export async function loadAuditHistory() {
  return request<{ auditLogs: Database["auditLogs"] }>("/api/state?scope=audit");
}

export async function loadSalesHistory(input: {
  cursor?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams({ scope: "sales" });
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  return request<{
    sales: Database["sales"];
    nextCursor: string;
  }>(`/api/state?${params.toString()}`);
}

export async function loadLedgerHistory(input: {
  cursor?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams({ scope: "ledger" });
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  return request<{
    ledger: Database["ledger"];
    nextCursor: string;
  }>(`/api/state?${params.toString()}`);
}

export async function setupWorkspace(input: SetupInput) {
  const result = await request<{
    db: Database;
    currentUser: User;
    token: string;
    expiresAt: string;
  }>("/api/setup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  storeToken();
  if (result.db?.settings.companySlug)
    storeCompanySlug(result.db.settings.companySlug);
  return result;
}

export async function checkCompanySlug(slug: string) {
  return request<{ slug: string; available: boolean; claimedBy: string }>(
    `/api/tenant/check?slug=${encodeURIComponent(slug)}`,
  );
}

export async function resolveCompany(value: string) {
  return request<{ slug: string }>(
    `/api/tenant/resolve?q=${encodeURIComponent(value)}`,
  );
}

export async function login(email: string, password: string) {
  const result = await request<{
    db: Database;
    currentUser: User;
    token: string;
    expiresAt: string;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  storeToken();
  return result;
}

export async function registerUser(input: RegisterInput) {
  return request<{ ok: boolean }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestPasswordReset(input: {
  email: string;
  phone: string;
}) {
  return request<{ ok: boolean; emailConfigured: boolean }>(
    "/api/auth/request-password-reset",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function completePasswordReset(input: {
  email: string;
  code: string;
  password: string;
}) {
  return request<{ ok: boolean }>("/api/auth/complete-password-reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout() {
  try {
    await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } finally {
    clearStoredToken();
  }
}

export async function runAction(
  action: string,
  payload: Record<string, unknown>,
) {
  const controller = new AbortController();
  const checkout = ["recordSale", "getCheckoutStatus", "cancelCheckout"].includes(action);
  const timeout = checkout ? setTimeout(() => controller.abort(), 20_000) : undefined;
  try {
    const result = await request<ActionResult>("/api/action", {
      method: "POST",
      body: JSON.stringify({ action, payload }),
      signal: checkout ? controller.signal : undefined,
    });
    if (!result.db || !Array.isArray(result.db.users) || !result.currentUser?.id ||
        !result.databasePatch || !["sales", "ledger", "auditLogs"].every(key => {
          const collection = result.databasePatch[key as keyof DatabasePatch];
          return collection && Array.isArray(collection.upserts) && Array.isArray(collection.removedIds);
        })) throw new Error("The server returned an incomplete action result. Check confirmation before retrying.");
    return result;
  } finally { if (timeout !== undefined) clearTimeout(timeout); }
}
