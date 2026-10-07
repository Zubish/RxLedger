import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { checkCompanySlug } from "../api";
import { slugifyCompany } from "../company";
import type { AppSettings, RegisterInput, SetupInput } from "../types";
import { BrandMark, RxLedgerLogo } from "./Branding";

type AuthMode = "login" | "register" | "reset" | "setup";

type PasswordResetInput = {
  email: string;
  phone: string;
};

type PasswordResetCompleteInput = {
  email: string;
  code: string;
  password: string;
};

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  minLength,
  full = false,
  required = true,
  showToggle = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle?: () => void;
  autoComplete?: string;
  minLength?: number;
  full?: boolean;
  required?: boolean;
  showToggle?: boolean;
}) {
  return (
    <label className={full ? "password-field full" : "password-field"}>
      {label}
      <span className="password-control">
        <input
          required={required}
          type={visible ? "text" : "password"}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={visible ? "Hide password" : "Show password"}
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
    </label>
  );
}

export function AuthScreen({
  hasUsers,
  tenantExists,
  companySlug,
  settings,
  connectionError,
  createFirstAdmin,
  login,
  registerUser,
  requestPasswordReset,
  completePasswordReset,
  selectWorkspace,
  backToLanding,
}: {
  hasUsers: boolean;
  tenantExists: boolean;
  companySlug: string;
  settings: AppSettings;
  connectionError: string;
  createFirstAdmin: (input: SetupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  registerUser: (input: RegisterInput) => Promise<void>;
  requestPasswordReset: (
    input: PasswordResetInput,
  ) => Promise<{ ok: boolean; emailConfigured: boolean }>;
  completePasswordReset: (input: PasswordResetCompleteInput) => Promise<void>;
  selectWorkspace: (value: string) => Promise<void>;
  backToLanding?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(hasUsers ? "login" : "setup");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const workspaceSelected = Boolean(companySlug && tenantExists);
  const activeMode: AuthMode = tenantExists && hasUsers ? mode : "setup";
  const companyName =
    settings.accountName || settings.pharmacyName || "Your pharmacy";
  const authTitle =
    activeMode === "setup"
      ? "Create your pharmacy workspace"
      : activeMode === "register"
        ? workspaceSelected
          ? `Request access to ${companyName}`
          : "Request workspace access"
        : activeMode === "reset"
          ? "Reset your password"
          : workspaceSelected
            ? `Sign in to ${companyName}`
            : "Sign in to RxLedger";
  const authCopy =
    activeMode === "setup"
      ? "Start your pharmacy workspace with just your email and password."
      : activeMode === "register"
        ? workspaceSelected
          ? "Submit your staff details for admin review."
          : "Find your company workspace before requesting access."
        : activeMode === "reset"
          ? workspaceSelected
            ? "Confirm your staff email and phone number before changing your password."
            : "Find your company workspace before resetting your password."
          : workspaceSelected
            ? "Use your approved staff credentials to continue."
            : "Find your company workspace before entering your staff credentials.";

  return (
    <main className="login-screen">
      <section className="login-panel auth-panel">
        {activeMode === "setup" || !workspaceSelected ? (
          <RxLedgerLogo size="large" />
        ) : (
          <BrandMark settings={settings} size="large" />
        )}
        <div>
          <span className="eyebrow">
            {activeMode === "setup" || !workspaceSelected
              ? "RxLedger"
              : companyName}
          </span>
          <h1>{authTitle}</h1>
          <p>{authCopy}</p>
        </div>
        {backToLanding && (
          <button
            className="ghost-button"
            type="button"
            onClick={backToLanding}
          >
            <ChevronLeft size={16} />
            Back to RxLedger
          </button>
        )}

        {activeMode !== "setup" && (
          <div className="tabs auth-tabs">
            <button
              className={activeMode === "login" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
            >
              Sign in
            </button>
            <button
              className={activeMode === "register" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setSuccess("");
              }}
            >
              Request access
            </button>
            <button
              className={activeMode === "reset" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("reset");
                setError("");
                setSuccess("");
              }}
            >
              Forgot password
            </button>
          </div>
        )}

        {activeMode === "setup" && (
          <SetupForm
            createFirstAdmin={createFirstAdmin}
            setError={setError}
          />
        )}
        {activeMode !== "setup" && (
          <WorkspaceFinder
            companySlug={companySlug}
            settings={settings}
            workspaceSelected={workspaceSelected}
            selectWorkspace={selectWorkspace}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}
        {activeMode === "login" && workspaceSelected && (
          <LoginForm
            login={login}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}
        {activeMode === "register" && workspaceSelected && (
          <RegisterForm
            registerUser={registerUser}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}
        {activeMode === "reset" && workspaceSelected && (
          <PasswordResetForm
            requestPasswordReset={requestPasswordReset}
            completePasswordReset={completePasswordReset}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}

        {connectionError && <div className="form-error">{connectionError}</div>}
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
      </section>
    </main>
  );
}

function WorkspaceFinder({
  companySlug,
  settings,
  workspaceSelected,
  selectWorkspace,
  setError,
  setSuccess,
}: {
  companySlug: string;
  settings: AppSettings;
  workspaceSelected: boolean;
  selectWorkspace: (value: string) => Promise<void>;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}) {
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const companyName =
    settings.accountName || settings.pharmacyName || "Your pharmacy";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = workspaceQuery.trim();
    setError("");
    setSuccess("");
    if (!value) {
      setError("Enter your company access code or unique URL.");
      return;
    }
    setChecking(true);
    try {
      await selectWorkspace(value);
      setSuccess("Workspace found. Enter your login details to continue.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to find that company workspace.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="workspace-finder" aria-label="Find your company">
      <form className="workspace-finder-form" onSubmit={submit}>
        <h2>Find your company</h2>
        <p>
          Enter your company's unique url or code, provided by your admin to
          find your company's workspace.
        </p>
        <label className="sr-only" htmlFor="workspace-access-code">
          Company access code
        </label>
        <input
          id="workspace-access-code"
          required
          value={workspaceQuery}
          onChange={(event) => setWorkspaceQuery(event.target.value)}
          placeholder="Company access code"
          autoComplete="organization"
        />
        <button className="primary-button" type="submit" disabled={checking}>
          {checking ? "Checking..." : "Continue"}
        </button>
      </form>
      {workspaceSelected && (
        <div className="workspace-confirmation" aria-live="polite">
          <BrandMark settings={settings} />
          <div>
            <span>Workspace confirmed</span>
            <strong>{companyName}</strong>
            <small>
              {settings.companyCode
                ? `Code: ${settings.companyCode}`
                : `URL: /${companySlug}`}
            </small>
          </div>
        </div>
      )}
    </section>
  );
}

function SetupForm({
  createFirstAdmin,
  setError,
}: {
  createFirstAdmin: (input: SetupInput) => Promise<void>;
  setError: (message: string) => void;
}) {
  const [form, setForm] = useState<SetupInput>({
    pharmacyName: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    state: "idle" | "checking" | "available" | "taken";
    message: string;
  }>({ state: "idle", message: "" });

  useEffect(() => {
    const slug = slugifyCompany(form.pharmacyName);
    const timeoutId = window.setTimeout(() => {
      if (!slug) {
        setSlugStatus({ state: "idle", message: "" });
        return;
      }
      setSlugStatus({
        state: "checking",
        message: "Checking workspace name...",
      });
      void checkCompanySlug(slug)
        .then((result) => {
          setSlugStatus(
            result.available
              ? {
                  state: "available",
                  message: "This workspace name is available",
                }
              : {
                  state: "taken",
                  message: `This workspace name has already been claimed${result.claimedBy ? ` by ${result.claimedBy}` : ""}`,
                },
          );
        })
        .catch((error) =>
          setSlugStatus({
            state: "taken",
            message:
              error instanceof Error
                ? error.message
                : "Unable to check workspace name",
          }),
        );
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [form.pharmacyName]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const companySlug = slugifyCompany(form.pharmacyName);
    if (!companySlug) {
      setError("Enter a pharmacy/company name.");
      return;
    }
    if (slugStatus.state === "taken") {
      setError(slugStatus.message);
      return;
    }
    await createFirstAdmin(form);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="full">
        Pharmacy name
        <input
          required
          value={form.pharmacyName}
          onChange={(event) =>
            setForm({ ...form, pharmacyName: event.target.value })
          }
          placeholder="Enter your pharmacy name"
          autoComplete="organization"
          autoFocus
        />
      </label>
      {slugStatus.message && (
        <div className={`form-note full slug-${slugStatus.state}`}>
          {slugStatus.message}
        </div>
      )}
      <label className="full">
        Email
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Enter your email address"
          autoComplete="email"
        />
      </label>
      <PasswordInput
        label="Password"
        value={form.password}
        onChange={(password) => setForm({ ...form, password })}
        visible={showPassword}
        onToggle={() => setShowPassword((visible) => !visible)}
        autoComplete="new-password"
        minLength={8}
        full
      />
      <div className="form-actions full">
        <button className="primary-button" type="submit">
          <ShieldCheck size={17} />
          Create RxLedger account
        </button>
      </div>
    </form>
  );
}

function LoginForm({
  login,
  setError,
  setSuccess,
}: {
  login: (email: string, password: string) => Promise<void>;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await login(email, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to log in.");
    }
  }

  return (
    <form className="stack" onSubmit={submit} autoComplete="off">
      <label>
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
      </label>
      <PasswordInput
        label="Password"
        value={password}
        onChange={setPassword}
        visible={showPassword}
        onToggle={() => setShowPassword((visible) => !visible)}
        autoComplete="off"
      />
      <button className="primary-button" type="submit">
        <Lock size={17} />
        Log in
      </button>
    </form>
  );
}

function RegisterForm({
  registerUser,
  setError,
  setSuccess,
}: {
  registerUser: (input: RegisterInput) => Promise<void>;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}) {
  const [form, setForm] = useState<RegisterInput>({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await registerUser(form);
      setForm({ name: "", email: "", phone: "", password: "" });
      setConfirmPassword("");
      setSuccess(
        "Access request submitted. An admin must approve and assign your role before you can sign in.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to submit access request.",
      );
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="full">
        Full name
        <input
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        Email
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </label>
      <label>
        Phone
        <input
          required
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
      </label>
      <PasswordInput
        label="New password"
        value={form.password}
        onChange={(password) => setForm({ ...form, password })}
        visible={showPassword}
        onToggle={() => setShowPassword((visible) => !visible)}
        autoComplete="new-password"
        minLength={8}
        full
      />
      <PasswordInput
        label="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={showPassword}
        autoComplete="new-password"
        minLength={8}
        full
        showToggle={false}
      />
      <div className="form-actions full">
        <button className="primary-button" type="submit">
          <UserPlus size={17} />
          Request access
        </button>
      </div>
    </form>
  );
}

function PasswordResetForm({
  requestPasswordReset,
  completePasswordReset,
  setError,
  setSuccess,
}: {
  requestPasswordReset: (
    input: PasswordResetInput,
  ) => Promise<{ ok: boolean; emailConfigured: boolean }>;
  completePasswordReset: (input: PasswordResetCompleteInput) => Promise<void>;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}) {
  const [form, setForm] = useState<PasswordResetInput>({
    email: "",
    phone: "",
  });
  const [codeRequested, setCodeRequested] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const result = await requestPasswordReset(form);
      setCodeRequested(true);
      setEmailConfigured(result.emailConfigured);
      setSuccess(
        result.emailConfigured
          ? "Reset code sent. Check your email and enter the code below."
          : "Reset request recorded, but email delivery is not configured yet. Add the email keys before live testing this flow.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to request password reset code.",
      );
    }
  }

  async function completeReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await completePasswordReset({ email: form.email, code, password });
      setForm({ email: "", phone: "" });
      setCode("");
      setPassword("");
      setConfirmPassword("");
      setCodeRequested(false);
      setEmailConfigured(false);
      setSuccess(
        "Password changed. You can sign in with the new password now.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to complete password reset.",
      );
    }
  }

  return (
    <form
      className="form-grid"
      onSubmit={codeRequested ? completeReset : requestCode}
    >
      <label className="full">
        Account email
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          autoComplete="username"
          disabled={codeRequested}
        />
      </label>
      <label className="full">
        Phone number on account
        <input
          required
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          disabled={codeRequested}
        />
      </label>
      {codeRequested && (
        <>
          <label>
            Reset code
            <input
              required
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6-digit code"
              autoFocus
            />
          </label>
          <PasswordInput
            label="New password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((visible) => !visible)}
            autoComplete="new-password"
            minLength={8}
          />
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showPassword}
            autoComplete="new-password"
            minLength={8}
            showToggle={false}
          />
          {!emailConfigured && (
            <div className="form-note full">
              Email is not active yet, so no real reset code was delivered.
              This screen is ready for testing once Resend keys are added.
            </div>
          )}
        </>
      )}
      <div className="form-actions full">
        {codeRequested && (
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setCodeRequested(false);
              setCode("");
              setPassword("");
              setConfirmPassword("");
              setError("");
              setSuccess("");
            }}
          >
            Start again
          </button>
        )}
        <button className="primary-button" type="submit">
          <Lock size={17} />
          {codeRequested ? "Change password" : "Send reset code"}
        </button>
      </div>
    </form>
  );
}
