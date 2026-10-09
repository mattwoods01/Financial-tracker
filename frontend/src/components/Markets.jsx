import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api";

const fmt = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const RANGES = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

// Comparison overlays — index tickers, fetched and normalized to % change alongside
// whatever symbol is looked up, same idea as the "Compare" feature on finance sites.
const INDEX_OPTIONS = [
  { key: "sp500", label: "S&P 500", symbol: "^GSPC", color: "#5B7B6B" },
  { key: "nasdaq", label: "Nasdaq", symbol: "^IXIC", color: "#6E7F8C" },
  { key: "dow", label: "Dow Jones", symbol: "^DJI", color: "#7A3B32" },
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

// Normalize a points series to % change from its first point, so series at very
// different price levels (a $300 stock vs a ~45,000-point index) overlay sensibly.
function normalizeToPercent(points) {
  if (!points.length) return [];
  const base = points[0].price;
  return points.map((p) => ({ time: p.time, pct: base ? (p.price / base - 1) * 100 : 0 }));
}

export default function Markets({ token }) {
  const [symbolInput, setSymbolInput] = useState("SPY");
  const [symbol, setSymbol] = useState("SPY");
  const [range, setRange] = useState("1d");
  const [compare, setCompare] = useState([]);
  const [quote, setQuote] = useState(null);
  const [compareQuotes, setCompareQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const compareFetches = compare.map((key) => {
          const opt = INDEX_OPTIONS.find((o) => o.key === key);
          return api.getQuote(token, opt.symbol, range).then((data) => [key, data]);
        });
        const [mainData, compareResults] = await Promise.all([
          api.getQuote(token, symbol, range),
          Promise.allSettled(compareFetches),
        ]);
        if (cancelled) return;
        setQuote(mainData);
        const nextCompareQuotes = {};
        for (const r of compareResults) {
          if (r.status === "fulfilled") {
            const [key, data] = r.value;
            nextCompareQuotes[key] = data;
          }
        }
        setCompareQuotes(nextCompareQuotes);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setQuote(null);
          setCompareQuotes({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, symbol, range, compare]);

  const submit = (e) => {
    e.preventDefault();
    const next = symbolInput.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
  };

  const toggleCompare = (key) => {
    setCompare((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const comparing = compare.length > 0;
  const up = quote ? quote.change >= 0 : true;
  const mainColor = comparing ? "var(--gold)" : (up ? "#3E6B52" : "var(--rust)");

  let chartData = [];
  if (quote) {
    if (!comparing) {
      chartData = quote.points.map((p) => ({ time: p.time, main: p.price }));
    } else {
      const mainSeries = normalizeToPercent(quote.points);
      const seriesMaps = {};
      for (const key of compare) {
        const cq = compareQuotes[key];
        if (cq) seriesMaps[key] = new Map(normalizeToPercent(cq.points).map((p) => [p.time, p.pct]));
      }
      chartData = mainSeries.map((p) => {
        const row = { time: p.time, main: p.pct };
        for (const key of compare) {
          const m = seriesMaps[key];
          row[key] = m ? m.get(p.time) : undefined;
        }
        return row;
      });
    }
  }

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
              {up ? "+" : ""}{fmt(quote.change)} ({fmtPct(quote.change_percent)})
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

          <div className="compare-row">
            <span className="dim">Compare to</span>
            {INDEX_OPTIONS.map((opt) => (
              <label key={opt.key} className="compare-checkbox">
                <input
                  type="checkbox"
                  checked={compare.includes(opt.key)}
                  onChange={() => toggleCompare(opt.key)}
                />
                <span style={{ color: opt.color }}>{opt.label}</span>
              </label>
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
                  tickFormatter={(v) => (comparing ? fmtPct(v) : fmt(v))}
                  width={comparing ? 55 : 70}
                />
                <Tooltip
                  formatter={(v) => (comparing ? fmtPct(v) : fmt(v))}
                  labelFormatter={(t) => formatTooltipLabel(t, range)}
                />
                {comparing && <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
                <Line type="monotone" dataKey="main" name={quote.symbol} stroke={mainColor} strokeWidth={2} dot={false} connectNulls />
                {comparing && compare.map((key) => {
                  const opt = INDEX_OPTIONS.find((o) => o.key === key);
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={opt.label}
                      stroke={opt.color}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  );
                })}
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
