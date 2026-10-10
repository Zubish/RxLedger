import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Download,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { OwnerStatus, PlatformPage, PlatformReport } from "./contracts";
import "./portal.css";
const pages: PlatformPage[] = ["overview", "workspaces", "usage", "health"];
const labels = {
  overview: "Overview",
  workspaces: "Workspaces",
  usage: "Usage",
  health: "Health",
};
const icons = {
  overview: LayoutDashboard,
  workspaces: Building2,
  usage: ChartNoAxesCombined,
  health: Activity,
};
function locationState() {
  const [page, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return {
    page: pages.find((p) => p === page) || ("overview" as PlatformPage),
    params: new URLSearchParams(query),
  };
}
async function request(path: string, body?: unknown) {
  const response = await fetch(path, {
    credentials: "same-origin",
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message || data.error || data.message || "Request failed",
    );
  return data;
}
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC"
    : "Not observed yet";
const metric = (value: number | null, suffix = "") =>
  value === null ? "Not measured" : Math.round(value * 100) / 100 + suffix;
export default function Portal() {
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [nav, setNav] = useState(locationState);
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const refreshStatus = async () => {
    try {
      setStatus(await request("/api/platform?mode=status"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to check access");
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshStatus(), 0);
    const change = () => {
      setNav(locationState());
    };
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  const query = nav.params.toString();
  const detail =
    report?.workspacePage.rows.find(
      (row) => row.slug === nav.params.get("workspace"),
    ) || null;
  useEffect(() => {
    if (!status?.authenticated) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError("");
    }, 0);
    request("/api/platform?mode=report&" + query)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          if (/authentication/.test(e.message))
            setStatus({ authenticated: false });
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status?.authenticated, query]);
  function navigate(page: PlatformPage, changes: Record<string, string> = {}) {
    const params = new URLSearchParams(nav.params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const hash = "#/" + page + (params.size ? "?" + params : "");
    history.pushState(null, "", location.pathname + hash);
    setNav({ page, params });
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete request");
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    await action(async()=>{
      await request("/api/platform-auth/sign-in/username",{username,password});
      setPassword("");
      await refreshStatus();
    });
  }
  async function exportCsv() {
    await action(async () => {
      await request("/api/platform?mode=export", {});
      const rows = [
        [
          "Workspace",
          "Slug",
          "Category",
          "Branches",
          "Active staff",
          "Created UTC",
          "Last observed UTC",
        ],
        ...(report?.workspacePage.rows || []).map((r) => [
          r.name,
          r.slug,
          r.kind,
          r.branches,
          r.activeStaff,
          r.createdAt,
          r.lastActivity || "",
        ]),
      ];
      const csv = rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+@-]/, "'")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "rxledger-workspaces-page-" +
        (report?.workspacePage.page || 1) +
        ".csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  const alert = error && (
    <p role="alert" className="pa-error">
      {error}
    </p>
  );
  if(!status || !status.authenticated) return (
    <main className="pa pa-access"><section className="pa-card"><ShieldCheck size={32}/><p className="pa-eyebrow">RXLEDGER · PLATFORM OWNER</p><h1>Owner sign in</h1><p>Sign in to your admin dashboard.</p>{alert}{!status&&!error?<p role="status">Checking access…</p>:<form onSubmit={e=>{e.preventDefault();void signIn();}}><label>Username<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form>}</section><a href="/">Return to RxLedger</a></main>
  );
  return (
    <div className="pa">
      <header className="pa-header">
        <a href="/platform-admin#/overview" className="pa-brand">
          RxLedger <span>Platform</span>
        </a>
        <button
          className="pa-secondary"
          onClick={() =>
            void action(async () => {
              await request("/api/platform-auth/sign-out", {});
              setStatus({ authenticated: false });
              setReport(null);
              setPassword("");
            })
          }
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </header>
      <div className="pa-layout">
        <nav className="pa-nav" aria-label="Platform navigation">
          {pages.map((page) => {
            const Icon = icons[page];
            return (
              <button
                key={page}
                aria-current={nav.page === page ? "page" : undefined}
                className={nav.page === page ? "pa-selected" : ""}
                onClick={() => navigate(page)}
              >
                <Icon size={20} />
                <span>{labels[page]}</span>
              </button>
            );
          })}
        </nav>
        <main className="pa-main">
          <p className="pa-eyebrow">OWNER REPORTING · READ ONLY</p>
          <h1>{labels[nav.page]}</h1>
          <p>
            Current workspace data and observed performance. All reporting times
            use UTC.
          </p>
          <details className="pa-filters">
            <summary>
              Report filters · {nav.params.get("days") || 7} days ·{" "}
              {nav.params.get("demo") === "true"
                ? "all categories"
                : "pharmacy activity"}
            </summary>
            <div>
              <label>
                Period
                <select
                  value={nav.params.get("days") || "7"}
                  onChange={(e) =>
                    navigate(nav.page, { days: e.target.value, page: "1" })
                  }
                >
                  <option value="1">Last 24 hours</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </label>
              <label className="pa-check">
                <input
                  type="checkbox"
                  checked={nav.params.get("demo") === "true"}
                  onChange={(e) =>
                    navigate(nav.page, { demo: String(e.target.checked) })
                  }
                />
                Include DEMO and internal activity
              </label>
              {nav.page === "workspaces" && (
                <>
                  <label>
                    Created on or after
                    <input
                      type="date"
                      value={nav.params.get("since") || ""}
                      onChange={(e) =>
                        navigate("workspaces", {
                          since: e.target.value,
                          page: "1",
                        })
                      }
                    />
                  </label>
                  <label>
                    Activity
                    <select
                      value={nav.params.get("activity") || ""}
                      onChange={(e) =>
                        navigate("workspaces", {
                          activity: e.target.value,
                          page: "1",
                        })
                      }
                    >
                      <option value="">Any activity</option>
                      <option value="active">Active in period</option>
                      <option value="inactive">
                        No activity observed in period
                      </option>
                    </select>
                  </label>
                  <label>
                    Activation
                    <select
                      value={nav.params.get("activation") || ""}
                      onChange={(e) =>
                        navigate("workspaces", {
                          activation: e.target.value,
                          page: "1",
                        })
                      }
                    >
                      <option value="">Any activation state</option>
                      <option value="activated">
                        Sale or receipt observed
                      </option>
                      <option value="not-activated">
                        No activation observed
                      </option>
                    </select>
                  </label>
                </>
              )}
            </div>
          </details>
          {alert}
          {busy && <p role="status">Updating report…</p>}
          {!report && !busy && !error && <p>No report available.</p>}
          {report && (
            <>
              <p className="pa-meta">
                Measured since {date(report.measurementStartedAt)} · Updated{" "}
                {date(report.generatedAt)} · Release{" "}
                {report.release.slice(0, 7)}
              </p>
              {nav.page === "overview" && (
                <>
                  <div className="pa-stats">
                    <Stat
                      title="Registered workspaces"
                      value={report.counts.total}
                      note={
                        report.counts.pharmacy +
                        " pharmacy · " +
                        report.counts.demo +
                        " DEMO · " +
                        report.counts.internal +
                        " internal"
                      }
                    />
                    <Stat
                      title="Active workspaces"
                      value={report.counts.active}
                      note="Foreground visits or successful operations in this period"
                    />
                    <Stat
                      title="API p95"
                      value={metric(report.health.p95, " ms")}
                      note={report.health.samples + " measured requests"}
                    />
                    <Stat
                      title="Availability"
                      value={metric(report.health.availability.percentage, "%")}
                      note={
                        report.health.availability.observed +
                        " external observations · " +
                        report.health.availability.missing +
                        " missing"
                      }
                    />
                  </div>
                  <section className="pa-card">
                    <h2>Explore your platform</h2>
                    <div className="pa-links">
                      {(
                        ["workspaces", "usage", "health"] as PlatformPage[]
                      ).map((page) => (
                        <button
                          className="pa-secondary"
                          key={page}
                          onClick={() => navigate(page)}
                        >
                          {labels[page]}
                          <ArrowRight size={18} />
                        </button>
                      ))}
                    </div>
                    <p>
                      Pharmacy usage excludes DEMO and internal workspaces
                      unless you select them in the filters. Missing
                      measurements are shown explicitly.
                    </p>
                  </section>
                </>
              )}
              {nav.page === "workspaces" && (
                <>
                  <section className="pa-card" hidden={Boolean(detail)}>
                    <div className="pa-section-heading">
                      <h2>
                        Workspace directory{" "}
                        <small>({report.workspacePage.total})</small>
                      </h2>
                      <button
                        className="pa-secondary"
                        disabled={busy || !report.workspacePage.rows.length}
                        onClick={() => void exportCsv()}
                      >
                        <Download size={18} />
                        Export this page
                      </button>
                    </div>
                    <form
                      className="pa-search"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        navigate("workspaces", {
                          search: String(f.get("search") || ""),
                          page: "1",
                        });
                      }}
                    >
                      <label>
                        Search workspaces
                        <input
                          key={nav.params.get("search")}
                          name="search"
                          placeholder="Name or portal slug"
                          defaultValue={nav.params.get("search") || ""}
                        />
                      </label>
                      <button>Search</button>
                      <label>
                        Category
                        <select
                          value={nav.params.get("kind") || ""}
                          onChange={(e) =>
                            navigate("workspaces", {
                              kind: e.target.value,
                              page: "1",
                            })
                          }
                        >
                          <option value="">All categories</option>
                          <option value="pharmacy">Pharmacy</option>
                          <option value="demo">DEMO</option>
                          <option value="internal">Internal</option>
                        </select>
                      </label>
                    </form>
                    <div className="pa-workspaces">
                      {report.workspacePage.rows.map((row) => (
                        <button
                          className="pa-workspace"
                          key={row.slug}
                          onClick={() =>
                            navigate("workspaces", { workspace: row.slug })
                          }
                        >
                          <span>
                            <strong>{row.name}</strong>
                            <small>
                              {row.slug} · {row.kind.toUpperCase()}
                            </small>
                          </span>
                          <span>
                            {row.branches} branches · {row.activeStaff} active
                            staff
                            <small>
                              Last activity: {date(row.lastActivity)}
                            </small>
                          </span>
                          <ArrowRight size={18} />
                        </button>
                      ))}
                    </div>
                    {!report.workspacePage.rows.length && (
                      <p>No workspaces match these filters.</p>
                    )}
                    <div className="pa-pagination">
                      <button
                        className="pa-secondary"
                        disabled={report.workspacePage.page <= 1}
                        onClick={() =>
                          navigate("workspaces", {
                            page: String(report.workspacePage.page - 1),
                          })
                        }
                      >
                        <ArrowLeft size={16} />
                        Previous
                      </button>
                      <span>
                        Page {report.workspacePage.page} of{" "}
                        {Math.max(
                          1,
                          Math.ceil(
                            report.workspacePage.total /
                              report.workspacePage.limit,
                          ),
                        )}
                      </span>
                      <button
                        className="pa-secondary"
                        disabled={
                          report.workspacePage.page *
                            report.workspacePage.limit >=
                          report.workspacePage.total
                        }
                        onClick={() =>
                          navigate("workspaces", {
                            page: String(report.workspacePage.page + 1),
                          })
                        }
                      >
                        Next
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </section>
                  {detail && (
                    <section className="pa-card" aria-label="Workspace detail">
                      <div className="pa-section-heading">
                        <h2>{detail.name}</h2>
                        <button
                          className="pa-secondary"
                          onClick={() =>
                            navigate("workspaces", { workspace: "" })
                          }
                        >
                          Close details
                        </button>
                      </div>
                      <dl className="pa-detail">
                        <dt>Category</dt>
                        <dd>{detail.kind}</dd>
                        <dt>Created</dt>
                        <dd>{date(detail.createdAt)}</dd>
                        <dt>Branches / active staff</dt>
                        <dd>
                          {detail.branches} / {detail.activeStaff}
                        </dd>
                        <dt>Observed visits / operations</dt>
                        <dd>
                          {detail.visits} / {detail.operations}
                        </dd>
                        <dt>Activation since measurement began</dt>
                        <dd>
                          {detail.activated
                            ? "Sale or stock receipt observed"
                            : "Not observed"}
                        </dd>
                      </dl>
                      <a
                        href={"/" + detail.slug}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open normal pharmacy portal
                      </a>
                      <p>
                        Its own pharmacy login is required. This portal does not
                        grant access to pharmacy records.
                      </p>
                    </section>
                  )}
                </>
              )}
              {nav.page === "usage" && (
                <>
                  <div className="pa-stats">
                    <Stat
                      title="New pharmacy workspaces"
                      value={report.counts.newPharmacies}
                      note="Current accounts created in this period"
                    />
                    <Stat
                      title="Active workspaces"
                      value={report.counts.active}
                    />
                    <Stat
                      title="Activated in this period"
                      value={report.counts.activated}
                      note="Successful sale or stock receipt observed"
                    />
                  </div>
                  <section className="pa-card">
                    <h2>Feature visits</h2>
                    {report.usage.length ? (
                      <div className="pa-rows">
                        {report.usage.map((row) => (
                          <div key={row.page}>
                            <strong>{row.page}</strong>
                            <span>
                              {row.visits} visits · {row.workspaces} workspaces
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No foreground feature visits observed in this scope." />
                    )}
                  </section>
                  <section className="pa-card">
                    <h2>Daily activity</h2>
                    {report.daily.length ? (
                      <div className="pa-rows">
                        {report.daily.map((row) => (
                          <div key={row.date}>
                            <strong>{row.date}</strong>
                            <span>
                              {row.active} active · {row.visits} visits ·{" "}
                              {row.operations} operations
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty text="Activity will appear as pharmacies start using the app." />
                    )}
                  </section>
                </>
              )}
              {nav.page === "health" && (
                <>
                  <div className="pa-stats">
                    <Stat
                      title="Measured requests"
                      value={report.health.samples}
                      note="Instrumented state and action routes"
                    />
                    <Stat
                      title="Server failures"
                      value={
                        report.health.samples
                          ? report.health.failures
                          : "Not measured"
                      }
                      note={
                        report.health.samples
                          ? metric(
                              (100 * report.health.failures) /
                                report.health.samples,
                              "% of measured requests",
                            )
                          : "No observations"
                      }
                    />
                    <Stat
                      title="API p95"
                      value={metric(report.health.p95, " ms")}
                    />
                  </div>
                  <section className="pa-card">
                    <h2>API latency</h2>
                    {report.health.routes.length ? (
                      <div className="pa-rows">
                        {report.health.routes.map((row) => (
                          <div key={row.route + row.action}>
                            <strong>
                              {row.route} {row.action}
                              <small>
                                {row.samples} samples · {row.failures} server
                                failures · {row.rejected} rejected (4xx) ·{" "}
                                {metric(row.averageBytes, " bytes average")}
                                <br />
                                Backend averages: load{" "}
                                {metric(row.loadMs, " ms")} · auth{" "}
                                {metric(row.authMs, " ms")} · save{" "}
                                {metric(row.saveMs, " ms")}
                              </small>
                            </strong>
                            <span>
                              p50 {metric(row.p50, " ms")} · p95{" "}
                              {metric(row.p95, " ms")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No measured API requests in this scope." />
                    )}
                  </section>
                  <section className="pa-card">
                    <h2>Browser performance by device</h2>
                    <p>
                      LCP and INP are milliseconds; CLS is a unitless
                      layout-shift score. Values are the observed 75th
                      percentile.
                    </p>
                    {report.health.devices.length ? (
                      <div className="pa-rows">
                        {report.health.devices.map((row) => (
                          <div key={row.device + row.name}>
                            <strong>
                              {row.device} · {row.name}
                            </strong>
                            <span>
                              {metric(row.p75, row.name === "CLS" ? "" : " ms")}{" "}
                              · {row.samples} samples
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No browser measurements observed yet." />
                    )}
                  </section>
                  <section className="pa-card">
                    <h2>External availability</h2>
                    <p>
                      {report.health.availability.successes} successful /{" "}
                      {report.health.availability.observed} observed /{" "}
                      {report.health.availability.expected} expected probes.
                    </p>
                    <p>
                      {report.health.availability.percentage === null
                        ? "Monitoring is incomplete. Missing probes are unknown, so an uptime percentage is not reported."
                        : metric(
                            report.health.availability.percentage,
                            "% measured availability",
                          )}
                    </p>
                  </section>
                  <section className="pa-card">
                    <h2>Sanitized browser error groups</h2>
                    {report.health.errors.length ? (
                      <div className="pa-rows">
                        {report.health.errors.map((row, i) => (
                          <div key={i}>
                            <strong>
                              {row.group} · {row.page}
                              <small>Release {row.release.slice(0, 7)}</small>
                            </strong>
                            <span>{row.occurrences} occurrences</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No browser error observations. This is not proof of an error-free app." />
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function Stat({
  title,
  value,
  note,
}: {
  title: string;
  value: string | number;
  note?: string;
}) {
  return (
    <section className="pa-card pa-stat">
      <h2>{title}</h2>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="pa-empty">{text}</p>;
}
