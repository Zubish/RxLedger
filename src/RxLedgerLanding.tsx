import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Boxes,
  Building2,
  Receipt,
  Lock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Users,
  ScanLine,
  ArrowLeftRight,
  ClipboardCheck,
  Sunrise,
  Moon,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import "./rxledger-landing.css";
import { planChangePolicy, subscriptionPlans, trialPolicy } from "./subscriptionPlans";

type LandingProps = {
  onCreateWorkspace: () => void;
  onSignIn: () => void;
};

export default function RxLedgerLanding({ onCreateWorkspace, onSignIn }: LandingProps) {
  return (
    <div className="rxledger-landing min-h-screen bg-background font-sans text-ink antialiased">
      <Nav onCreateWorkspace={onCreateWorkspace} onSignIn={onSignIn} />
      <Hero onCreateWorkspace={onCreateWorkspace} />
      <TrustStrip />
      <FeatureBento />
      <DayInLife />
      <Roles />
      <Testimonial />
      <Pricing />
      <FAQ />
      <FinalCTA onCreateWorkspace={onCreateWorkspace} />
      <Footer />
    </div>
  );
}

/* ---------------- Nav ---------------- */
function Nav({ onCreateWorkspace, onSignIn }: LandingProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="landing-container flex h-16 items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-extrabold tracking-tight">RxLedger</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-soft md:flex">
          <a href="#product" className="transition-colors hover:text-ink">Product</a>
          <a href="#why" className="transition-colors hover:text-ink">Why RxLedger</a>
          <a href="#pricing" className="transition-colors hover:text-ink">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <button className="hidden h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex" type="button" onClick={onSignIn}>
            Sign in
          </button>
          <button className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-brand px-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-brand/90" type="button" onClick={onCreateWorkspace}>
            <span className="hidden sm:inline">Create workspace</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="grid size-8 place-items-center rounded-md bg-white shadow-sm ring-1 ring-border">
      <img src="/favicon.svg" alt="RxLedger logo" className="size-6 object-contain" />
    </div>
  );
}

/* ---------------- Hero ---------------- */
function Hero({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at 15% -10%, color-mix(in oklab, var(--brand) 14%, transparent), transparent 60%), radial-gradient(700px 400px at 95% 10%, color-mix(in oklab, var(--accent-2) 10%, transparent), transparent 60%)",
        }}
      />
      <div className="landing-container grid min-w-0 items-center gap-14 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16 lg:pt-24 lg:pb-28 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] 2xl:gap-24">
        <div className="w-[calc(100vw-2rem)] min-w-0 justify-self-start text-left lg:w-auto lg:justify-self-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-ink-soft shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-brand" />
            <span className="hidden sm:inline">Free 30-day trial - no card required</span>
            <span className="sm:hidden">30-day trial - no card</span>
            <span className="mx-1 hidden h-3 w-px bg-border sm:block" />
            <span className="text-brand">Try workspace -&gt;</span>
          </div>
          <h1 className="mt-6 max-w-[calc(100vw-2rem)] text-left font-display text-[26px] font-extrabold leading-[1.05] tracking-tight text-ink min-[380px]:text-[28px] sm:text-5xl lg:max-w-4xl lg:text-[56px] 2xl:text-[62px]">
            <span className="block 2xl:whitespace-nowrap">Pharmacy Operations</span>
            <span className="block text-brand">audited by default.</span>
          </h1>
          <p className="mt-5 max-w-[17rem] text-base leading-relaxed text-ink-soft min-[380px]:max-w-[18rem] sm:max-w-2xl sm:text-lg 2xl:text-xl">
            RxLedger is the multi-tenant workspace for community pharmacies, hospital dispensaries, and
            multi-branch retailers — FEFO inventory, POS checkout, role-based access, and clean day-end
            reconciliation in one calm system.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-brand/90 sm:w-auto" type="button" onClick={onCreateWorkspace}>
              Start free 30-day trial
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface sm:w-auto" type="button">
              Book a 20-min demo
            </button>
          </div>
          <ul className="mt-6 flex max-w-[17rem] flex-col items-start justify-start gap-x-5 gap-y-2 text-xs text-ink-soft min-[380px]:max-w-[18rem] sm:max-w-none sm:flex-row sm:flex-wrap">
            <li className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-brand" /> No card to start</li>
            <li className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-brand" /> Setup in under 15 minutes</li>
            <li className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-brand" /> Cancel anytime</li>
          </ul>
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
}

