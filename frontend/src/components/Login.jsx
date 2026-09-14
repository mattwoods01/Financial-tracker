import React, { useState } from "react";
import { api } from "../api";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await api.register(email, password);
      }
      const { access_token } = await api.login(email, password);
      onAuthenticated(access_token);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand" style={{ marginBottom: 22, borderBottom: "none", paddingBottom: 0 }}>
          <span className="brand-mark">§</span>
          <span className="brand-name" style={{ color: "var(--charcoal)" }}>Ledger</span>
        </div>

        <h1 className="auth-title">{mode === "login" ? "Log in" : "Create an account"}</h1>

        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", marginTop: 6 }}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
