import { useEffect, useState } from "react";
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
    onCreateWorkspace();
  };
  const signIn = () => {
    setMenuOpen(false);
    onSignIn();
  };
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
              <button className="rl-button" onClick={create}>
                Create your workspace <ArrowRight size={17} />
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
          <div className="rl-preview-stage">
            <div
              className="rl-preview"
              aria-label="Illustrative pharmacy workspace preview"
            >
              <div className="rl-preview-top">
                <span className="rl-logo">
                  <Boxes size={17} /> RxLedger
                </span>
                <span className="rl-tag">Sample workspace</span>
              </div>
              <div className="rl-preview-greeting">
                <span className="rl-avatar">PH</span>
                <div>
                  <strong>Your pharmacy</strong>
                  <p>One branch. A clearer day.</p>
                </div>
                <ShieldCheck size={19} />
              </div>
              <div className="rl-preview-tabs">
                <span>Overview</span>
                <span>Stock</span>
                <span>Continuity</span>
              </div>
              <div className="rl-preview-content">
                <p className="rl-eyebrow">TODAY, AT A GLANCE</p>
                <h3>A little more clarity.</h3>
                <div className="rl-preview-stats">
                  <div>
                    <span>Stocked items</span>
                    <strong>128</strong>
                  </div>
                  <div>
                    <span>Follow-ups due</span>
                    <strong>6</strong>
                  </div>
                </div>
                <div className="rl-preview-row">
                  <span className="rl-icon blue">
                    <Boxes size={19} />
                  </span>
                  <div>
                    <strong>Stock and expiry</strong>
                    <p>Review batches that need attention</p>
                  </div>
                  <ChevronDown size={15} />
                </div>
                <div className="rl-preview-note">
                  <ClipboardCheck size={16} />
                  <div>
                    <strong>Every movement has a history</strong>
                    <p>Receipts, sales and transfers stay traceable.</p>
                  </div>
                </div>
                <div className="rl-preview-row">
                  <span className="rl-icon">
                    <Bell size={18} />
                  </span>
                  <div>
                    <strong>Patient continuity</strong>
                    <p>Pending medicines and refill follow-up</p>
                  </div>
                  <ArrowRight size={15} />
                </div>
              </div>
              <div className="rl-preview-bottom">
                <Building2 size={14} /> Working within your branch{" "}
                <ArrowRight size={14} />
              </div>
            </div>
            <p className="rl-preview-caption">
              Illustrative preview · sample data
            </p>
            <div className="rl-floating-note">
              <span />
              Less searching. More time for care.
            </div>
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
                  onClick={create}
                >
                  Start free trial <ArrowRight size={16} />
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
            <button className="rl-button" onClick={create}>
              Create your workspace <ArrowRight size={17} />
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
