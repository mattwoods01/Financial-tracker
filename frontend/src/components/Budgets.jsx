import React, { useEffect, useState } from "react";
import { api } from "../api";
import { CATEGORIES } from "../categories";

const fmt = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const monthKey = (isoDate) => isoDate.slice(0, 7);

export default function Budgets({ token }) {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetEdits, setBudgetEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [tx, b] = await Promise.all([api.getTransactions(token), api.getBudgets(token)]);
        setTransactions(tx);
        setBudgets(b);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const thisMonth = monthKey(new Date().toISOString().slice(0, 10));
  const monthTx = transactions.filter((t) => monthKey(t.date) === thisMonth);
  const monthLabel = new Date(thisMonth + "-02").toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const spentByCategory = {};
  monthTx.filter((t) => t.type === "expense").forEach((t) => {
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
  });
  const budgetByCategory = Object.fromEntries(budgets.map((b) => [b.category, b.monthly_target]));
  const budgetRows = CATEGORIES.map((category) => ({
    category,
    spent: spentByCategory[category] || 0,
    target: budgetByCategory[category] || 0,
  }));

  const editBudget = (category, value) => setBudgetEdits((prev) => ({ ...prev, [category]: value }));

  const commitBudget = async (category) => {
    const raw = budgetEdits[category];
    if (raw === undefined) return;
    setBudgetEdits((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
    const value = parseFloat(raw) || 0;
    try {
      if (value <= 0) {
        if (budgetByCategory[category] !== undefined) {
          await api.deleteBudget(token, category);
          setBudgets((prev) => prev.filter((b) => b.category !== category));
        }
      } else {
        const saved = await api.setBudget(token, category, value);
        setBudgets((prev) => [...prev.filter((b) => b.category !== category), saved]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="panel"><p className="empty-note">Loading…</p></div>;
  if (error) return <div className="panel"><p className="auth-error">{error}</p></div>;

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Budgets</h1>
        <span className="month-label">{monthLabel}</span>
      </header>

      <div className="budget-list">
        {budgetRows.map((row) => {
          const hasTarget = row.target > 0;
          const over = hasTarget && row.spent > row.target;
          const pct = hasTarget ? Math.min((row.spent / row.target) * 100, 100) : 0;
          const inputValue = budgetEdits[row.category] !== undefined ? budgetEdits[row.category] : (row.target || "");
          return (
            <div className="budget-row" key={row.category}>
              <div className="budget-row-head">
                <span>{row.category}</span>
                <span className="budget-target-input">
                  <span className="dim">Budget $</span>
                  <input
                    type="number"
                    step="10"
                    placeholder="—"
                    value={inputValue}
                    onChange={(e) => editBudget(row.category, e.target.value)}
                    onBlur={() => commitBudget(row.category)}
                  />
                </span>
              </div>
              {hasTarget ? (
                <>
                  <div className="budget-bar-track">
                    <div className={"budget-bar-fill" + (over ? " over" : "")} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={"budget-row-note" + (over ? " negative" : " dim")}>
                    {fmt(row.spent)} of {fmt(row.target)}
                    {over ? ` — ${fmt(row.spent - row.target)} over budget` : ""}
                  </p>
                </>
              ) : (
                row.spent > 0 && <p className="budget-row-note dim">{fmt(row.spent)} spent — no budget set</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
