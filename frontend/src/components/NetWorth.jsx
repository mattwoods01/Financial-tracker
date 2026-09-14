import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api";

const fmt = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const shortDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

const TYPE_LABEL = {
  checking: "Checking",
  savings: "Savings",
  brokerage: "Brokerage",
  retirement: "401(k)",
  other: "Other",
};

export default function NetWorth({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setData(await api.getNetWorth(token));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div className="panel"><p className="empty-note">Loading…</p></div>;
  if (!data) return <div className="panel"><p className="auth-error">{error}</p></div>;

  const chartData = data.history.map((h) => ({ date: h.date, label: shortDate(h.date), value: h.net_worth }));
  const first = data.history[0];
  const change = first ? data.net_worth - first.net_worth : 0;

  return (
    <div className="panel">
      <header className="panel-head">
        <h1>Net Worth</h1>
      </header>

      {error && <p className="auth-error">{error}</p>}

      <div className="net-worth-hero">
        <span className="net-worth-total mono">{fmt(data.net_worth)}</span>
        {data.history.length > 1 && (
          <span className={"net-worth-change mono " + (change < 0 ? "negative" : "positive")}>
            {change >= 0 ? "+" : "-"}{fmt(Math.abs(change))} since {shortDate(first.date)}
          </span>
        )}
      </div>

      <div className="ledger-row-group">
        {data.by_type.length === 0 && (
          <p className="empty-note" style={{ padding: "10px 2px" }}>
            No accounts yet — add checking, savings, brokerage, or 401(k) balances in the Accounts tab to start
            tracking net worth.
          </p>
        )}
        {data.by_type.map((t) => (
          <div className="ledger-row" key={t.type}>
            <span>{TYPE_LABEL[t.type] || t.type}</span>
            <span className="mono">{fmt(t.total)}</span>
          </div>
        ))}
        <div className="ledger-row">
          <span>Debts</span>
          <span className="mono negative">-{fmt(data.total_debt)}</span>
        </div>
        <div className="ledger-row total">
          <span>Net worth</span>
          <span className={"mono" + (data.net_worth < 0 ? " negative" : "")}>{fmt(data.net_worth)}</span>
        </div>
      </div>

      <h2 className="section-title">Trend</h2>
      {chartData.length < 2 ? (
        <p className="empty-note">
          This is your first snapshot. Come back after updating your balances in Accounts or Debts and this
          will start plotting a trend line.
        </p>
      ) : (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b6455" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b6455" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v)}
                width={70}
              />
              <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => l} />
              <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: "var(--gold)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="empty-note" style={{ marginTop: 12 }}>
        Pulled from your balances in the Accounts tab minus your total debt from the Debts tab. Visiting this
        tab refreshes today's point — update your numbers whenever they change to keep the trend accurate.
      </p>
    </div>
  );
}
