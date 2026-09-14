import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api";

const CATEGORIES = [
  "Housing", "Food", "Transportation", "Utilities", "Insurance",
  "Debt", "Subscriptions", "Entertainment", "Shopping", "Health", "Other",
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt2 = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TransactionTable({ title, rows, showCategory, onDelete }) {
  const total = rows.reduce((s, t) => s + t.amount, 0);
  const rowClass = "tx-row" + (showCategory ? "" : " no-category");

  return (
    <div className="tx-table">
      <h2 className="section-title" style={{ marginTop: 0 }}>{title}</h2>
      <div className="tx-list">
        <div className={"tx-list-head" + (showCategory ? "" : " no-category")}>
          <span>Date</span>
          <span>Description</span>
          {showCategory && <span>Category</span>}
          <span className="right">Amount</span>
          <span></span>
        </div>
        {rows.length === 0 && <p className="empty-note">No {title.toLowerCase()} yet.</p>}
        {rows.map((t) => (
          <div className={rowClass} key={t.id}>
            <span className="mono dim">{t.date}</span>
            <span>{t.description}</span>
            {showCategory && <span className="dim">{t.category}</span>}
            <span className={"mono right" + (!showCategory ? " positive" : "")}>
              {!showCategory ? "+" : "-"}{fmt2(t.amount)}
            </span>
            <button className="icon-btn" onClick={() => onDelete(t.id)} aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
        {rows.length > 0 && (
          <div className={rowClass + " total-row"}>
            <span>Total</span>
            <span></span>
            {showCategory && <span></span>}
            <span className={"mono right" + (!showCategory ? " positive" : "")}>{fmt2(total)}</span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Transactions({ token }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ date: todayISO(), description: "", category: "Food", amount: "", type: "expense" });

  const load = async () => {
    try {
      setTransactions(await api.getTransactions(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0 || !form.description.trim()) return;
    try {
      await api.addTransaction(token, { ...form, amount });
      setForm({ ...form, description: "", amount: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteTransaction(token, id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const income = sorted.filter((t) => t.type === "income");
  const expenses = sorted.filter((t) => t.type === "expense");

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Transactions</h1>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <form className="tx-form" onSubmit={submit}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        {form.type === "expense" && (
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <button type="submit" className="btn-primary"><Plus size={15} /> Add</button>
      </form>

      {loading && <p className="empty-note">Loading…</p>}
      {!loading && (
        <div className="tx-tables">
          <TransactionTable title="Income" rows={income} showCategory={false} onDelete={remove} />
          <TransactionTable title="Expenses" rows={expenses} showCategory onDelete={remove} />
        </div>
      )}
    </div>
  );
}
