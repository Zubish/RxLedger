import { useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  planChangePolicy,
  subscriptionPlans,
  trialPolicy,
} from "./subscriptionPlans";

type LandingProps = {
  onCreateWorkspace: () => void;
  onSignIn: () => void;
};

export default function RxLedgerLanding({
  onCreateWorkspace,
  onSignIn,
}: LandingProps) {
  return (
    <div className="rxledger-landing min-h-screen bg-background font-sans text-ink antialiased">
      <Nav onCreateWorkspace={onCreateWorkspace} onSignIn={onSignIn} />
      <ProductVideoIntro />
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
          <span className="font-display text-lg font-extrabold tracking-tight">
            RxLedger
          </span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-soft md:flex">
          <a href="#product" className="transition-colors hover:text-ink">
            Product
          </a>
          <a href="#why" className="transition-colors hover:text-ink">
            Why RxLedger
          </a>
          <a href="#pricing" className="transition-colors hover:text-ink">
            Pricing
          </a>
          <a href="#faq" className="transition-colors hover:text-ink">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            className="hidden h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
            type="button"
            onClick={onSignIn}
          >
            Sign in
          </button>
          <button
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-brand px-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-brand/90"
            type="button"
            onClick={onCreateWorkspace}
          >
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
      <img
        src="/favicon.svg"
        alt="RxLedger logo"
        className="size-6 object-contain"
      />
    </div>
  );
}

/* ---------------- Hero ---------------- */
type ProductVideoScene = {
  title: string;
  caption: string;
  eyebrow: string;
};

const PRODUCT_VIDEO_DURATION_MS = 96_000;

const productVideoScenes: ProductVideoScene[] = [
  {
    eyebrow: "00:00 / Pharmacy pressure",
    title: "Disconnected stock costs trust.",
    caption:
      "RxLedger opens with the daily reality: scattered stock, owed medicines, and branch questions that slow the counter down.",
  },
  {
    eyebrow: "00:16 / Workspace control",
    title: "Every branch in one operating view.",
    caption:
      "Owners and superintendent pharmacists see branch health, staff activity, stock value, and the work that needs attention.",
  },
  {
    eyebrow: "00:32 / FEFO at the counter",
    title: "Dispense from the right batch first.",
    caption:
      "The POS surfaces FEFO stock, clean receipts, patient records, and counselling prompts without breaking the sale flow.",
  },
  {
    eyebrow: "00:48 / Continuity Centre",
    title: "RxLedger remembers who is waiting.",
    caption:
      "Pending medication, refill follow-up, and stock-arrival matches become a focused action queue instead of noisy alerts.",
  },
  {
    eyebrow: "01:04 / Branch availability",
    title: "Find the closest branch that can help.",
    caption:
      "When a shelf is empty, pharmacists can see nearby branch availability and choose transfer, reservation, or patient direction.",
  },
  {
    eyebrow: "01:20 / Audit confidence",
    title: "A calmer pharmacy with an audit trail.",
    caption:
      "Roles, reconciliations, stock movement, and pharmacist review notes stay traceable so the business keeps its memory.",
  },
];

