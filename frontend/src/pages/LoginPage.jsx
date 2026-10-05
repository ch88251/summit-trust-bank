import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import Alert from "../components/Alert";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || "/accounts";
  if (user && !submitting) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <h1>Banking that keeps you on top.</h1>
        <p>Manage your accounts, trade securities, and move money — all in one secure place.</p>
        <ul className="hero-points">
          <li>Real-time account balances</li>
          <li>Commission-free stock trading</li>
          <li>Fast transfers & bill pay</li>
        </ul>
      </section>

      <section className="card login-card">
        <h2>Log in to Online Banking</h2>
        {location.state?.loggedOut && !error && (
          <Alert type="success" testId="logout-message">You have been logged out successfully.</Alert>
        )}
        <Alert type="error" testId="login-error">{error}</Alert>
        <form onSubmit={handleSubmit} noValidate data-testid="login-form">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="login-username"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-with-action">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((s) => !s)}
                data-testid="toggle-password"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} data-testid="login-submit">
            {submitting ? "Logging in…" : "Log In"}
          </button>
        </form>
        <div className="demo-creds" data-testid="demo-credentials">
          <strong>Demo credentials</strong>
          <div>demo / Demo@123</div>
          <div>jane / Jane@123</div>
        </div>
      </section>
    </div>
  );
}
