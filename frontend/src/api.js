const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", body: { email, password } }),

  // Login is the one endpoint that isn't JSON — FastAPI's OAuth2PasswordRequestForm expects form-encoded data.
  async login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
    if (!res.ok) {
      let detail = "Login failed";
      try {
        const data = await res.json();
        if (data.detail) detail = data.detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return res.json(); // { access_token, token_type }
  },

  getSettings: (token) => request("/settings", { token }),
  updateSettings: (token, settings) => request("/settings", { method: "PUT", body: settings, token }),

  getTransactions: (token) => request("/transactions", { token }),
  addTransaction: (token, tx) => request("/transactions", { method: "POST", body: tx, token }),
  updateTransaction: (token, id, tx) => request(`/transactions/${id}`, { method: "PUT", body: tx, token }),
  deleteTransaction: (token, id) => request(`/transactions/${id}`, { method: "DELETE", token }),

  getDebts: (token) => request("/debts", { token }),
  addDebt: (token, debt) => request("/debts", { method: "POST", body: debt, token }),
  deleteDebt: (token, id) => request(`/debts/${id}`, { method: "DELETE", token }),

  getAccounts: (token) => request("/accounts", { token }),
  addAccount: (token, account) => request("/accounts", { method: "POST", body: account, token }),
  updateAccount: (token, id, account) => request(`/accounts/${id}`, { method: "PUT", body: account, token }),
  deleteAccount: (token, id) => request(`/accounts/${id}`, { method: "DELETE", token }),

  getAllocation: (token) => request("/allocate", { token }),

  getNetWorth: (token) => request("/networth", { token }),

  getBudgets: (token) => request("/budgets", { token }),
  setBudget: (token, category, monthlyTarget) =>
    request(`/budgets/${encodeURIComponent(category)}`, { method: "PUT", body: { monthly_target: monthlyTarget }, token }),
  deleteBudget: (token, category) =>
    request(`/budgets/${encodeURIComponent(category)}`, { method: "DELETE", token }),
};
