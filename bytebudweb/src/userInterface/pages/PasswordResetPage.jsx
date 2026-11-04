import { useState } from "react";
import { logout, resetPassword } from "../../api.js";
import "./AuthPage.css";

export default function PasswordResetPage({ token }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      logout();
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.message || "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ap-page">
      <section className="ap-form-side">
        <div className="ap-form-wrap">
          <h1 className="ap-title">Choose a new password</h1>
          <p className="ap-subtitle">Your reset link can only be used once and expires after one hour.</p>
          {success ? (
            <div className="ap-form">
              <p className="ap-fp-text">Your password has been updated.</p>
              <a className="ap-submit ap-fp-reset-link" href="/">Back to log in</a>
            </div>
          ) : (
            <form className="ap-form" onSubmit={submit} noValidate>
              {error && <div className="ap-alert" role="alert">{error}</div>}
              <div className="ap-field">
                <label htmlFor="reset-password">New password</label>
                <input id="reset-password" type="password" autoComplete="new-password" value={password}
                  onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div className="ap-field">
                <label htmlFor="reset-confirm-password">Confirm new password</label>
                <input id="reset-confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
              <button className="ap-submit" type="submit" disabled={loading}>
                {loading ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </section>
      <aside className="ap-hero-side" aria-label="About ByteBud">
        <div className="ap-hero-glow" aria-hidden="true" />
        <div className="ap-hero-content">
          <h2 className="ap-slogan">The right laptop for your course, at a price that fits.</h2>
          <p className="ap-slogan-sub">Refurbished and surplus business laptops, tested and graded.</p>
        </div>
      </aside>
    </main>
  );
}
