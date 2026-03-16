import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import RegisterProperty from "./pages/RegisterProperty.jsx";
import TransferProperty from "./pages/TransferProperty.jsx";
import VerifyProperty from "./pages/VerifyProperty.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import { useWallet } from "./hooks/useWallet.js";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  const location = useLocation();
  const { account, connectWallet, walletError } = useWallet();
  const { user, isAuthenticated, logoutAction } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [compactChrome, setCompactChrome] = useState(false);
  const compactRef = useRef(false);
  const chromeRef = useRef(null);
  const roleRef = useRef(null);
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  useEffect(() => {
    function onOutsideClick(event) {
      if (!roleRef.current?.contains(event.target)) {
        setRoleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  useEffect(() => {
    let rafId = 0;
    function onScroll() {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const y = window.scrollY || 0;
        const shouldCompact = compactRef.current ? y > 18 : y > 44;
        if (shouldCompact !== compactRef.current) {
          compactRef.current = shouldCompact;
          setCompactChrome(shouldCompact);
        }
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    function syncChromeHeight() {
      const height = chromeRef.current?.offsetHeight || 0;
      document.documentElement.style.setProperty("--chrome-height", `${height + 12}px`);
    }
    syncChromeHeight();
    window.addEventListener("resize", syncChromeHeight);
    return () => window.removeEventListener("resize", syncChromeHeight);
  }, [compactChrome, isAuthenticated, walletError]);
  
  return (
    <div className="app-shell">
      <div ref={chromeRef} className={`app-chrome ${compactChrome ? "compact" : ""}`}>
        <div className="gov-strip">
          <div className="gov-strip-item">Official Property Governance Service</div>
          <div className="gov-strip-item">Environment: Local Development</div>
        </div>
        <header className="topbar">
          <div className="masthead">
            <div className="masthead-seal">
              <img src="/branding/gov-seal.png" alt="Government registry seal" />
            </div>
            <div className="masthead-copy">
              <p className="eyebrow">Digital Governance Suite</p>
              <h1>Land Registry Command Platform</h1>
            </div>
          </div>
          <div className="wallet-bar">
            {isAuthenticated ? (
              <div className="role-switcher" ref={roleRef}>
                <button
                  type="button"
                  className="role-trigger"
                  onClick={() => setRoleMenuOpen((open) => !open)}
                  aria-expanded={roleMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="role-dot" />
                  {user?.role}
                  <span className={`role-chevron ${roleMenuOpen ? "open" : ""}`} aria-hidden="true">▾</span>
                </button>
                {roleMenuOpen ? (
                  <div className="role-menu">
                    <p className="menu-head">{user?.name}</p>
                    <p className="menu-sub">{user?.email}</p>
                    <button
                      type="button"
                      className="role-option"
                      onClick={async () => {
                        await logoutAction();
                        setRoleMenuOpen(false);
                      }}
                    >
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!isAuthRoute ? (
              account ? <span className="wallet-account">{account}</span> : <button className="wallet-primary-btn" onClick={connectWallet}>Connect Wallet</button>
            ) : null}
          </div>
        </header>
        {walletError && !isAuthRoute ? <p className="wallet-warning">{walletError}</p> : null}
        {isAuthenticated ? (
          <nav className="nav">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/register">Register Property</NavLink>
            <NavLink to="/transfer">Transfer Property</NavLink>
            <NavLink to="/verify">Verify Property</NavLink>
          </nav>
        ) : null}
      </div>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute>
                <RegisterProperty />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfer"
            element={
              <ProtectedRoute>
                <TransferProperty />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify"
            element={
              <ProtectedRoute>
                <VerifyProperty />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
