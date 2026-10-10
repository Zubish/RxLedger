import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  ClipboardCheck,
  Building2,
  ShieldCheck,
  Menu,
  X,
  Bell,
  ArrowLeftRight,
  TrendingUp,
  AlertTriangle,
  Activity,
} from "lucide-react";
import {
  subscriptionPlans,
  trialPolicy,
  planChangePolicy,
} from "./subscriptionPlans";
import "./rxledger-landing.css";

type LandingProps = { onCreateWorkspace: () => void; onSignIn: () => void };
const links = [
  { href: "#product", label: "Your pharmacy" },
  { href: "#why", label: "How it works" },
  { href: "#pricing", label: "Plans" },
  { href: "#faq", label: "Questions" },
];
const features = [
  {
    icon: Boxes,
    title: "Know what’s on the shelf",
    label: "01 / YOUR STOCK",
    body: "Keep batches, stock levels and expiry dates together. Use first-expiring stock first, and see where attention is needed.",
    note: "Clear stock. Fewer surprises.",
  },
  {
    icon: ClipboardCheck,
    title: "Keep the counter moving",
    label: "02 / YOUR COUNTER",
    body: "Record sales, issue receipts and reconcile the day with a connected view of inventory and counter activity.",
    note: "From sale to day-end.",
  },
  {
    icon: Bell,
    title: "Remember who is waiting",
    label: "03 / YOUR PATIENTS",
    body: "Bring pending medicines, refill reminders and stock-arrival follow-up into a focused continuity queue.",
    note: "A clearer next action.",
  },
];
const questions = [
  {
    q: "Do I need to install anything?",
    a: "RxLedger runs in your browser. Open your workspace on a phone, tablet or desktop. A receipt printer can be used for counter sales.",
  },
  {
    q: "How does the free trial work?",
    a: trialPolicy.summary + " No card is required to start.",
  },
  {
    q: "Can I use it across branches?",
    a: "Yes. Smart Pharmacy supports up to five active branches, and Enterprise supports larger groups. Branch access follows the permissions assigned to each staff member.",
  },
  {
    q: "Who can see my workspace?",
    a: "Workspace membership and staff roles control access. Staff without global access work within their permitted branch scope.",
  },
  {
    q: "Can I change plans later?",
    a: planChangePolicy.upgrade + " " + planChangePolicy.downgrade,
  },
];

