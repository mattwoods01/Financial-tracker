import React, { useEffect, useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "../api";
import { CATEGORIES } from "../categories";

const CATEGORY_COLORS = {
  Housing: "#8C6D46",
  Food: "#A24936",
  Transportation: "#5B7B6B",
  Utilities: "#B8925A",
  Insurance: "#6E7F8C",
  Debt: "#7A3B32",
  Subscriptions: "#9C8A5E",
  Entertainment: "#4F6D5A",
  Shopping: "#AD8A6B",
  Health: "#5C7A72",
  Other: "#8A8474",
};

const fmt = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const monthKey = (isoDate) => isoDate.slice(0, 7);

export default function Overview({ token }) {
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
  const effectiveIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const effectiveExpenses = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = effectiveIncome - effectiveExpenses;

  const categoryBreakdown = useMemo(() => {
    const map = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [monthTx]);

  const monthLabel = new Date(thisMonth + "-02").toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pieData = categoryBreakdown.map((c) => ({ name: c.category, value: c.total }));

  const spentByCategory = Object.fromEntries(categoryBreakdown.map((c) => [c.category, c.total]));
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
        <h1>Overview</h1>
        <span className="month-label">{monthLabel}</span>
      </header>

      <div className="ledger-row-group">
        <div className="ledger-row">
          <span>Income</span>
          <span className="mono">{fmt(effectiveIncome)}</span>
        </div>
        <div className="ledger-row">
          <span>Expenses</span>
          <span className="mono">{fmt(effectiveExpenses)}</span>
        </div>
        <div className="ledger-row total">
          <span>Net</span>
          <span className={"mono" + (net < 0 ? " negative" : "")}>{fmt(net)}</span>
        </div>
      </div>

      <h2 className="section-title">Spending by category</h2>
      {pieData.length === 0 ? (
        <p className="empty-note">No expenses logged this month yet. Add some in Transactions.</p>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={1}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || "#8A8474"} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2 className="section-title">Budgets</h2>
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
