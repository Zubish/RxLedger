import { onCLS, onINP, onLCP } from "web-vitals";
import type { Metric } from "web-vitals";
import type { NavigationView } from "../navigation";
let context: { slug: string; page: NavigationView } | null = null;
let started = false;
const metricIds = new Map<string, string>();
const device = () =>
  window.innerWidth < 768
    ? "mobile"
    : window.innerWidth < 1024
      ? "tablet"
      : "desktop";
function send(event: Record<string, unknown>) {
  if (!context) return;
  void fetch("/api/telemetry", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "x-rxledger-company": context.slug,
    },
    body: JSON.stringify({
      id: crypto.randomUUID().replaceAll("-", ""),
      page: context.page,
      device: device(),
      ...event,
    }),
  }).catch(() => {});
}
export function collectPage(slug: string, page: NavigationView) {
  context = { slug, page };
  if (document.visibilityState === "visible") send({ event: "page_visit" });
  if (started) return;
  started = true;
  const initialPage = page;
  const initialSlug = slug;
  const vital = (metric: Metric) => {
    if (context?.slug !== initialSlug) return;
    if (!metricIds.has(metric.id))
      metricIds.set(metric.id, crypto.randomUUID().replaceAll("-", ""));
    send({
      event: "web_vital",
      page: initialPage,
      vital: metric.name,
      value: metric.value,
      id: metricIds.get(metric.id),
    });
  };
  onCLS(vital);
  onINP(vital);
  onLCP(vital);
  window.addEventListener("error", () =>
    send({ event: "browser_error", group: "runtime" }),
  );
  window.addEventListener("unhandledrejection", () =>
    send({ event: "browser_error", group: "unhandled-rejection" }),
  );
}
export function stopCollection() {
  context = null;
}
