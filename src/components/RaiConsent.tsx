import { useEffect, useState } from 'react';

const callback = 'https://rai-mu.vercel.app/api/rai/callback';
const labels: Record<string, string> = { inventory_analytics: 'Stock and inventory', sales_analytics: 'Sales analytics', financial_analytics: 'Costs and profit', continuity_analytics: 'Aggregated patient demand' };
type Options = { branches: Array<{ id: string; name: string }>; capabilities: string[] };

export function RaiConsent({ tenant }: { tenant: string }) {
  const [options, setOptions] = useState<Options>();
  const [branches, setBranches] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state') || '', challenge = params.get('code_challenge') || '';
  const valid = params.get('redirect_uri') === callback && /^[A-Za-z0-9_-]{43}$/.test(state) && /^[A-Za-z0-9_-]{43}$/.test(challenge);
  async function call(body: Record<string, unknown>) {
    const response = await fetch('/api/rai/connection', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenant_id: tenant }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Connection unavailable.');
    return result.data;
  }
  useEffect(() => {
    if (!valid) return;
    let active = true;
    void call({ action: 'options' }).then((data: Options) => { if (active) setOptions(data); }).catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [tenant, valid]);
  function deny() { const target = new URL(callback); target.search = new URLSearchParams({ state, error: 'access_denied' }).toString(); window.location.assign(target.href); }
  async function approve() {
    setBusy(true); setError('');
    try {
      const result = await call({ action: 'authorize', confirmed: true, branch_ids: branches, capabilities, redirect_uri: callback, code_challenge: challenge, code_challenge_method: 'S256' });
      const target = new URL(callback); target.search = new URLSearchParams({ state, code: result.code }).toString(); window.location.assign(target.href);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection unavailable.'); setBusy(false); }
  }
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  return <main style={{ maxWidth: 560, margin: '48px auto', padding: 24 }}><h1>Connect Rai to RxLedger</h1><p>Workspace: <strong>{tenant}</strong></p><p>Rai can read only the branches and analytics you approve. It cannot change stock, sales, prescriptions or patient records. Connection expires after 15 minutes or when your RxLedger session ends.</p>{!valid ? <p role="alert">Invalid connection request. Start again from Rai.</p> : <>{options ? <><fieldset disabled={busy}><legend>Branches</legend>{options.branches.map(branch => <label key={branch.id} style={{ display: 'block', padding: 8 }}><input type="checkbox" checked={branches.includes(branch.id)} onChange={() => setBranches(toggle(branches, branch.id))} /> {branch.name}</label>)}</fieldset><fieldset disabled={busy}><legend>Read-only analytics</legend>{options.capabilities.map(capability => <label key={capability} style={{ display: 'block', padding: 8 }}><input type="checkbox" checked={capabilities.includes(capability)} onChange={() => setCapabilities(toggle(capabilities, capability))} /> {labels[capability]}</label>)}</fieldset></> : <p>Checking your access...</p>}{error && <p role="alert">{error}</p>}<div style={{ display: 'flex', gap: 12, marginTop: 24 }}><button disabled={busy || !branches.length || !capabilities.length} onClick={() => { void approve(); }}>Approve read-only connection</button><button disabled={busy} onClick={deny}>Deny</button></div></>}</main>;
}