export default function RxLedgerLanding({
  onCreateWorkspace,
  onSignIn,
}: LandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [entry, setEntry] = useState(() =>
    new URLSearchParams(location.search).get("get-started"),
  );
  useEffect(() => {
    const sync = () =>
      setEntry(new URLSearchParams(location.search).get("get-started"));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const openEntry = (kind: "trial" | "workspace") => {
    setMenuOpen(false);
    history.pushState(null, "", "?get-started=" + kind);
    setEntry(kind);
    window.scrollTo(0, 0);
  };
  const startSetup = (choice: string) => {
    history.pushState(null, "", "?onboarding=" + choice);
    onCreateWorkspace();
  };
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const create = () => {
    setMenuOpen(false);
    openEntry("workspace");
  };
  const signIn = () => {
    setMenuOpen(false);
    history.pushState(null, "", "?account=signin");
    onSignIn();
  };
  if (entry)
    return (
      <GetStarted
        onBack={() => {
          history.pushState(null, "", "/");
          setEntry(null);
        }}
        onTrial={() => startSetup("trial")}
        onPlan={startSetup}
        onSignIn={signIn}
      />
    );
  return (
    <div className="rxledger-landing rl-calm">
      <a className="rl-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="rl-header">
        <div className="rl-wrap rl-header-inner">
          <a className="rl-logo" href="/" aria-label="RxLedger home">
            <span className="rl-mark">
              <Boxes size={21} aria-hidden="true" />
            </span>
            RxLedger
          </a>
          <nav className="rl-desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="rl-header-actions">
            <button className="rl-sign-in" onClick={signIn}>
              Sign in
            </button>
            <button className="rl-button rl-header-create" onClick={create}>
              Create workspace <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <button
              className="rl-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={
                menuOpen ? "Close navigation menu" : "Open navigation menu"
              }
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        <nav
          id="landing-mobile-menu"
          className="rl-mobile-nav rl-wrap"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
              <ArrowUpRight size={15} />
            </a>
          ))}
          <button onClick={signIn}>
            Sign in <ArrowRight size={16} />
          </button>
          <button onClick={create}>
            Create workspace <ArrowRight size={16} />
          </button>
        </nav>
      </header>
      <main id="landing-main" tabIndex={-1}>
        <section className="rl-wrap rl-hero">
          <div className="rl-hero-copy">
            <p className="rl-eyebrow">A CLEARER VIEW OF YOUR PHARMACY</p>
            <h1>
              Your pharmacy,
              <br />
              <em>in good order.</em>
            </h1>
            <p className="rl-intro">
              Bring stock, sales and patient follow-up together. A calmer
              workspace for the counter, the back office and every branch.
            </p>
            <div className="rl-actions">
              <button className="rl-button" onClick={() => openEntry("trial")}>
                Start 30 days free trial <ArrowRight size={17} />
              </button>
              <a className="rl-text-link" href="#product">
                Explore how it works <ArrowUpRight size={16} />
              </a>
            </div>
            <ul className="rl-benefits">
              <li>
                <Check size={14} />
                30-day free trial
              </li>
              <li>
                <Check size={14} />
                No card required
              </li>
              <li>
                <Check size={14} />
                Your own workspace
              </li>
            </ul>
            <p className="rl-small">
              Built for community pharmacies, dispensaries and pharmacy groups.
            </p>
          </div>
          <div className="rl-preview-stage rl-dashboard-stage">
            <DashboardPreview />
            <p className="rl-preview-caption">
              Illustrative workspace · sample data
            </p>
          </div>
        </section>
        <div className="rl-trust">
          <div className="rl-wrap">
            <span>
              <Boxes size={18} />
              Stock with context
            </span>
            <span>
              <ArrowLeftRight size={18} />
              Connected branches
            </span>
            <span>
              <ShieldCheck size={18} />
              Actions with a history
            </span>
          </div>
        </div>
        <section id="product" className="rl-wrap rl-section">
          <div className="rl-section-heading">
            <div>
              <p className="rl-eyebrow">YOUR WORKSPACE, LESS FRAGMENTED</p>
              <h2>
                Less keeping track.
                <br />
                More staying on top.
              </h2>
            </div>
            <p>
              The everyday work of a pharmacy belongs together. Start with a
              clear view, then focus on what needs your attention.
            </p>
          </div>
          <div className="rl-feature-grid">
            {features.map(({ icon: Icon, ...feature }, index) => (
              <article className="rl-feature" key={feature.title}>
                <span className={`rl-icon ${index === 0 ? "blue" : ""}`}>
                  <Icon size={22} />
                </span>
                <p className="rl-card-label">{feature.label}</p>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <span className="rl-feature-note">
                  <Check size={14} />
                  {feature.note}
                </span>
              </article>
            ))}
          </div>
        </section>
        <section id="why" className="rl-tinted">
          <div className="rl-wrap rl-section rl-two-column">
            <div>
              <p className="rl-eyebrow">A SIMPLE PLACE TO START</p>
              <h2>
                Your workflow.
                <br />
                With a little more order.
              </h2>
              <p className="rl-body-copy">
                From one counter to several branches, build a workspace around
                the people and stock you manage.
              </p>
              <button className="rl-text-link" onClick={create}>
                Start with your workspace <ArrowRight size={16} />
              </button>
              <p className="rl-context-note">
                <ShieldCheck size={19} />
                Branch permissions keep each team’s view relevant to their work.
              </p>
            </div>
            <ol className="rl-steps">
              {[
                {
                  title: "Create your pharmacy workspace",
                  body: "Set up your pharmacy and start your 30-day trial in your own workspace.",
                },
                {
                  title: "Bring your stock and team together",
                  body: "Add inventory, organise branches and assign staff access to the right people.",
                },
                {
                  title: "Find your daily rhythm",
                  body: "Record sales, review stock and follow up with patients from one connected place.",
                },
              ].map((step, index) => (
                <li key={step.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="rl-wrap rl-section">
          <div className="rl-team-panel rl-two-column">
            <div>
              <p className="rl-eyebrow">FOR THE PEOPLE BEHIND THE COUNTER</p>
              <h2>
                A shared workspace.
                <br />A clearer responsibility.
              </h2>
              <p>
                Give pharmacists, counter staff and managers the tools they
                need, with access that reflects their role.
              </p>
              <button className="rl-button rl-button-light" onClick={signIn}>
                Sign in to your pharmacy <ArrowRight size={16} />
              </button>
            </div>
            <div className="rl-team-points">
              {[
                {
                  icon: Building2,
                  title: "A view for each branch",
                  body: "Staff see the information available within their permitted branch scope.",
                },
                {
                  icon: ShieldCheck,
                  title: "Access with purpose",
                  body: "Roles and workspace membership define what each team member can do.",
                },
                {
                  icon: ClipboardCheck,
                  title: "A record of the work",
                  body: "Follow stock movements and daily operations through their audit history.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="rl-icon">
                    <Icon size={21} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <Reviews />
        <section id="pricing" className="rl-wrap rl-section rl-pricing">
          <div className="rl-section-heading">
            <div>
              <p className="rl-eyebrow">ROOM TO GROW</p>
              <h2>A plan for your pharmacy.</h2>
            </div>
            <p>{trialPolicy.summary}</p>
          </div>
          <div className="rl-plan-grid">
            {subscriptionPlans.map((plan) => (
              <article
                className={`rl-plan ${plan.highlight ? "rl-plan-featured" : ""}`}
                key={plan.id}
              >
                <div className="rl-plan-top">
                  <h3>{plan.name}</h3>
                  {plan.badge && <span className="rl-tag">{plan.badge}</span>}
                </div>
                <p>{plan.summary}</p>
                <p className="rl-price">
                  {plan.price}
                  <span>{plan.per}</span>
                </p>
                <ul>
                  {plan.limits.map((limit) => (
                    <li key={limit}>
                      <Check size={15} />
                      {limit}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>
                    What’s included <ChevronDown size={16} />
                  </summary>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={14} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </details>
                <button
                  className={
                    plan.highlight ? "rl-button" : "rl-button rl-button-outline"
                  }
                  onClick={() => openEntry("trial")}
                >
                  Start 30 days free trial <ArrowRight size={16} />
                </button>
              </article>
            ))}
          </div>
          <p className="rl-plan-footnote">{planChangePolicy.dataRetention}</p>
        </section>
        <section id="faq" className="rl-wrap rl-section rl-faq rl-two-column">
          <div>
            <p className="rl-eyebrow">A FEW USEFUL ANSWERS</p>
            <h2>
              Before you
              <br />
              get started.
            </h2>
            <p className="rl-body-copy">
              Know what your workspace includes, and how access works.
            </p>
          </div>
          <div className="rl-questions">
            {questions.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown size={17} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="rl-wrap rl-final">
          <p className="rl-eyebrow">START WITH A CLEARER WORKSPACE</p>
          <h2>
            A calmer day at the counter
            <br />
            starts here.
          </h2>
          <p>Create your workspace or return to your pharmacy.</p>
          <div className="rl-actions">
            <button className="rl-button" onClick={() => openEntry("trial")}>
              Start 30 days free trial <ArrowRight size={17} />
            </button>
            <button className="rl-text-link" onClick={signIn}>
              Already have a workspace? Sign in <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      </main>
      <footer className="rl-footer">
        <div className="rl-wrap">
          <div className="rl-footer-top">
            <div>
              <a className="rl-logo" href="/">
                <span className="rl-mark">
                  <Boxes size={20} />
                </span>
                RxLedger
              </a>
              <p>Pharmacy operations. A little more clarity.</p>
            </div>
            <nav aria-label="Footer navigation">
              <a href="#product">Your pharmacy</a>
              <a href="#pricing">Plans</a>
              <a href="#faq">Questions</a>
              <button onClick={signIn}>Sign in</button>
            </nav>
          </div>
          <p className="rl-copyright">
            © {new Date().getFullYear()} RxLedger · Built around your pharmacy.
          </p>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[28px] opacity-70 blur-2xl"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--brand) 22%, transparent), color-mix(in oklab, var(--accent-2) 18%, transparent))",
        }}
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
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 sm:p-4">
          <KpiTile
            label="Today's sales"
            value="₦1,842,500"
            delta="+12.4%"
            tone="brand"
            icon={<TrendingUp className="size-3.5" />}
          />
          <KpiTile
            label="Branches live"
            value="3 / 3"
            delta="all online"
            tone="success"
            icon={<Building2 className="size-3.5" />}
          />
          <KpiTile
            label="Near-expiry (30d)"
            value="14 batches"
            delta="action"
            tone="danger"
            icon={<AlertTriangle className="size-3.5" />}
          />
        </div>

        {/* Batch ledger table */}
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold text-ink">
                FEFO queue · dispense next
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                batch ledger
              </span>
            </div>
            <table className="min-w-[34rem] text-left text-xs sm:w-full sm:min-w-0">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Item · batch</th>
                  <th className="px-3 py-2 font-medium">Expiry</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                <BatchRow
                  item="Amoxicillin 500mg"
                  batch="B-2241"
                  expiry="12 Jun 2026"
                  qty="142"
                  status="dispense"
                />
                <BatchRow
                  item="Ventolin Inhaler"
                  batch="B-7710"
                  expiry="22 Nov 2026"
                  qty="12"
                  status="low"
                />
                <BatchRow
                  item="Panadol Extra 50s"
                  batch="B-9021"
                  expiry="12 Jan 2027"
                  qty="890"
                  status="stable"
                />
                <BatchRow
                  item="Augmentin 625mg"
                  batch="B-3318"
                  expiry="04 Mar 2027"
                  qty="64"
                  status="stable"
                />
              </tbody>
            </table>
          </div>

          {/* Activity strip */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface/60 px-3 py-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Activity className="size-3.5 text-brand" />
              <span className="font-mono">14:32</span>
              <span>
                Cashier <b className="text-ink">Tunde</b> sold 3 items · receipt
                #4821
              </span>
            </span>
            <span className="font-mono text-ink">₦18,400</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  tone,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "brand" | "success" | "danger";
  icon: ReactNode;
}) {
  const toneCls =
    tone === "brand"
      ? "text-brand bg-brand-soft"
      : tone === "success"
        ? "text-success bg-success/10"
        : "text-danger bg-danger/10";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
          {label}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${toneCls}`}
        >
          {icon}
          {delta}
        </span>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}

function BatchRow({
  item,
  batch,
  expiry,
  qty,
  status,
}: {
  item: string;
  batch: string;
  expiry: string;
  qty: string;
  status: "dispense" | "low" | "stable";
}) {
  const chip =
    status === "dispense" ? (
      <span className="landing-status-danger inline-flex rounded bg-danger px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider">
        Dispense first
      </span>
    ) : status === "low" ? (
      <span className="inline-flex rounded bg-warn/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn">
        Low
      </span>
    ) : (
      <span className="inline-flex rounded bg-success/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-success">
        Stable
      </span>
    );
  const expiryCls =
    status === "dispense"
      ? "text-danger"
      : status === "low"
        ? "text-warn"
        : "text-ink-soft";
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

const testimonials = [
  {
    initials: "IO",
    name: "Dr. Ifeanyi Okeke",
    role: "Superintendent Pharmacist · MedVault, Lagos · 3 branches",
    quote: (
      <>
        “Switching to RxLedger cut our expiry waste by{" "}
        <span className="text-brand-soft">42%</span> in one quarter. The FEFO
        prompt at the POS is the single change that paid for the whole system —
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
        “Our branch managers finally see stock, sales, requisitions, and cash
        movement in one place. It feels built for how pharmacies actually work,
        not forced into a generic retail system.”
      </>
    ),
  },
  {
    initials: "NE",
    name: "Nnamdi Eze",
    role: "Inventory Officer · CityCare Pharmacy · 2 branches",
    quote: (
      <>
        “The audit trail changed our end-of-day checks. We can trace every
        received item, POS sale, price update, and transfer without chasing
        paper records across branches.”
      </>
    ),
  },
];

const testimonialImages = [
  "/testimonial-pharmacist.jpg",
  "/testimonial-pharmacy-shelves.jpg",
  "/testimonial-pharmacy-counter.jpg",
];

function Reviews() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = testimonials[activeIndex];
  return (
    <section className="rl-reviews">
      <div
        className="rl-review-photo"
        style={{ backgroundImage: `url(${testimonialImages[activeIndex]})` }}
        aria-hidden="true"
      />
      <div className="rl-wrap">
        <div className="rl-review-panel">
          <p className="rl-eyebrow">FROM THE PHARMACY FLOOR</p>
          <h2>What our users say.</h2>
          <blockquote>{active.quote}</blockquote>
          <div className="rl-review-person">
            <span className="rl-avatar">{active.initials}</span>
            <div>
              <strong>{active.name}</strong>
              <p>{active.role}</p>
            </div>
          </div>
          <div className="rl-review-controls" aria-label="Reviews">
            {testimonials.map((review, index) => (
              <button
                key={review.name}
                aria-label={`Show testimonial from ${review.name}`}
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function GetStarted({
  onBack,
  onTrial,
  onPlan,
  onSignIn,
}: {
  onBack: () => void;
  onTrial: () => void;
  onPlan: (plan: string) => void;
  onSignIn: () => void;
}) {
  return (
    <div className="rxledger-landing rl-calm rl-entry">
      <header className="rl-header">
        <div className="rl-wrap rl-header-inner">
          <a className="rl-logo" href="/">
            RxLedger
          </a>
          <button className="rl-text-link" onClick={onBack}>
            Back to RxLedger
          </button>
        </div>
      </header>
      <main className="rl-wrap rl-section">
        <p className="rl-eyebrow">YOUR NEXT STEP</p>
        <h1>Make room for a calmer day.</h1>
        <p className="rl-intro">Choose how you’d like to get started.</p>
        <section className="rl-trial-option">
          <div>
            <p className="rl-eyebrow">EXPERIENCE RXLEDGER</p>
            <h2>Start your 30-day free trial.</h2>
            <p>Experience RxLedger by starting your free trial.</p>
            <p className="rl-small">
              30 days of Smart Pharmacy features. No card required.
            </p>
          </div>
          <button className="rl-button" onClick={onTrial}>
            Start trial now <ArrowRight size={17} />
          </button>
        </section>
        <section aria-labelledby="workspace-plan-title">
          <p className="rl-eyebrow">CREATE YOUR WORKSPACE</p>
          <h2 id="workspace-plan-title">Ready to use RxLedger now?</h2>
          <p className="rl-body-copy">
            Want to use RxLedger now? Select a plan to create your workspace.
          </p>
          <div className="rl-plan-grid">
            {subscriptionPlans.map((plan) => (
              <article
                key={plan.id}
                className={`rl-plan ${plan.highlight ? "rl-plan-featured" : ""}`}
              >
                <h3>{plan.name}</h3>
                <p>{plan.summary}</p>
                <p className="rl-price">
                  {plan.price}
                  <span>{plan.per}</span>
                </p>
                <ul>
                  {plan.limits.map((limit) => (
                    <li key={limit}>
                      <Check size={15} />
                      {limit}
                    </li>
                  ))}
                </ul>
                <button className="rl-button" onClick={() => onPlan(plan.id)}>
                  Create workspace <ArrowRight size={16} />
                </button>
              </article>
            ))}
          </div>
          <p className="rl-plan-footnote">
            Your workspace starts with the free trial. Plan activation is
            available within workspace settings.
          </p>
        </section>
        <div className="rl-actions">
          <button className="rl-text-link" onClick={onSignIn}>
            Already have a workspace? Sign in <ArrowUpRight size={16} />
          </button>
        </div>
      </main>
    </div>
  );
}
