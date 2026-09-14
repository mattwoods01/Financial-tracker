import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api";

const HIGH_INTEREST_APR_THRESHOLD = 7;
const fmt2 = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Debts({ token }) {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", balance: "", apr: "", min_payment: "" });

  const load = async () => {
    try {
      setDebts(await api.getDebts(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    const balance = parseFloat(form.balance);
    if (!balance || balance <= 0 || !form.name.trim()) return;
    try {
      await api.addDebt(token, {
        name: form.name,
        balance,
        apr: parseFloat(form.apr) || 0,
        min_payment: parseFloat(form.min_payment) || 0,
      });
      setForm({ name: "", balance: "", apr: "", min_payment: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteDebt(token, id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Debts</h1>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <form className="debt-form" onSubmit={submit}>
        <input type="text" placeholder="Name (e.g. Visa card)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="number" step="0.01" placeholder="Balance ($)" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
        <input type="number" step="0.1" placeholder="APR (%)" value={form.apr} onChange={(e) => setForm({ ...form, apr: e.target.value })} />
        <input type="number" step="0.01" placeholder="Min payment ($/mo)" value={form.min_payment} onChange={(e) => setForm({ ...form, min_payment: e.target.value })} />
        <button type="submit" className="btn-primary"><Plus size={15} /> Add</button>
      </form>

      <div className="tx-list">
        <div className="debt-list-head">
          <span>Name</span><span className="right">Balance</span><span className="right">APR</span><span className="right">Min pmt</span><span></span>
        </div>
        {loading && <p className="empty-note">Loading…</p>}
        {!loading && debts.length === 0 && (
          <p className="empty-note">No debts logged. Add one above, or skip this if you're debt-free.</p>
        )}
        {debts.map((d) => (
          <div className="debt-row" key={d.id}>
            <span>{d.name}</span>
            <span className="mono right">{fmt2(d.balance)}</span>
            <span className={"mono right" + (d.apr >= HIGH_INTEREST_APR_THRESHOLD ? " negative" : "")}>{d.apr}%</span>
            <span className="mono right">{fmt2(d.min_payment)}</span>
            <button className="icon-btn" onClick={() => remove(d.id)} aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
        {debts.length > 0 && (
          <div className="debt-row total-row">
            <span>Total</span><span className="mono right">{fmt2(totalBalance)}</span><span></span><span></span><span></span>
          </div>
        )}
      </div>
      <p className="empty-note" style={{ marginTop: 14 }}>
        Debt at {HIGH_INTEREST_APR_THRESHOLD}% APR or higher is treated as "high interest" in the Allocate waterfall.
      </p>
    </div>
  );
}