/* ---------------- Dashboard Preview (software preview, merged from v1+v2+v3) ---------------- */
function DashboardPreview() {
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[28px] opacity-70 blur-2xl"
        style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--brand) 22%, transparent), color-mix(in oklab, var(--accent-2) 18%, transparent))" }}
      />
      <div className="max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/[0.03]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-danger/70" />
            <span className="size-2.5 rounded-full bg-warn/80" />
            <span className="size-2.5 rounded-full bg-success/80" />
            <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
              workspace · medplus · lekki branch
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-danger">
            <AlertTriangle className="size-3" /> FEFO alert
          </span>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-3 p-4">
          <KpiTile label="Today's sales" value="₦1,842,500" delta="+12.4%" tone="brand" icon={<TrendingUp className="size-3.5" />} />
          <KpiTile label="Branches live" value="3 / 3" delta="all online" tone="success" icon={<Building2 className="size-3.5" />} />
          <KpiTile label="Near-expiry (30d)" value="14 batches" delta="action" tone="danger" icon={<AlertTriangle className="size-3.5" />} />
        </div>

        {/* Batch ledger table */}
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold text-ink">FEFO queue · dispense next</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">batch ledger</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Item · batch</th>
                  <th className="px-3 py-2 font-medium">Expiry</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                <BatchRow item="Amoxicillin 500mg" batch="B-2241" expiry="12 Jun 2026" qty="142" status="dispense" />
                <BatchRow item="Ventolin Inhaler" batch="B-7710" expiry="22 Nov 2026" qty="12" status="low" />
                <BatchRow item="Panadol Extra 50s" batch="B-9021" expiry="12 Jan 2027" qty="890" status="stable" />
                <BatchRow item="Augmentin 625mg" batch="B-3318" expiry="04 Mar 2027" qty="64" status="stable" />
              </tbody>
            </table>
          </div>

          {/* Activity strip */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface/60 px-3 py-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Activity className="size-3.5 text-brand" />
              <span className="font-mono">14:32</span>
              <span>Cashier <b className="text-ink">Tunde</b> sold 3 items · receipt #4821</span>
            </span>
            <span className="font-mono text-ink">₦18,400</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label, value, delta, tone, icon,
}: { label: string; value: string; delta: string; tone: "brand" | "success" | "danger"; icon: ReactNode }) {
  const toneCls =
    tone === "brand" ? "text-brand bg-brand-soft" :
    tone === "success" ? "text-success bg-success/10" :
    "text-danger bg-danger/10";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">{label}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${toneCls}`}>
          {icon}
          {delta}
        </span>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold tracking-tight text-ink">{value}</div>
    </div>
  );
}

function BatchRow({ item, batch, expiry, qty, status }: { item: string; batch: string; expiry: string; qty: string; status: "dispense" | "low" | "stable" }) {
  const chip =
    status === "dispense" ? <span className="landing-status-danger inline-flex rounded bg-danger px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider">Dispense first</span> :
    status === "low" ? <span className="inline-flex rounded bg-warn/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn">Low</span> :
    <span className="inline-flex rounded bg-success/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-success">Stable</span>;
  const expiryCls = status === "dispense" ? "text-danger" : status === "low" ? "text-warn" : "text-ink-soft";
  return (
    <tr className="hover:bg-surface/60">
      <td className="px-3 py-2.5">
        <div className="font-medium text-ink">{item}</div>
        <div className="font-mono text-[10px] text-ink-soft">{batch}</div>
      </td>
      <td className={`px-3 py-2.5 font-mono ${expiryCls}`}>{expiry}</td>
      <td className="px-3 py-2.5 text-right font-mono">{qty}</td>
      <td className="px-3 py-2.5 text-right">{chip}</td>
    </tr>
  );
}

