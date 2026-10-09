import React, { useEffect, useState } from "react";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Overview from "./components/Overview";
import Budgets from "./components/Budgets";
import Transactions from "./components/Transactions";
import Accounts from "./components/Accounts";
import Debts from "./components/Debts";
import Allocate from "./components/Allocate";
import NetWorth from "./components/NetWorth";
import Markets from "./components/Markets";

const TOKEN_KEY = "ledger:token";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState("overview");
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleAuthenticated = (accessToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setSessionExpired(false);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  // Any API call can discover the stored token is expired/invalid (see api.js). When that
  // happens, log out and show a clear reason instead of leaving the page stuck on a raw
  // "Could not validate credentials" error.
  useEffect(() => {
    const onUnauthorized = () => {
      setSessionExpired(true);
      handleLogout();
    };
    window.addEventListener("ledger:unauthorized", onUnauthorized);
    return () => window.removeEventListener("ledger:unauthorized", onUnauthorized);
  }, []);

  if (!token) {
    return (
      <Login
        onAuthenticated={handleAuthenticated}
        notice={sessionExpired ? "Your session expired — please log in again." : ""}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar tab={tab} setTab={setTab} onLogout={handleLogout} />
      {tab === "overview" && <Overview token={token} />}
      {tab === "budgets" && <Budgets token={token} />}
      {tab === "transactions" && <Transactions token={token} />}
      {tab === "accounts" && <Accounts token={token} />}
      {tab === "debts" && <Debts token={token} />}
      {tab === "allocate" && <Allocate token={token} />}
      {tab === "networth" && <NetWorth token={token} />}
      {tab === "markets" && <Markets token={token} />}
    </div>
  );
}
