import { pageIds } from "../../src/platform/contracts.js";
export type BrowserEvent = {
  id: string;
  event: "page_visit" | "web_vital" | "browser_error";
  page: string;
  device: "mobile" | "tablet" | "desktop";
  vital?: "LCP" | "INP" | "CLS";
  value?: number;
  group?: "runtime" | "unhandled-rejection";
};
export function validateBrowserEvent(input: unknown): BrowserEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (k) =>
        !["id", "event", "page", "device", "vital", "value", "group"].includes(
          k,
        ),
    )
  )
    return null;
  if (
    typeof value.id !== "string" ||
    !/^[a-f0-9]{32}$/.test(value.id) ||
    !pageIds.includes(value.page as (typeof pageIds)[number]) ||
    !["mobile", "tablet", "desktop"].includes(String(value.device))
  )
    return null;
  if (
    !["page_visit", "web_vital", "browser_error"].includes(String(value.event))
  )
    return null;
  if (
    value.event === "web_vital" &&
    (!["LCP", "INP", "CLS"].includes(String(value.vital)) ||
      typeof value.value !== "number" ||
      !Number.isFinite(value.value) ||
      value.value < 0 ||
      value.value > (value.vital === "CLS" ? 100 : 120000))
  )
    return null;
  if (
    value.event === "browser_error" &&
    !["runtime", "unhandled-rejection"].includes(String(value.group))
  )
    return null;
  return value as BrowserEvent;
}