/* ---------------- Trust strip ---------------- */
function TrustStrip() {
  const items = [
    { value: "450+", label: "Pharmacies live" },
    { value: "1.2M", label: "Batches tracked" },
    { value: "₦84M+", label: "Reconciled daily" },
    { value: "99.98%", label: "Audit accuracy" },
  ];
  return (
    <section className="border-y border-border bg-surface/60">
      <div className="landing-container grid grid-cols-2 place-items-center gap-y-6 py-10 text-center md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="flex min-w-32 flex-col items-center">
            <span className="font-display text-3xl font-extrabold tracking-tight text-ink">{it.value}</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-soft">{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Feature bento ---------------- */
function FeatureBento() {
  return (
    <section id="product" className="landing-container py-24">
      <div className="max-w-2xl">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">The platform</span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Commercial memory for modern pharmacy work.
        </h2>
        <p className="mt-3 text-ink-soft">
          The rigor of a clinical ledger with the speed of a modern POS — built for the daily realities of
          multi-branch pharmacy operations.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[auto_auto] md:gap-5">
        {/* Big card — FEFO */}
        <FeatureCard className="md:col-span-2 md:row-span-1" tone="light">
          <div className="flex items-start gap-3">
            <FeatureIcon><Boxes className="size-5" /></FeatureIcon>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand">Inventory ledger</p>
              <h3 className="mt-1 font-display text-xl font-bold text-ink">Full FEFO discipline, enforced at the counter.</h3>
              <p className="mt-2 max-w-md text-sm text-ink-soft">
                System-enforced first-expiry-first-out. The POS surfaces the right batch automatically, so
                near-expiry stock leaves the shelf before it leaves your margin.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {["Batch tracking", "Auto-sorting", "Wastage logs", "Reorder risk"].map((t) => (
              <span key={t} className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t}</span>
            ))}
          </div>
        </FeatureCard>

        {/* Dark card — Multi-branch */}
        <FeatureCard tone="dark">
          <FeatureIcon dark><Building2 className="size-5" /></FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand-soft">Multi-branch</p>
          <h3 className="mt-1 font-display text-xl font-bold text-primary-foreground">Total visibility, branch by branch.</h3>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Monitor stock and reconciliation across every location from a single admin workspace.
          </p>
        </FeatureCard>

        {/* POS */}
        <FeatureCard tone="light">
          <FeatureIcon><Receipt className="size-5" /></FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand">POS checkout</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">Customer memory, clean receipts.</h3>
          <p className="mt-2 text-sm text-ink-soft">
            Discounts, refunds, and split items handled fast — every sale tied to the staff who rang it.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Patient details, label instructions, and follow-up notes can stay attached to the sale.
          </p>
        </FeatureCard>

        {/* Audit */}
        <FeatureCard tone="light">
          <FeatureIcon><ShieldCheck className="size-5" /></FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand">Pricing control</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">Margins protected by default.</h3>
          <p className="mt-2 text-sm text-ink-soft">
            Every dispense, transfer, and price edit logged with timestamp and staff ID — court-ready by default.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Auto pricing links least-unit cost to markup rules, rounding, warnings, and admin overrides.
          </p>
        </FeatureCard>

        {/* Roles */}
        <FeatureCard tone="light">
          <FeatureIcon><Lock className="size-5" /></FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand">Role-based access</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">Right tools, right people.</h3>
          <p className="mt-2 text-sm text-ink-soft">
            Cashiers, pharmacists, managers, admins — each role sees only what it needs.
          </p>
        </FeatureCard>
      </div>
    </section>
  );
}

function FeatureCard({
  children, className = "", tone,
}: { children: ReactNode; className?: string; tone: "light" | "dark" }) {
  const base = tone === "dark"
    ? "bg-ink text-primary-foreground border-ink"
    : "bg-card text-ink border-border";
  return (
    <div className={`group rounded-2xl border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${base} ${className}`}>
      {children}
    </div>
  );
}

function FeatureIcon({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`grid size-10 place-items-center rounded-lg ${dark ? "bg-white/10 text-primary-foreground" : "bg-brand-soft text-brand"}`}>
      {children}
    </div>
  );
}

