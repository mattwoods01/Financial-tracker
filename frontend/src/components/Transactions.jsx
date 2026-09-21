import React, { useEffect, useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import { CATEGORIES } from "../categories";
import { todayMonthKey, monthKey, shiftMonth, monthLabel as formatMonthLabel } from "../month";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt2 = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const asNumber = (v) => parseFloat(v) || 0;

function TransactionTable({ title, rows, showCategory, onEditField, onCommit, onPatch, onDelete }) {
  const total = rows.reduce((s, t) => s + asNumber(t.amount), 0);
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
        {rows.length === 0 && <p className="empty-note">No {title.toLowerCase()} for this month.</p>}
        {rows.map((t) => (
          <div className={rowClass} key={t.id}>
            <input
              type="text"
              className="mono"
              value={t.date}
              onChange={(e) => onEditField(t.id, "date", e.target.value)}
              onBlur={() => onCommit(t.id)}
            />
            <input
              type="text"
              value={t.description}
              onChange={(e) => onEditField(t.id, "description", e.target.value)}
              onBlur={() => onCommit(t.id)}
            />
            {showCategory && (
              <select value={t.category} onChange={(e) => onPatch(t.id, { category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input
              type="number"
              step="0.01"
              className={"mono right" + (!showCategory ? " positive" : "")}
              value={t.amount}
              onChange={(e) => onEditField(t.id, "amount", e.target.value)}
              onBlur={() => onCommit(t.id)}
            />
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
  const [month, setMonth] = useState(todayMonthKey);
  const [showAllMonths, setShowAllMonths] = useState(false);
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

  // Local-only edit for text/number/date fields while typing — committed on blur.
  const editField = (id, field, value) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const save = async (tx) => {
    try {
      await api.updateTransaction(token, tx.id, {
        date: tx.date,
        description: tx.description,
        category: tx.category,
        amount: asNumber(tx.amount),
        type: tx.type,
      });
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const commit = (id) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) save(tx);
  };

  // Immediate-commit for the category select — builds the merged record explicitly
  // rather than relying on state having already updated by the time we save.
  const patch = (id, changes) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const updated = { ...tx, ...changes };
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    save(updated);
  };

  const filtered = showAllMonths ? transactions : transactions.filter((t) => monthKey(t.date) === month);
  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));
  const income = sorted.filter((t) => t.type === "income");
  const expenses = sorted.filter((t) => t.type === "expense");
  const isCurrentMonth = month >= todayMonthKey();

  return (
    <div className="panel wide">
      <header className="panel-head">
        <h1>Transactions</h1>
        {!showAllMonths && (
          <div className="month-nav">
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="month-label">{formatMonthLabel(month)}</span>
            <button
              className="icon-btn"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={isCurrentMonth}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
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

      <label className="field checkbox-field" style={{ marginTop: 0, marginBottom: 4 }}>
        <input type="checkbox" checked={showAllMonths} onChange={(e) => setShowAllMonths(e.target.checked)} />
        <span>Show all months</span>
      </label>

      {loading && <p className="empty-note">Loading…</p>}
      {!loading && (
        <div className="tx-tables">
          <TransactionTable
            title="Income" rows={income} showCategory={false}
            onEditField={editField} onCommit={commit} onPatch={patch} onDelete={remove}
          />
          <TransactionTable
            title="Expenses" rows={expenses} showCategory
            onEditField={editField} onCommit={commit} onPatch={patch} onDelete={remove}
          />
        </div>
      )}
    </div>
  );
}
