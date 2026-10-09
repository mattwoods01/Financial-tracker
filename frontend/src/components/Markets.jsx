import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api";

const fmt = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RANGES = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

function formatTick(unixSeconds, range) {
  const d = new Date(unixSeconds * 1000);
  if (range === "1d") return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (range === "5d") return d.toLocaleDateString(undefined, { weekday: "short" });
  if (range === "5y") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTooltipLabel(unixSeconds, range) {
  const d = new Date(unixSeconds * 1000);
  if (range === "1d" || range === "5d") {
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Markets({ token }) {
  const [symbolInput, setSymbolInput] = useState("SPY");
  const [symbol, setSymbol] = useState("SPY");
  const [range, setRange] = useState("1d");
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.getQuote(token, symbol, range);
        if (!cancelled) setQuote(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setQuote(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, symbol, range]);

  const submit = (e) => {
    e.preventDefault();
    const next = symbolInput.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
  };

  const up = quote ? quote.change >= 0 : true;
  const chartData = quote ? quote.points.map((p) => ({ time: p.time, price: p.price })) : [];
  const lineColor = up ? "#3E6B52" : "var(--rust)";

  return (
    <div className="panel wide">
      <header className="panel-head">
        <h1>Markets</h1>
      </header>

      <form className="market-search" onSubmit={submit}>
        <input
          type="text"
          placeholder="Ticker (e.g. AAPL, SPY, VTI)"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
        />
        <button type="submit" className="btn-primary"><Search size={15} /> Look up</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading && !quote && <p className="empty-note">Loading…</p>}

      {quote && (
        <>
          <div className="market-hero">
            <span className="market-symbol">{quote.symbol}</span>
            <span className="market-price mono">{fmt(quote.price)}</span>
            <span className={"market-change mono " + (up ? "positive" : "negative")}>
              {up ? "+" : ""}{fmt(quote.change)} ({up ? "+" : ""}{quote.change_percent.toFixed(2)}%)
            </span>
          </div>

          <div className="range-tabs">
            {RANGES.map((r) => (
              <button
                key={r.value}
                className={"range-tab" + (range === r.value ? " active" : "")}
                onClick={() => setRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ width: "100%", height: 320, marginTop: 14 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => formatTick(t, range)}
                  tick={{ fontSize: 11, fill: "#6b6455" }}
                  axisLine={{ stroke: "var(--line)" }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: "#6b6455" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v)}
                  width={70}
                />
                <Tooltip
                  formatter={(v) => fmt(v)}
                  labelFormatter={(t) => formatTooltipLabel(t, range)}
                />
                <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="empty-note" style={{ marginTop: 12 }}>
            {quote.exchange ? `${quote.exchange} · ` : ""}{quote.currency}. Delayed market data via Yahoo
            Finance's public feed — not for trading decisions.
          </p>
        </>
      )}
    </div>
  );
}