function ProductVideoIntro() {
  const stageRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInView, setIsInView] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [activeScene, setActiveScene] = useState(productVideoScenes[0]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!stage || !canvas || !video) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = 1920;
    canvas.height = 1080;
    drawRxLedgerVideoFrame(context, 1920, 1080, 0);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stream = canvas.captureStream?.(30);

    if (stream && !reduceMotion.matches) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      setIsVideoReady(true);
    } else {
      setIsPaused(true);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.45 },
    );

    observer.observe(stage);

    return () => {
      observer.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!video || !canvas || !context) {
      return;
    }

    let frame = 0;
    let timelineStart = performance.now() - elapsedRef.current;

    const render = (now: number) => {
      elapsedRef.current = (now - timelineStart) % PRODUCT_VIDEO_DURATION_MS;
      const sceneIndex = Math.min(
        productVideoScenes.length - 1,
        Math.floor(
          (elapsedRef.current / PRODUCT_VIDEO_DURATION_MS) *
            productVideoScenes.length,
        ),
      );

      setActiveScene((current) =>
        current === productVideoScenes[sceneIndex]
          ? current
          : productVideoScenes[sceneIndex],
      );
      drawRxLedgerVideoFrame(context, canvas.width, canvas.height, elapsedRef.current);
      frame = window.requestAnimationFrame(render);
    };

    if (isInView && !isPaused && isVideoReady) {
      void video.play().catch(() => setIsPaused(true));
      frame = window.requestAnimationFrame((now) => {
        timelineStart = now - elapsedRef.current;
        render(now);
      });
    } else {
      video.pause();
      drawRxLedgerVideoFrame(context, canvas.width, canvas.height, elapsedRef.current);
    }

    return () => window.cancelAnimationFrame(frame);
  }, [isInView, isPaused, isVideoReady]);

  const togglePlayback = () => {
    setIsPaused((current) => !current);
  };

  const showFullscreen = () => {
    void stageRef.current?.requestFullscreen?.();
  };

  return (
    <section
      ref={stageRef}
      className="landing-video-hero"
      aria-label="RxLedger product video"
    >
      <canvas
        ref={canvasRef}
        className="landing-video-canvas"
        aria-hidden="true"
      />
      <video
        ref={videoRef}
        className={`landing-video-player ${isVideoReady ? "is-ready" : ""}`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label="Animated RxLedger product walkthrough"
      />
      {!isVideoReady && (
        <div className="landing-video-fallback" aria-hidden="true">
          <DashboardPreview />
        </div>
      )}
      <div className="landing-video-scrim" aria-hidden="true" />
      <div className="landing-video-glow" aria-hidden="true" />

      <div className="landing-video-nav-spacer" aria-hidden="true" />

      <div className="landing-video-copy">
        <div className="landing-video-caption" aria-live="polite">
          <span>{activeScene.eyebrow}</span>
          <strong>{activeScene.title}</strong>
          <p>{activeScene.caption}</p>
        </div>

        <div className="landing-video-kicker">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/82 shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-cyan-200" />
            <span className="hidden sm:inline">
              Product video - RxLedger in motion
            </span>
            <span className="sm:hidden">Product video</span>
            <span className="mx-1 hidden h-3 w-px bg-white/25 sm:block" />
            <span className="text-cyan-100">96-second loop</span>
          </div>
        </div>

        <div className="landing-video-actions">
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/16"
            type="button"
            onClick={togglePlayback}
            aria-pressed={isPaused}
          >
            {isPaused ? "Play video" : "Pause video"}
          </button>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/16"
            type="button"
            onClick={showFullscreen}
          >
            Full screen
          </button>
        </div>

        <a className="landing-scroll-cue" href="#hero">
          <span>Scroll to the hero section</span>
          <span aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function Hero({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  return (
    <section id="hero" className="relative overflow-hidden">
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
            <span className="hidden sm:inline">
              Free 30-day trial - no card required
            </span>
            <span className="sm:hidden">30-day trial - no card</span>
            <span className="mx-1 hidden h-3 w-px bg-border sm:block" />
            <span className="text-brand">Try workspace -&gt;</span>
          </div>
          <h1 className="mt-6 max-w-[calc(100vw-2rem)] text-left font-display text-[26px] font-extrabold leading-[1.05] tracking-tight text-ink min-[380px]:text-[28px] sm:text-5xl lg:max-w-4xl lg:text-[56px] 2xl:text-[62px]">
            <span className="block 2xl:whitespace-nowrap">
              Pharmacy Operations
            </span>
            <span className="block text-brand">audited by default.</span>
          </h1>
          <p className="mt-5 max-w-[17rem] text-base leading-relaxed text-ink-soft min-[380px]:max-w-[18rem] sm:max-w-2xl sm:text-lg 2xl:text-xl">
            RxLedger is the multi-tenant workspace for community pharmacies,
            hospital dispensaries, and multi-branch retailers - FEFO inventory,
            POS checkout, role-based access, and clean day-end reconciliation in
            one calm system.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-brand/90 sm:w-auto"
              type="button"
              onClick={onCreateWorkspace}
            >
              Start free 30-day trial
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface sm:w-auto"
              type="button"
            >
              Book a 20-min demo
            </button>
          </div>
          <ul className="mt-6 flex max-w-[17rem] flex-col items-start justify-start gap-x-5 gap-y-2 text-xs text-ink-soft min-[380px]:max-w-[18rem] sm:max-w-none sm:flex-row sm:flex-wrap">
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand" /> No card to start
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand" /> Setup in under 15
              minutes
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand" /> Cancel anytime
            </li>
          </ul>
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
}

function drawRxLedgerVideoFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
) {
  const progress = elapsedMs / PRODUCT_VIDEO_DURATION_MS;
  const sceneProgress =
    (progress * productVideoScenes.length) % 1;
  const sceneIndex = Math.min(
    productVideoScenes.length - 1,
    Math.floor(progress * productVideoScenes.length),
  );

  drawVideoBackground(context, width, height, sceneIndex, sceneProgress);
  drawProductShell(context, width, height, sceneIndex, sceneProgress);
  drawVideoTimeline(context, width, height, progress, sceneIndex);
}

function drawVideoBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneIndex: number,
  sceneProgress: number,
) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  const hueShift = sceneIndex * 12;
  gradient.addColorStop(0, `hsl(${190 + hueShift} 82% 12%)`);
  gradient.addColorStop(0.52, `hsl(${172 + hueShift} 64% 17%)`);
  gradient.addColorStop(1, "hsl(218 54% 8%)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  drawOrb(context, width * 0.18, height * 0.16, 360, "rgba(34, 211, 238, 0.22)");
  drawOrb(context, width * 0.86, height * 0.2, 300, "rgba(16, 185, 129, 0.18)");
  drawOrb(
    context,
    width * (0.42 + sceneProgress * 0.1),
    height * 0.88,
    520,
    "rgba(255, 255, 255, 0.08)",
  );

  context.fillStyle = "rgba(255, 255, 255, 0.055)";
  for (let index = 0; index < 18; index += 1) {
    const x = ((index * 151 + sceneProgress * 120) % width) - 60;
    const y = 110 + ((index * 73) % 780);
    roundRect(context, x, y, 140, 2, 999);
    context.fill();
  }
}

function drawProductShell(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneIndex: number,
  sceneProgress: number,
) {
  const x = width * 0.14;
  const y = height * 0.13;
  const shellWidth = width * 0.72;
  const shellHeight = height * 0.64;
  const lift = Math.sin(sceneProgress * Math.PI) * 14;

  context.save();
  context.translate(0, -lift);
  context.shadowColor = "rgba(0, 0, 0, 0.38)";
  context.shadowBlur = 46;
  context.shadowOffsetY = 30;
  context.fillStyle = "rgba(248, 250, 252, 0.96)";
  roundRect(context, x, y, shellWidth, shellHeight, 32);
  context.fill();
  context.shadowBlur = 0;

  context.fillStyle = "#07171d";
  roundRect(context, x, y, shellWidth, 70, 32);
  context.fill();
  context.fillRect(x, y + 34, shellWidth, 42);

  context.fillStyle = "#22d3ee";
  context.font = "700 22px Inter, Arial";
  context.fillText("RxLedger", x + 38, y + 45);
  drawDot(context, x + shellWidth - 110, y + 35, "#ef4444");
  drawDot(context, x + shellWidth - 76, y + 35, "#f59e0b");
  drawDot(context, x + shellWidth - 42, y + 35, "#10b981");

  context.fillStyle = "#08232b";
  roundRect(context, x + 26, y + 96, 238, shellHeight - 124, 22);
  context.fill();
  drawSidebarItem(context, x + 54, y + 140, "Dashboard", sceneIndex === 1);
  drawSidebarItem(context, x + 54, y + 196, "Dispense", sceneIndex === 2);
  drawSidebarItem(context, x + 54, y + 252, "Continuity", sceneIndex === 3);
  drawSidebarItem(context, x + 54, y + 308, "Branch stock", sceneIndex === 4);
  drawSidebarItem(context, x + 54, y + 364, "Audit trail", sceneIndex === 5);

  const bodyX = x + 294;
  const bodyY = y + 105;
  const bodyWidth = shellWidth - 326;
  const bodyHeight = shellHeight - 138;
  context.fillStyle = "#f8fafc";
  roundRect(context, bodyX, bodyY, bodyWidth, bodyHeight, 24);
  context.fill();

  if (sceneIndex === 0) {
    drawProblemScene(context, bodyX, bodyY, bodyWidth, bodyHeight, sceneProgress);
  } else if (sceneIndex === 1) {
    drawDashboardScene(context, bodyX, bodyY, bodyWidth, bodyHeight, sceneProgress);
  } else if (sceneIndex === 2) {
    drawDispenseScene(context, bodyX, bodyY, bodyWidth, bodyHeight, sceneProgress);
  } else if (sceneIndex === 3) {
    drawContinuityScene(context, bodyX, bodyY, bodyWidth, bodyHeight, sceneProgress);
  } else if (sceneIndex === 4) {
    drawBranchScene(context, bodyX, bodyY, bodyWidth, bodyHeight, sceneProgress);
  } else {
    drawAuditScene(context, bodyX, bodyY, bodyWidth, bodyHeight, sceneProgress);
  }

  context.restore();
}

function drawProblemScene(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  _height: number,
  progress: number,
) {
  drawSceneTitle(context, x, y, "Before RxLedger", "Stock, patients, and branches live in separate places.");
  const cards = [
    ["Stockout", "Patient owed Metformin 500mg", "#f97316"],
    ["Missed follow-up", "No one knows who to call today", "#ef4444"],
    ["Branch question", "Which location has Augmentin?", "#06b6d4"],
  ];

  cards.forEach(([title, body, color], index) => {
    const cardX = x + 44 + index * (width - 110) / 3;
    const cardY = y + 170 + Math.sin(progress * Math.PI + index) * 8;
    drawCard(context, cardX, cardY, (width - 150) / 3, 220);
    context.fillStyle = color;
    roundRect(context, cardX + 24, cardY + 22, 52, 52, 16);
    context.fill();
    context.fillStyle = "#0f172a";
    context.font = "700 28px Inter, Arial";
    context.fillText(title, cardX + 24, cardY + 104);
    context.fillStyle = "#64748b";
    context.font = "500 21px Inter, Arial";
    wrapCanvasText(context, body, cardX + 24, cardY + 142, (width - 150) / 3 - 48, 28);
  });
}

function drawDashboardScene(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  drawSceneTitle(context, x, y, "Branch command centre", "Owners see what needs attention without calling every location.");
  const metrics = [
    ["Today's sales", "N1.84M", "+12.4%"],
    ["Branches live", "3 / 3", "online"],
    ["Stock risk", "14", "batches"],
  ];

  metrics.forEach(([label, value, delta], index) => {
    drawMetric(context, x + 44 + index * (width - 110) / 3, y + 150, (width - 150) / 3, label, value, delta);
  });

  drawCard(context, x + 44, y + 340, width - 88, height - 386);
  drawMiniBarChart(context, x + 78, y + 390, width * 0.42, 190, progress);
  drawBranchList(context, x + width * 0.58, y + 385, width * 0.31);
}

function drawDispenseScene(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  drawSceneTitle(context, x, y, "FEFO dispensing", "The counter sees the right batch, the patient, and clean counselling text.");
  drawCard(context, x + 44, y + 142, width * 0.52, height - 188);
  drawTableHeader(context, x + 78, y + 194, ["Medicine", "Batch", "Expiry", "Action"]);
  [
    ["Amoxicillin 500mg", "B-2241", "12 Jun 2026", "Dispense first"],
    ["Ventolin inhaler", "B-7710", "22 Nov 2026", "Low"],
    ["Panadol Extra", "B-9021", "12 Jan 2027", "Stable"],
  ].forEach((row, index) => {
    drawTableRow(context, x + 78, y + 250 + index * 72, width * 0.46, row, index === Math.floor(progress * 3) % 3);
  });

  drawCard(context, x + width * 0.62, y + 142, width * 0.31, height - 188);
  context.fillStyle = "#0f172a";
  context.font = "800 28px Inter, Arial";
  context.fillText("Patient memory", x + width * 0.65, y + 204);
  drawPill(context, x + width * 0.65, y + 246, "Avoid alcohol counselling", "#fef3c7", "#92400e");
  drawPill(context, x + width * 0.65, y + 304, "Take with food", "#dcfce7", "#166534");
  drawPill(context, x + width * 0.65, y + 362, "Previous antibiotic: 21 days ago", "#e0f2fe", "#075985");
}

function drawContinuityScene(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  drawSceneTitle(context, x, y, "Continuity Centre", "Pending medicine becomes a focused action queue, not noisy notifications.");
  drawCard(context, x + 44, y + 142, width - 88, height - 188);
  const tasks = [
    ["Metformin 500mg", "3 patients waiting", "Stock now available"],
    ["Aprovel 150mg", "1 refill due", "Call patient today"],
    ["Natrilix SR", "2 owed balances", "Request from VI branch"],
  ];

  tasks.forEach((task, index) => {
    const rowY = y + 196 + index * 112;
    const active = index === Math.floor(progress * 3) % 3;
    context.fillStyle = active ? "#ecfeff" : "#ffffff";
    roundRect(context, x + 78, rowY, width - 156, 82, 20);
    context.fill();
    context.strokeStyle = active ? "#06b6d4" : "#dbe7ea";
    context.stroke();
    context.fillStyle = "#0f172a";
    context.font = "800 25px Inter, Arial";
    context.fillText(task[0], x + 104, rowY + 36);
    context.fillStyle = "#64748b";
    context.font = "600 19px Inter, Arial";
    context.fillText(`${task[1]} - ${task[2]}`, x + 104, rowY + 64);
    drawPill(context, x + width - 265, rowY + 24, active ? "Review now" : "Queued", active ? "#0f766e" : "#f1f5f9", active ? "#ffffff" : "#475569");
  });
}

function drawBranchScene(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  drawSceneTitle(context, x, y, "Closest branch with stock", "When one shelf is empty, RxLedger helps the pharmacist find the next best option.");
  drawCard(context, x + 44, y + 142, width * 0.47, height - 188);
  drawMap(context, x + 78, y + 182, width * 0.4, height - 270, progress);

  drawCard(context, x + width * 0.57, y + 142, width * 0.36, height - 188);
  [
    ["VI Branch", "2.4km", "18 packs"],
    ["Lekki Branch", "4.1km", "6 packs"],
    ["Ikeja Branch", "12.8km", "32 packs"],
  ].forEach((branch, index) => {
    const rowY = y + 204 + index * 96;
    context.fillStyle = index === 0 ? "#ecfdf5" : "#ffffff";
    roundRect(context, x + width * 0.6, rowY, width * 0.3, 68, 18);
    context.fill();
    context.fillStyle = "#0f172a";
    context.font = "800 23px Inter, Arial";
    context.fillText(branch[0], x + width * 0.62, rowY + 30);
    context.fillStyle = "#64748b";
    context.font = "600 18px Inter, Arial";
    context.fillText(`${branch[1]} - ${branch[2]}`, x + width * 0.62, rowY + 56);
  });
}

function drawAuditScene(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  drawSceneTitle(context, x, y, "Accountability built in", "Every role, receipt, adjustment, and review note stays traceable.");
  drawCard(context, x + 44, y + 142, width - 88, height - 188);
  drawMiniBarChart(context, x + 84, y + 205, width * 0.34, 240, progress);
  const audit = [
    "Superintendent pharmacist approved controlled medicine review",
    "Inventory officer received 14 batches at Lekki branch",
    "Cashier closed shift with balanced reconciliation",
    "Pharmacist noted counselling: do not take with alcohol",
  ];

  audit.forEach((item, index) => {
    const rowY = y + 190 + index * 78;
    drawDot(context, x + width * 0.52, rowY + 14, index === 0 ? "#06b6d4" : "#10b981");
    context.fillStyle = "#0f172a";
    context.font = "700 20px Inter, Arial";
    wrapCanvasText(context, item, x + width * 0.55, rowY + 20, width * 0.34, 25);
  });
}

function drawVideoTimeline(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  sceneIndex: number,
) {
  const x = width * 0.14;
  const y = height * 0.83;
  const timelineWidth = width * 0.72;
  context.fillStyle = "rgba(255, 255, 255, 0.2)";
  roundRect(context, x, y, timelineWidth, 8, 999);
  context.fill();
  context.fillStyle = "#22d3ee";
  roundRect(context, x, y, timelineWidth * progress, 8, 999);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "700 19px Inter, Arial";
  context.fillText(productVideoScenes[sceneIndex].title, x, y + 46);
}

function drawSceneTitle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  body: string,
) {
  context.fillStyle = "#0f172a";
  context.font = "900 34px Inter, Arial";
  context.fillText(title, x + 44, y + 68);
  context.fillStyle = "#64748b";
  context.font = "600 21px Inter, Arial";
  context.fillText(body, x + 44, y + 104);
}

function drawCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = "#ffffff";
  roundRect(context, x, y, width, height, 24);
  context.fill();
  context.strokeStyle = "#dbe7ea";
  context.lineWidth = 2;
  context.stroke();
}

