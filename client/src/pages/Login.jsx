import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { loginAction } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("Signing in...");
    try {
      await loginAction({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setStatus(error.response?.data?.message || error.message);
    }
  }

  return (
    <section className="auth-shell">
      <article className="auth-card">
        <div className="auth-layout">
          <div className="auth-main">
            <p className="eyebrow">Secure Access</p>
            <h2>Sign In</h2>
            <p className="muted">Use your authorized registry account to continue.</p>
            <div className="compliance-note">
              This system records access actions for compliance and audit purposes.
            </div>
            <form className="form" onSubmit={onSubmit}>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <div className="password-field-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <span className="password-toggle-icon" aria-hidden="true">
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M3 4.5l16.2 16.2-1.4 1.4L14.6 19a12 12 0 0 1-2.6.3C6.8 19.3 2.4 16.1 1 12c.6-1.9 2-3.8 3.9-5.3L1.6 3.1 3 1.7l19.3 19.3-1.4 1.4L17 18.5l-.1.1L3 4.5zm6.8 6.8a3 3 0 0 0 4 4l-4-4zM8 6.4A11.2 11.2 0 0 1 12 5c5.2 0 9.6 3.2 11 7-.5 1.6-1.6 3.2-3.1 4.6l-1.6-1.6A8.8 8.8 0 0 0 20.8 12c-1.2-2.6-4.5-5-8.8-5-.9 0-1.8.1-2.6.3L8 6.4z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M12 5c5.2 0 9.6 3.2 11 7-1.4 3.8-5.8 7-11 7S2.4 15.8 1 12c1.4-3.8 5.8-7 11-7zm0 2C7.7 7 4.3 9.4 3.2 12c1.1 2.6 4.5 5 8.8 5s7.7-2.4 8.8-5c-1.1-2.6-4.5-5-8.8-5zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z" />
                        </svg>
                      )}
                    </span>
                    <span className="password-toggle-text">{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
              </label>
              <button type="submit">Login</button>
            </form>
            {status ? <p className="status-banner">{status}</p> : null}
            <p className="muted">
              New user? <Link to="/signup">Create account</Link>
            </p>
          </div>
          <aside className="auth-side">
            <div className="auth-photo-wrap">
              {!imageFailed ? (
                <img
                  className="auth-photo"
                  src="/auth/land-records-office.jpg"
                  alt="Land records office service desk"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="auth-photo-fallback">
                  Add photo: <span className="mono">public/auth/land-records-office.jpg</span>
                </div>
              )}
            </div>
            <h3>Access Roles</h3>
            <div className="auth-pills">
              <span className="chip chip-approved">Officer</span>
              <span className="chip chip-approved">Tehsildar</span>
              <span className="chip chip-approved">SDM</span>
              <span className="chip chip-approved">Collector</span>
            </div>
            <p className="muted">Demo login:</p>
            <p className="muted"><strong>officer@land.local</strong></p>
            <p className="muted">Use the seeded password configured in backend.</p>
            <hr className="auth-divider" />
            <p className="muted">Support Desk: land-registry-admin@local.gov</p>
          </aside>
        </div>
      </article>
    </section>
  );
}
