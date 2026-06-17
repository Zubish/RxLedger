import { Pill } from "lucide-react";

import type { AppSettings } from "../types";

export function BrandMark({
  settings,
  size = "normal",
}: {
  settings: AppSettings;
  size?: "normal" | "large";
}) {
  return (
    <div className={size === "large" ? "brand-mark large" : "brand-mark"}>
      {settings.logoDataUrl ? (
        <img src={settings.logoDataUrl} alt={`${settings.accountName} logo`} />
      ) : (
        <Pill size={size === "large" ? 30 : 22} />
      )}
    </div>
  );
}

export function RxLedgerLogo({
  size = "normal",
}: {
  size?: "normal" | "large";
}) {
  return (
    <span
      className={size === "large" ? "rxledger-logo large" : "rxledger-logo"}
    >
      <img src="/favicon.svg" alt="RxLedger logo" />
    </span>
  );
}

export function AppLoadingScreen() {
  return (
    <main className="login-screen">
      <section className="login-panel auth-panel">
        <RxLedgerLogo size="large" />
        <div>
          <span className="eyebrow">RxLedger</span>
          <h1>Opening secure sign in</h1>
          <p>Preparing the app for your workspace.</p>
        </div>
      </section>
    </main>
  );
}

export function WorkspaceLoadingScreen({
  settings,
}: {
  settings: AppSettings;
}) {
  const companyName =
    settings.accountName || settings.pharmacyName || "Your pharmacy";

  return (
    <main className="login-screen">
      <section className="login-panel auth-panel workspace-loading-panel">
        <div className="workspace-loading-rxledger">
          <RxLedgerLogo />
          <span>RxLedger</span>
        </div>
        <div className="workspace-loading-company">
          <BrandMark settings={settings} size="large" />
          <div>
            <span className="eyebrow">Connecting</span>
            <h1>{companyName} workspace</h1>
            <p>Loading your company workspace and preparing your dashboard.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
