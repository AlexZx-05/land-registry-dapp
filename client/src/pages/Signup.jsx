import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const ROLES = ["buyer", "officer", "auditor", "tehsildar", "sdm", "collector", "admin"];

export default function Signup() {
  const navigate = useNavigate();
  const { signupAction } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("buyer");
  const [status, setStatus] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("Creating account...");
    try {
      await signupAction({ name, email, password, role });
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
            <p className="eyebrow">Digital Onboarding</p>
            <h2>Create Account</h2>
            <p className="muted">Register a user with governance role mapping and secure credentials.</p>
            <div className="compliance-note">
              Account provisioning must follow approved department authorization policy.
            </div>
            <form className="form" onSubmit={onSubmit}>
              <label>
                Full Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </label>
              <label>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Sign Up</button>
            </form>
            {status ? <p className="status-banner">{status}</p> : null}
            <p className="muted">
              Already have an account? <Link to="/login">Login</Link>
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
            <h3>Governance Identity</h3>
            <p className="muted">Use official email identity and assign minimal required role access.</p>
            <p className="muted">Recommended for operators:</p>
            <div className="auth-pills">
              <span className="chip chip-pending">Officer</span>
              <span className="chip chip-pending">Tehsildar</span>
              <span className="chip chip-pending">SDM</span>
              <span className="chip chip-pending">Collector</span>
            </div>
            <hr className="auth-divider" />
            <p className="muted">All new accounts require supervisory approval in production.</p>
          </aside>
        </div>
      </article>
    </section>
  );
}