/* ---------------- A day at the counter ---------------- */
function DayInLife() {
  const steps = [
    { time: "08:00", icon: <Sunrise className="size-4" />, title: "Open & reconcile", body: "Confirm yesterday's close, verify till float, and pick up alerts from overnight." },
    { time: "11:30", icon: <ScanLine className="size-4" />, title: "Receive new stock", body: "Review invoice lines, packaging units, final unit cost, selling price, and warnings before posting stock." },
    { time: "13:10", icon: <Receipt className="size-4" />, title: "Sell at the POS", body: "Pharmacist rings up items, attaches the customer, prints labels, and keeps follow-up in one sale record." },
    { time: "15:45", icon: <ArrowLeftRight className="size-4" />, title: "Inter-branch transfer", body: "Low stock at Surulere? Move from Lekki in two taps — both ledgers update at once." },
    { time: "20:30", icon: <ClipboardCheck className="size-4" />, title: "Day-end reconciliation", body: "Cash, card, transfer matched against the ledger. Close the day in under five minutes." },
    { time: "20:45", icon: <Moon className="size-4" />, title: "Lock & sleep", body: "Roles revoke automatically. The next shift wakes to a clean, verified ledger." },
  ];
  return (
    <section id="why" className="bg-surface/60 py-24">
      <div className="landing-container">
        <div className="max-w-2xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">A day with RxLedger</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            From opening shift to lock-up — one calm rhythm.
          </h2>
          <p className="mt-3 text-ink-soft">
            RxLedger mirrors the natural workflow of a pharmacy team, so the software disappears behind the work.
          </p>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-md bg-brand-soft text-brand">{s.icon}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">Step {String(i + 1).padStart(2, "0")} · {s.time}</span>
              </div>
              <h4 className="mt-3 font-display text-base font-bold text-ink">{s.title}</h4>
              <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Roles ---------------- */
function Roles() {
  const roles = [
    { name: "Admin", sees: "Workspace, branches, billing, audit logs, every record." },
    { name: "Manager", sees: "Branch dashboards, stock health, staff performance, reports." },
    { name: "Pharmacist", sees: "Dispense queue, FEFO alerts, controlled-drug register." },
    { name: "Inventory Officer", sees: "Stock receiving, batch records, reorder alerts, and inventory movement logs." },
    { name: "Cashier", sees: "POS, saved prices, receipts, end-of-shift cash count." },
  ];
  return (
    <section className="landing-container py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">Security model</span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Defined roles. Absolute audit trail.
        </h2>
        <p className="mt-3 text-ink-soft">
          Company lists stay private. Each role sees the tools meant for them — nothing more, nothing less.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {roles.map((r, i) => (
          <div key={r.name} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand">
            <div className="flex items-center justify-between">
              <Users className="size-4 text-brand" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h4 className="mt-4 font-display text-lg font-bold text-ink">{r.name}</h4>
            <p className="mt-1 text-sm text-ink-soft">{r.sees}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const testimonials = [
  {
    initials: "IO",
    name: "Dr. Ifeanyi Okeke",
    role: "Superintendent Pharmacist · MedVault, Lagos · 3 branches",
    quote: (
      <>
        “Switching to RxLedger cut our expiry waste by <span className="text-brand-soft">42%</span> in one quarter.
        The FEFO prompt at the POS is the single change that paid for the whole system —
        my pharmacists trust the queue, and my day-end is finally boring.”
      </>
    ),
  },
  {
    initials: "AA",
    name: "Amina Adewale",
    role: "Branch Manager · GreenLife Pharmacy · 5 branches",
    quote: (
      <>
        “Our branch managers finally see stock, sales, requisitions, and cash movement in one place.
        It feels built for how pharmacies actually work, not forced into a generic retail system.”
      </>
    ),
  },
  {
    initials: "NE",
    name: "Nnamdi Eze",
    role: "Inventory Officer · CityCare Pharmacy · 2 branches",
    quote: (
      <>
        “The audit trail changed our end-of-day checks. We can trace every received item, POS sale,
        price update, and transfer without chasing paper records across branches.”
      </>
    ),
  },
];

const testimonialImages = [
  "/testimonial-pharmacist.jpg",
  "/testimonial-pharmacy-shelves.jpg",
  "/testimonial-pharmacy-counter.jpg",
];

/* ---------------- Testimonial ---------------- */
function Testimonial() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let swapTimer: number | undefined;
    const timer = window.setInterval(() => {
      setIsVisible(false);
      swapTimer = window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % testimonials.length);
        setIsVisible(true);
      }, 400);
    }, 5000);

    return () => {
      window.clearInterval(timer);
      if (swapTimer) {
        window.clearTimeout(swapTimer);
      }
    };
  }, []);

  const active = testimonials[activeIndex];
  const showTestimonial = (index: number) => {
    if (index === activeIndex) {
      return;
    }

    setIsVisible(false);
    window.setTimeout(() => {
      setActiveIndex(index);
      setIsVisible(true);
    }, 400);
  };

  return (
    <section className="landing-testimonial-section py-20">
      <div className="landing-testimonial-bg-stack" aria-hidden="true">
        {testimonialImages.map((image, index) => (
          <div
            key={image}
            className={`landing-testimonial-bg ${activeIndex === index ? "is-active" : ""}`}
            style={{ backgroundImage: `url(${image})` }}
          />
        ))}
      </div>
      <div className="landing-testimonial-overlay" aria-hidden="true" />
      <div className="landing-container relative z-10">
        <div className="landing-testimonial-panel">
          <Zap className="size-6 text-brand" />
          <blockquote
            className={`mt-6 font-display text-2xl font-semibold leading-snug tracking-tight text-ink transition-all duration-500 ease-in-out md:text-3xl ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-80"}`}
            aria-live="polite"
          >
            {active.quote}
          </blockquote>
          <div className="mt-8 flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-ink font-display text-sm font-bold text-primary-foreground shadow-sm">{active.initials}</div>
            <div>
              <p className="font-semibold text-ink">{active.name}</p>
              <p className="font-mono text-xs text-ink-soft">{active.role}</p>
            </div>
          </div>
          <div className="mt-7 flex gap-2" aria-label="Testimonial slides">
            {testimonials.map((testimonial, index) => (
              <button
                key={testimonial.name}
                type="button"
                className={`h-1.5 rounded-full transition-all ${activeIndex === index ? "w-8 bg-brand" : "w-2 bg-ink/25 hover:bg-ink/45"}`}
                aria-label={`Show testimonial from ${testimonial.name}`}
                aria-pressed={activeIndex === index}
                onClick={() => showTestimonial(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing teaser ---------------- */
function Pricing() {
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({})
  const previewFeatureCount = 3

  return (
    <section id="pricing" className="landing-container py-24">
      <div className="mx-auto max-w-3xl text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">Pricing</span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Honest pricing. Start free for 30 days.
        </h2>
        <p className="mt-3 text-ink-soft">{trialPolicy.summary}</p>
      </div>
      <div className="mt-12 grid items-start gap-5 md:grid-cols-3">
        {subscriptionPlans.map((t) => {
          const expanded = Boolean(expandedPlans[t.id])
          const previewFeatures = t.features.slice(0, previewFeatureCount)
          const hiddenFeatureCount = Math.max(0, t.features.length - previewFeatureCount)
          return (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-6 md:min-h-[440px] ${t.highlight ? "border-brand bg-card shadow-lg ring-1 ring-brand/20" : "border-border bg-card shadow-sm"}`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {t.badge}
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-ink">{t.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.summary}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold tracking-tight text-ink">{t.price}</span>
                <span className="text-sm text-ink-soft">{t.per}</span>
              </div>
              <div className="mt-5 rounded-lg border border-border bg-surface/60 p-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Plan boundary</p>
                <ul className="mt-2 space-y-1.5 text-xs text-ink-soft">
                  {t.limits.map((limit) => (
                    <li key={limit} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      <span>{limit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                {previewFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>{f}</span>
                  </li>
                ))}
                {expanded && t.features.slice(previewFeatureCount).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {hiddenFeatureCount > 0 && (
                <button
                  className="mt-3 inline-flex w-fit text-sm font-semibold text-brand transition-colors hover:text-brand/80"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedPlans((plans) => ({ ...plans, [t.id]: !expanded }))}
                >
                  {expanded ? "View less" : "View more"}
                </button>
              )}
              <button className={`mt-5 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-all ${t.highlight ? "bg-brand text-primary-foreground hover:bg-brand/90" : "border border-border bg-background text-ink hover:bg-surface"}`}>
                {t.cta}
              </button>
            </div>
          )
        })}
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-surface/60 p-5 text-sm leading-relaxed text-ink-soft">
        <strong className="text-ink">Plan changes are safe.</strong> {planChangePolicy.dataRetention} {planChangePolicy.downgrade}
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
function FAQ() {
  const qs = [
    { q: "Do I need to install anything?", a: "No. RxLedger is a web workspace — open it from any browser at the counter or back office. We do recommend a thermal receipt printer for POS." },
    { q: "How does the free trial work?", a: "30 days, no card. You get Smart Pharmacy features during trial. After 30 days you choose a plan, or your workspace gracefully pauses. Your data is never deleted." },
    { q: "Can I switch plans later?", a: "Yes. Upgrades are immediate. Downgrades are allowed when your active branches and staff fit the lower plan; extra records can be archived or exported first, but stock, sales, patient, branch, and audit history stays preserved." },
    { q: "Is my pharmacy's data private?", a: "Yes. Each workspace is fully isolated. Company lists stay private — staff only see their pharmacy after entering the access code from their admin." },
    { q: "Can I migrate from spreadsheets or another POS?", a: "Yes. Send us your stock and price lists in CSV or Excel — our onboarding team imports them and verifies opening balances with you before you go live." },
    { q: "Does it work offline?", a: "POS continues to ring sales if your internet drops; transactions sync the moment connectivity returns. Inventory edits require connection to preserve the audit trail." },
  ];
  return (
    <section id="faq" className="bg-surface/60 py-24">
      <div className="landing-container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">FAQ</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Answers before you sign up.
          </h2>
          <p className="mt-3 text-ink-soft">
            Still unsure? Email <a className="text-brand underline-offset-4 hover:underline" href="mailto:support@rxledger.com">support@rxledger.com</a> — a pharmacist on our team replies within a business day.
          </p>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {qs.map((item) => (
            <details key={item.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-semibold text-ink">
                {item.q}
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-border text-ink-soft transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */
function FinalCTA({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  return (
    <section className="landing-container py-24">
      <div
        className="relative overflow-hidden rounded-3xl bg-brand p-10 text-primary-foreground md:p-16"
      >
        <div
          aria-hidden
          className="absolute -right-20 -top-20 size-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--accent-2) 80%, transparent)" }}
        />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Bring RxLedger into your pharmacy workflow.
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Spin up a workspace in minutes. Import your stock. Hand the right tools to the right people.
            Free for the first 30 days — no card required.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="inline-flex h-12 items-center gap-2 rounded-lg bg-background px-5 text-sm font-semibold text-ink shadow-sm transition-transform hover:scale-[1.02]" type="button" onClick={onCreateWorkspace}>
              Create pharmacy workspace
              <ArrowRight className="size-4" />
            </button>
            <button className="inline-flex h-12 items-center gap-2 rounded-lg border border-primary-foreground/30 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10" type="button">
              Talk to the team
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="landing-container grid gap-12 py-16 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-extrabold tracking-tight">RxLedger</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-ink-soft">
            Auditable operations for community pharmacies and multi-branch medicine retailers. Built for
            pharmacies that cannot afford guesswork.
          </p>
        </div>
        <FooterCol title="Product" links={["Inventory ledger", "POS checkout", "Multi-branch", "Audit trail", "Roles"]} />
        <FooterCol title="Company" links={["About", "Security", "Compliance", "Contact"]} />
        <FooterCol title="Resources" links={["Help center", "Onboarding", "Status", "Changelog"]} />
      </div>
      <div className="border-t border-border">
        <div className="landing-container flex flex-col items-center justify-between gap-3 py-6 text-xs text-ink-soft md:flex-row">
          <span className="font-mono uppercase tracking-widest">© 2026 RxLedger Technologies</span>
          <div className="flex items-center gap-5">
            <a href="mailto:support@rxledger.com" className="hover:text-ink">support@rxledger.com</a>
            <a href="https://x.com/rxledger" className="hover:text-ink">Twitter</a>
            <a href="https://linkedin.com/company/rxledger" className="hover:text-ink">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink">{title}</p>
      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        {links.map((l) => (
          <li key={l}><a href="#" className="transition-colors hover:text-ink">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}
