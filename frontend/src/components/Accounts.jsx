import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api";

const fmt2 = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_OPTIONS = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "brokerage", label: "Brokerage" },
  { value: "retirement", label: "401(k) / Retirement" },
  { value: "other", label: "Other" },
];

export default function Accounts({ token }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", type: "checking", balance: "", counts_as_emergency_fund: false });

  const load = async () => {
    try {
      setAccounts(await api.getAccounts(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.addAccount(token, {
        name: form.name,
        type: form.type,
        balance: parseFloat(form.balance) || 0,
        counts_as_emergency_fund: form.counts_as_emergency_fund,
      });
      setForm({ name: "", type: "checking", balance: "", counts_as_emergency_fund: false });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteAccount(token, id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  // Local-only edit for text/number fields while typing — committed on blur.
  const editField = (id, field, value) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const commit = async (id) => {
    const acct = accounts.find((a) => a.id === id);
    if (!acct) return;
    try {
      await api.updateAccount(token, id, {
        name: acct.name,
        type: acct.type,
        balance: parseFloat(acct.balance) || 0,
        counts_as_emergency_fund: acct.counts_as_emergency_fund,
      });
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  // Immediate-commit for select/checkbox — builds the merged record explicitly
  // rather than relying on state having already updated by the time we save.
  const patchAndSave = async (id, patch) => {
    const acct = accounts.find((a) => a.id === id);
    if (!acct) return;
    const updated = { ...acct, ...patch };
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    try {
      await api.updateAccount(token, id, {
        name: updated.name,
        type: updated.type,
        balance: parseFloat(updated.balance) || 0,
        counts_as_emergency_fund: updated.counts_as_emergency_fund,
      });
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Accounts</h1>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <form className="account-form" onSubmit={submit}>
        <input
          type="text"
          placeholder="Name (e.g. Chase Checking)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Balance ($)"
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
        />
        <label className="account-form-checkbox">
          <input
            type="checkbox"
            checked={form.counts_as_emergency_fund}
            onChange={(e) => setForm({ ...form, counts_as_emergency_fund: e.target.checked })}
          />
          <span>Counts as emergency fund</span>
        </label>
        <button type="submit" className="btn-primary"><Plus size={15} /> Add</button>
      </form>

      <div className="tx-list">
        <div className="account-list-head">
          <span>Name</span><span>Type</span><span className="right">Balance</span><span className="center">Emergency fund?</span><span></span>
        </div>
        {loading && <p className="empty-note">Loading…</p>}
        {!loading && accounts.length === 0 && (
          <p className="empty-note">
            No accounts yet. Add your checking, savings, brokerage, and 401(k) balances above — Net Worth and
            the emergency fund step in Allocate both read from here, so you only enter each number once.
          </p>
        )}
        {accounts.map((a) => (
          <div className="account-row" key={a.id}>
            <input
              type="text"
              value={a.name}
              onChange={(e) => editField(a.id, "name", e.target.value)}
              onBlur={() => commit(a.id)}
            />
            <select value={a.type} onChange={(e) => patchAndSave(a.id, { type: e.target.value })}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="number"
              step="0.01"
              className="mono right"
              value={a.balance}
              onChange={(e) => editField(a.id, "balance", e.target.value)}
              onBlur={() => commit(a.id)}
            />
            <input
              type="checkbox"
              checked={a.counts_as_emergency_fund}
              onChange={(e) => patchAndSave(a.id, { counts_as_emergency_fund: e.target.checked })}
            />
            <button className="icon-btn" onClick={() => remove(a.id)} aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
        {accounts.length > 0 && (
          <div className="account-row total-row">
            <span>Total</span><span></span><span className="mono right">{fmt2(totalBalance)}</span><span></span><span></span>
          </div>
        )}
      </div>
      <p className="empty-note" style={{ marginTop: 14 }}>
        Accounts checked "counts as emergency fund" are summed for the emergency-fund step in Allocate. Checking
        and brokerage balances also feed Allocate's checking-buffer step, and every balance here — minus your
        debts — makes up your Net Worth total. Edit a balance any time to keep both in sync.
      </p>
    </div>
  );
}