function drawMetric(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  delta: string,
) {
  drawCard(context, x, y, width, 130);
  context.fillStyle = "#64748b";
  context.font = "700 16px Inter, Arial";
  context.fillText(label, x + 24, y + 38);
  context.fillStyle = "#0f172a";
  context.font = "900 34px Inter, Arial";
  context.fillText(value, x + 24, y + 84);
  drawPill(context, x + width - 118, y + 28, delta, "#dcfce7", "#166534");
}

function drawSidebarItem(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  active: boolean,
) {
  context.fillStyle = active ? "rgba(34, 211, 238, 0.18)" : "transparent";
  roundRect(context, x - 18, y - 24, 174, 42, 14);
  context.fill();
  context.fillStyle = active ? "#ffffff" : "rgba(226, 232, 240, 0.72)";
  context.font = "700 19px Inter, Arial";
  context.fillText(label, x, y);
}

function drawTableHeader(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  labels: string[],
) {
  context.fillStyle = "#64748b";
  context.font = "800 15px Inter, Arial";
  labels.forEach((label, index) => {
    context.fillText(label, x + index * 158, y);
  });
}

function drawTableRow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  values: string[],
  active: boolean,
) {
  context.fillStyle = active ? "#ecfeff" : "#ffffff";
  roundRect(context, x - 14, y - 30, width, 56, 16);
  context.fill();
  context.fillStyle = "#0f172a";
  context.font = "700 18px Inter, Arial";
  values.forEach((value, index) => {
    context.fillText(value, x + index * 158, y);
  });
}

