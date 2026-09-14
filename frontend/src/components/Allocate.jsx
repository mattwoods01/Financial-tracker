import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../api";

const fmt = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

function suggestedRothPercent(grossAnnualSalary) {
  if (grossAnnualSalary <= 50000) return 100;
  if (grossAnnualSalary <= 120000) return 70;
  if (grossAnnualSalary <= 200000) return 40;
  return 15;
}

const FIELDS = [
  ["Gross annual salary ($)", "gross_annual_salary", "1"],
  ["Monthly take-home pay ($)", "monthly_take_home", "1"],
  ["Manual monthly expenses ($, used if no transactions)", "monthly_expenses_manual", "1"],
  ["Current 401(k) contribution (% of salary)", "current_contribution_percent", "0.5"],
  ["Employer match caps out at (% of salary)", "employer_match_limit", "0.5"],
  ["Age", "age", "1"],
  ["Emergency fund balance ($)", "emergency_fund_balance", "1"],
  ["Emergency fund target (months of expenses)", "emergency_fund_target_months", "1"],
];

export default function Allocate({ token }) {
  const [settings, setSettings] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [s, a] = await Promise.all([api.getSettings(token), api.getAllocation(token)]);
      setSettings(s);
      setAllocation(a);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(token, settings);
      setSettings(updated);
      setAllocation(await api.getAllocation(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="panel"><p className="empty-note">Loading…</p></div>;
  if (!settings) return <div className="panel"><p className="auth-error">{error}</p></div>;

  const maxAmt = allocation ? Math.max(...allocation.steps.map((s) => s.amount), 1) : 1;

  const field = (label, key, step) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={settings[key]}
        onChange={(e) => setSettings({ ...settings, [key]: parseFloat(e.target.value) || 0 })}
      />
    </label>
  );

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Allocate</h1>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <h2 className="section-title">Your numbers</h2>
      <div className="field-grid">
        {FIELDS.map(([label, key, step]) => field(label, key, step))}
        {field("Roth % of new 401(k) contributions", "roth_percent", "5")}
      </div>
      <p className="empty-note" style={{ marginTop: 8 }}>
        Rough starting point at this salary: <strong className="mono">{suggestedRothPercent(settings.gross_annual_salary)}% Roth</strong>.
        Lower earners often lean Roth; higher earners often lean Traditional. Adjust the field above to your own split.
      </p>
      <button className="btn-secondary" onClick={save} disabled={saving}>
        <Save size={14} /> {saving ? "Saving…" : "Save numbers"}
      </button>

      <h2 className="section-title" style={{ marginTop: 32 }}>Recommended monthly split</h2>
      {allocation && (
        <>
          <p className="empty-note" style={{ marginBottom: 16 }}>
            Available surplus this month: <strong className="mono">{fmt(allocation.surplus)}</strong> (income minus expenses, before this allocation).
          </p>
          <div className="waterfall">
            {allocation.steps.map((s) => (
              <div className="waterfall-row" key={s.key}>
                <div className="waterfall-label">
                  <span>{s.label}</span>
                  <span className="mono">{fmt(s.amount)}</span>
                </div>
                <div className="waterfall-bar-track">
                  <div className="waterfall-bar-fill" style={{ width: `${(s.amount / maxAmt) * 100}%` }} />
                </div>
                {s.roth_amount != null && s.amount > 0 && (
                  <div className="roth-split">
                    <span>Roth: <span className="mono">{fmt(s.roth_amount)}</span></span>
                    <span>Traditional: <span className="mono">{fmt(s.traditional_amount)}</span></span>
                  </div>
                )}
                <p className="waterfall-note">{s.note}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="disclaimer">
        This is a general rule-of-thumb waterfall (capture the match, then pay down high-interest debt, build a
        cash cushion, use tax-advantaged room, then taxable investing) — not personalized financial advice.
      </p>
    </div>
  );
}
