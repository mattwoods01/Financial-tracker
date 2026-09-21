import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "../api";
import { todayMonthKey, monthKey, shiftMonth, monthLabel as formatMonthLabel } from "../month";

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

export default function Overview({ token }) {
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(todayMonthKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setTransactions(await api.getTransactions(token));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const monthTx = transactions.filter((t) => monthKey(t.date) === month);
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

  const pieData = categoryBreakdown.map((c) => ({ name: c.category, value: c.total }));
  const isCurrentMonth = month >= todayMonthKey();

  if (loading) return <div className="panel"><p className="empty-note">Loading…</p></div>;
  if (error) return <div className="panel"><p className="auth-error">{error}</p></div>;

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Overview</h1>
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
        <p className="empty-note">No expenses logged for this month. Add some in Transactions.</p>
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
    </div>
  );
}
