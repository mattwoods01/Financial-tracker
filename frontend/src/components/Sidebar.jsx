import React from "react";
import { LayoutGrid, Receipt, Landmark, CreditCard, LogOut } from "lucide-react";

export default function Sidebar({ tab, setTab, onLogout }) {
  const items = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "debts", label: "Debts", icon: CreditCard },
    { id: "allocate", label: "Allocate", icon: Landmark },
  ];
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">§</span>
        <span className="brand-name">Ledger</span>
      </div>
      <ul>
        {items.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button className={"nav-item" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="nav-item logout" onClick={onLogout}>
        <LogOut size={16} strokeWidth={1.75} />
        <span>Log out</span>
      </button>
    </nav>
  );
}