function drawMiniBarChart(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  const values = [0.46, 0.72, 0.54, 0.86, 0.68, 0.92, 0.76];
  const barWidth = width / values.length - 16;
  values.forEach((value, index) => {
    const animated = Math.min(1, progress * 2 + index * 0.06);
    const barHeight = height * value * animated;
    context.fillStyle = index % 2 === 0 ? "#0891b2" : "#10b981";
    roundRect(context, x + index * (barWidth + 16), y + height - barHeight, barWidth, barHeight, 10);
    context.fill();
  });
}

function drawBranchList(context: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ["Lekki - stable", "VI - stock risk", "Ikeja - high demand"].forEach((label, index) => {
    context.fillStyle = index === 1 ? "#fef3c7" : "#f8fafc";
    roundRect(context, x, y + index * 68, width, 48, 14);
    context.fill();
    context.fillStyle = "#0f172a";
    context.font = "700 18px Inter, Arial";
    context.fillText(label, x + 18, y + 31 + index * 68);
  });
}

function drawMap(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
) {
  context.fillStyle = "#e0f2fe";
  roundRect(context, x, y, width, height, 22);
  context.fill();
  context.strokeStyle = "rgba(8, 145, 178, 0.22)";
  context.lineWidth = 4;
  for (let index = 0; index < 5; index += 1) {
    context.beginPath();
    context.moveTo(x + 30, y + 40 + index * 58);
    context.bezierCurveTo(x + width * 0.4, y + 80 + index * 36, x + width * 0.58, y - 20 + index * 82, x + width - 30, y + 70 + index * 42);
    context.stroke();
  }
  drawMapPin(context, x + width * 0.42, y + height * 0.48, "#ef4444", "You");
  drawMapPin(context, x + width * (0.62 + Math.sin(progress * Math.PI) * 0.03), y + height * 0.34, "#10b981", "VI");
  drawMapPin(context, x + width * 0.74, y + height * 0.62, "#0891b2", "Lekki");
}

