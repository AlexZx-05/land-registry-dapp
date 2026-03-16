import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { loginAction } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
