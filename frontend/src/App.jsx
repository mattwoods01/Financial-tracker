import React, { useState } from "react";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Overview from "./components/Overview";
import Budgets from "./components/Budgets";
import Transactions from "./components/Transactions";
import Accounts from "./components/Accounts";
import Debts from "./components/Debts";
import Allocate from "./components/Allocate";
import NetWorth from "./components/NetWorth";

const TOKEN_KEY = "ledger:token";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState("overview");

  const handleAuthenticated = (accessToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  if (!token) {
    return <Login onAuthenticated={handleAuthenticated} />;
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
    </div>
  );
}