function drawMapPin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  label: string,
) {
  drawDot(context, x, y, color);
  context.fillStyle = "#0f172a";
  context.font = "800 17px Inter, Arial";
  context.fillText(label, x + 16, y + 6);
}

function drawPill(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  background: string,
  color: string,
) {
  const width = Math.max(92, label.length * 9 + 34);
  context.fillStyle = background;
  roundRect(context, x, y, width, 36, 999);
  context.fill();
  context.fillStyle = color;
  context.font = "800 15px Inter, Arial";
  context.fillText(label, x + 17, y + 23);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;

  words.forEach((word) => {
    const testLine = `${line}${word} `;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, lineY);
      line = `${word} `;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  });

  context.fillText(line, x, lineY);
}

function drawOrb(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawDot(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 10, 0, Math.PI * 2);
  context.fill();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

/* ---------------- Dashboard Preview (software preview, merged from v1+v2+v3) ---------------- */
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
        <div className="grid grid-cols-3 gap-3 p-4">
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
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold text-ink">
                FEFO queue · dispense next
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                batch ledger
              </span>
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
            <span className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {it.value}
            </span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
              {it.label}
            </span>
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
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">
          The platform
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Commercial memory for modern pharmacy work.
        </h2>
        <p className="mt-3 text-ink-soft">
          The rigor of a clinical ledger with the speed of a modern POS — built
          for the daily realities of multi-branch pharmacy operations.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[auto_auto] md:gap-5">
        {/* Big card — FEFO */}
        <FeatureCard className="md:col-span-2 md:row-span-1" tone="light">
          <div className="flex items-start gap-3">
            <FeatureIcon>
              <Boxes className="size-5" />
            </FeatureIcon>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand">
                Inventory ledger
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-ink">
                Full FEFO discipline, enforced at the counter.
              </h3>
              <p className="mt-2 max-w-md text-sm text-ink-soft">
                System-enforced first-expiry-first-out. The POS surfaces the
                right batch automatically, so near-expiry stock leaves the shelf
                before it leaves your margin.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {[
              "Batch tracking",
              "Auto-sorting",
              "Wastage logs",
              "Reorder risk",
            ].map((t) => (
              <span
                key={t}
                className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        </FeatureCard>

        {/* Dark card — Multi-branch */}
        <FeatureCard tone="dark">
          <FeatureIcon dark>
            <Building2 className="size-5" />
          </FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand-soft">
            Multi-branch
          </p>
          <h3 className="mt-1 font-display text-xl font-bold text-primary-foreground">
            Total visibility, branch by branch.
          </h3>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Monitor stock and reconciliation across every location from a single
            admin workspace.
          </p>
        </FeatureCard>

        {/* POS */}
        <FeatureCard tone="light">
          <FeatureIcon>
            <Receipt className="size-5" />
          </FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand">
            POS checkout
          </p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">
            Customer memory, clean receipts.
          </h3>
          <p className="mt-2 text-sm text-ink-soft">
            Discounts, refunds, and split items handled fast — every sale tied
            to the staff who rang it.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Patient details, label instructions, and follow-up notes can stay
            attached to the sale.
          </p>
        </FeatureCard>

        {/* Audit */}
        <FeatureCard tone="light">
          <FeatureIcon>
            <ShieldCheck className="size-5" />
          </FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand">
            Pricing control
          </p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">
            Margins protected by default.
          </h3>
          <p className="mt-2 text-sm text-ink-soft">
            Every dispense, transfer, and price edit logged with timestamp and
            staff ID — court-ready by default.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Auto pricing links least-unit cost to markup rules, rounding,
            warnings, and admin overrides.
          </p>
        </FeatureCard>

        {/* Roles */}
        <FeatureCard tone="light">
          <FeatureIcon>
            <Lock className="size-5" />
          </FeatureIcon>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-brand">
            Role-based access
          </p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">
            Right tools, right people.
          </h3>
          <p className="mt-2 text-sm text-ink-soft">
            Cashiers, pharmacists, managers, admins — each role sees only what
            it needs.
          </p>
        </FeatureCard>
      </div>
    </section>
  );
}

function FeatureCard({
  children,
  className = "",
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone: "light" | "dark";
}) {
  const base =
    tone === "dark"
      ? "bg-ink text-primary-foreground border-ink"
      : "bg-card text-ink border-border";
  return (
    <div
      className={`group rounded-2xl border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${base} ${className}`}
    >
      {children}
    </div>
  );
}

function FeatureIcon({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`grid size-10 place-items-center rounded-lg ${dark ? "bg-white/10 text-primary-foreground" : "bg-brand-soft text-brand"}`}
    >
      {children}
    </div>
  );
}

/* ---------------- A day at the counter ---------------- */
function DayInLife() {
  const steps = [
    {
      time: "08:00",
      icon: <Sunrise className="size-4" />,
      title: "Open & reconcile",
      body: "Confirm yesterday's close, verify till float, and pick up alerts from overnight.",
    },
    {
      time: "11:30",
      icon: <ScanLine className="size-4" />,
      title: "Receive new stock",
      body: "Review invoice lines, packaging units, final unit cost, selling price, and warnings before posting stock.",
    },
    {
      time: "13:10",
      icon: <Receipt className="size-4" />,
      title: "Sell at the POS",
      body: "Pharmacist rings up items, attaches the customer, prints labels, and keeps follow-up in one sale record.",
    },
    {
      time: "15:45",
      icon: <ArrowLeftRight className="size-4" />,
      title: "Inter-branch transfer",
      body: "Low stock at Surulere? Move from Lekki in two taps — both ledgers update at once.",
    },
    {
      time: "20:30",
      icon: <ClipboardCheck className="size-4" />,
      title: "Day-end reconciliation",
      body: "Cash, card, transfer matched against the ledger. Close the day in under five minutes.",
    },
    {
      time: "20:45",
      icon: <Moon className="size-4" />,
      title: "Lock & sleep",
      body: "Roles revoke automatically. The next shift wakes to a clean, verified ledger.",
    },
  ];
  return (
    <section id="why" className="bg-surface/60 py-24">
      <div className="landing-container">
        <div className="max-w-2xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">
            A day with RxLedger
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            From opening shift to lock-up — one calm rhythm.
          </h2>
          <p className="mt-3 text-ink-soft">
            RxLedger mirrors the natural workflow of a pharmacy team, so the
            software disappears behind the work.
          </p>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-md bg-brand-soft text-brand">
                  {s.icon}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                  Step {String(i + 1).padStart(2, "0")} · {s.time}
                </span>
              </div>
              <h4 className="mt-3 font-display text-base font-bold text-ink">
                {s.title}
              </h4>
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
    {
      name: "Admin",
      sees: "Workspace, branches, billing, audit logs, every record.",
    },
    {
      name: "Manager",
      sees: "Branch dashboards, stock health, staff performance, reports.",
    },
    {
      name: "Pharmacist",
      sees: "Dispense queue, FEFO alerts, controlled-drug register.",
    },
    {
      name: "Inventory Officer",
      sees: "Stock receiving, batch records, reorder alerts, and inventory movement logs.",
    },
    {
      name: "Cashier",
      sees: "POS, saved prices, receipts, end-of-shift cash count.",
    },
  ];
  return (
    <section className="landing-container py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">
          Security model
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Defined roles. Absolute audit trail.
        </h2>
        <p className="mt-3 text-ink-soft">
          Company lists stay private. Each role sees the tools meant for them —
          nothing more, nothing less.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {roles.map((r, i) => (
          <div
            key={r.name}
            className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand"
          >
            <div className="flex items-center justify-between">
              <Users className="size-4 text-brand" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h4 className="mt-4 font-display text-lg font-bold text-ink">
              {r.name}
            </h4>
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
            <div className="grid size-12 place-items-center rounded-full bg-ink font-display text-sm font-bold text-primary-foreground shadow-sm">
              {active.initials}
            </div>
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
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>(
    {},
  );
  const previewFeatureCount = 3;

  return (
    <section id="pricing" className="landing-container py-24">
      <div className="mx-auto max-w-3xl text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">
          Pricing
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Honest pricing. Start free for 30 days.
        </h2>
        <p className="mt-3 text-ink-soft">{trialPolicy.summary}</p>
      </div>
      <div className="mt-12 grid items-start gap-5 md:grid-cols-3">
        {subscriptionPlans.map((t) => {
          const expanded = Boolean(expandedPlans[t.id]);
          const previewFeatures = t.features.slice(0, previewFeatureCount);
          const hiddenFeatureCount = Math.max(
            0,
            t.features.length - previewFeatureCount,
          );
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
              <h3 className="font-display text-lg font-bold text-ink">
                {t.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {t.summary}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold tracking-tight text-ink">
                  {t.price}
                </span>
                <span className="text-sm text-ink-soft">{t.per}</span>
              </div>
              <div className="mt-5 rounded-lg border border-border bg-surface/60 p-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
                  Plan boundary
                </p>
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
                {expanded &&
                  t.features.slice(previewFeatureCount).map((f) => (
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
                  onClick={() =>
                    setExpandedPlans((plans) => ({
                      ...plans,
                      [t.id]: !expanded,
                    }))
                  }
                >
                  {expanded ? "View less" : "View more"}
                </button>
              )}
              <button
                className={`mt-5 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-all ${t.highlight ? "bg-brand text-primary-foreground hover:bg-brand/90" : "border border-border bg-background text-ink hover:bg-surface"}`}
              >
                {t.cta}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-surface/60 p-5 text-sm leading-relaxed text-ink-soft">
        <strong className="text-ink">Plan changes are safe.</strong>{" "}
        {planChangePolicy.dataRetention} {planChangePolicy.downgrade}
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
function FAQ() {
  const qs = [
    {
      q: "Do I need to install anything?",
      a: "No. RxLedger is a web workspace — open it from any browser at the counter or back office. We do recommend a thermal receipt printer for POS.",
    },
    {
      q: "How does the free trial work?",
      a: "30 days, no card. You get Smart Pharmacy features during trial. After 30 days you choose a plan, or your workspace gracefully pauses. Your data is never deleted.",
    },
    {
      q: "Can I switch plans later?",
      a: "Yes. Upgrades are immediate. Downgrades are allowed when your active branches and staff fit the lower plan; extra records can be archived or exported first, but stock, sales, patient, branch, and audit history stays preserved.",
    },
    {
      q: "Is my pharmacy's data private?",
      a: "Yes. Each workspace is fully isolated. Company lists stay private — staff only see their pharmacy after entering the access code from their admin.",
    },
    {
      q: "Can I migrate from spreadsheets or another POS?",
      a: "Yes. Send us your stock and price lists in CSV or Excel — our onboarding team imports them and verifies opening balances with you before you go live.",
    },
    {
      q: "Does it work offline?",
      a: "POS continues to ring sales if your internet drops; transactions sync the moment connectivity returns. Inventory edits require connection to preserve the audit trail.",
    },
  ];
  return (
    <section id="faq" className="bg-surface/60 py-24">
      <div className="landing-container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">
            FAQ
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Answers before you sign up.
          </h2>
          <p className="mt-3 text-ink-soft">
            Still unsure? Email{" "}
            <a
              className="text-brand underline-offset-4 hover:underline"
              href="mailto:support@rxledger.com"
            >
              support@rxledger.com
            </a>{" "}
            — a pharmacist on our team replies within a business day.
          </p>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {qs.map((item) => (
            <details
              key={item.q}
              className="group p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-semibold text-ink">
                {item.q}
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-border text-ink-soft transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {item.a}
              </p>
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
      <div className="relative overflow-hidden rounded-3xl bg-brand p-10 text-primary-foreground md:p-16">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 size-72 rounded-full opacity-40 blur-3xl"
          style={{
            background: "color-mix(in oklab, var(--accent-2) 80%, transparent)",
          }}
        />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Bring RxLedger into your pharmacy workflow.
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Spin up a workspace in minutes. Import your stock. Hand the right
            tools to the right people. Free for the first 30 days — no card
            required.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-background px-5 text-sm font-semibold text-ink shadow-sm transition-transform hover:scale-[1.02]"
              type="button"
              onClick={onCreateWorkspace}
            >
              Create pharmacy workspace
              <ArrowRight className="size-4" />
            </button>
            <button
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-primary-foreground/30 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
              type="button"
            >
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
            <span className="font-display text-lg font-extrabold tracking-tight">
              RxLedger
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-ink-soft">
            Auditable operations for community pharmacies and multi-branch
            medicine retailers. Built for pharmacies that cannot afford
            guesswork.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            "Inventory ledger",
            "POS checkout",
            "Multi-branch",
            "Audit trail",
            "Roles",
          ]}
        />
        <FooterCol
          title="Company"
          links={["About", "Security", "Compliance", "Contact"]}
        />
        <FooterCol
          title="Resources"
          links={["Help center", "Onboarding", "Status", "Changelog"]}
        />
      </div>
      <div className="border-t border-border">
        <div className="landing-container flex flex-col items-center justify-between gap-3 py-6 text-xs text-ink-soft md:flex-row">
          <span className="font-mono uppercase tracking-widest">
            © 2026 RxLedger Technologies
          </span>
          <div className="flex items-center gap-5">
            <a href="mailto:support@rxledger.com" className="hover:text-ink">
              support@rxledger.com
            </a>
            <a href="https://x.com/rxledger" className="hover:text-ink">
              Twitter
            </a>
            <a
              href="https://linkedin.com/company/rxledger"
              className="hover:text-ink"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink">
        {title}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="transition-colors hover:text-ink">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
