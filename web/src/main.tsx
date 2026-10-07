import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import type { User } from "oidc-client-ts";
import { currentUser, signIn, signOut, takeReturnTo, userManager } from "./auth";
import TenantsPage from "./pages/TenantsPage";
import NewTenantPage from "./pages/NewTenantPage";
import TenantPage from "./pages/TenantPage";
import "./styles.css";

const ENV = import.meta.env.VITE_ENVIRONMENT ?? "dev";

let callbackOnce: Promise<string> | null = null;

function Callback() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // StrictMode runs effects twice in dev; the code can only be redeemed once.
    callbackOnce ??= userManager.signinRedirectCallback().then(() => takeReturnTo());
    callbackOnce
      // Full page load: the shell then starts with the stored user.
      .then((to) => window.location.replace(to))
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);
  return error ? (
    <div className="center">
      <p>Sign-in failed: {error}</p>
      <button className="btn" onClick={() => signIn()}>Try again</button>
    </div>
  ) : (
    <div className="center">Signing in…</div>
  );
}

function Shell() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      setUser(null);
      return;
    }
    currentUser().then((u) => {
      if (!u) void signIn();
      setUser(u);
    });
  }, []);

  if (window.location.pathname === "/auth/callback") {
    return <Routes><Route path="/auth/callback" element={<Callback />} /></Routes>;
  }
  if (!user) return <div className="center">Redirecting to sign-in…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">SBS <span>Admin</span></Link>
        <span className={`env env--${ENV}`}>{ENV}</span>
        <nav className="topbar__nav">
          <NavLink to="/" end>Customers</NavLink>
          <NavLink to="/tenants/new">New customer</NavLink>
        </nav>
        <div className="topbar__user">
          <span>{(user.profile.email as string) ?? "operator"}</span>
          <button className="btn btn--ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<TenantsPage />} />
          <Route path="/tenants/new" element={<NewTenantPage />} />
          <Route path="/tenants/:tenantId" element={<TenantPage />} />
          <Route path="*" element={<p>Not found. <Link to="/">Back to customers</Link></p>} />
        </Routes>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </StrictMode>,
);
