import { useEffect, useRef, useState } from "react";
import "./AuthPage.css";

/**
 * ByteBud: Login / Register page
 *
 * Usage (e.g. with React Router, routes /login and /register):
 *   <AuthPage
 *     initialMode="login"             // "login" | "register"
 *     logoSrc="/logo.svg"             // optional: leave out to show the placeholder
 *     onLogin={async ({ email, password }) => { ... }}
 *     onRegister={async ({ fullName, phone, email, password, isStudent, schoolEmail }) => { ... }}
 *     showForgotPassword={false}      // forgot password is postponed: hidden by default
 *     onForgotPassword={async ({ email }) => { ... }}
 *     onSuccess={() => navigate("/")} // runs after a successful login/register
 *   />
 *
 * Backend notes:
 *  - Send the plain password over HTTPS only; hash it server-side into Users.passwordHash.
 *  - Register always creates Users.role = "buyer" (never trust a role from the client).
 *  - After login, route by Users.role: buyer -> storefront, staff/admin -> /admin.
 *  - If isStudent is true: match schoolEmail's domain against the partner-school
 *    lookup, then create Student_Verifications { userId, schoolEmail, verifStatus: "pending" }.
 *  - onForgotPassword: email a time-limited reset link to the address if an account exists.
 *    Return the same result either way so the form never reveals which emails are registered.
 *  - Throw an Error with a readable message from onLogin/onRegister to show it in the form
 *    (e.g. "Incorrect email or password.", "That school email domain is not a partner school.").
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  email: "",
  password: "",
  isStudent: false,
  schoolEmail: "",
};

// Placeholder handlers so the page works before the API is connected.
const demoHandler = (label) => async (payload) => {
  console.info(`[AuthPage] ${label} payload:`, payload);
  await new Promise((resolve) => setTimeout(resolve, 600));
};

/* ---------- Icons ---------- */

function EyeIcon({ off }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12.6 12.6 0 0 1-2.6 3.3M6.4 7.6A12.7 12.7 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.9 10a3 3 0 0 0 4.1 4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7.5l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailCheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Logo (placeholder until the real logo is added) ---------- */

function Logo({ logoSrc }) {
  return (
    <div className="ap-logo">
      {logoSrc ? (
        <img className="ap-logo-img" src={logoSrc} alt="ByteBud logo" />
      ) : (
        // LOGO PLACEHOLDER: pass logoSrc to AuthPage (or replace this block with your <img />).
        <div className="ap-logo-placeholder" aria-hidden="true">
          LOGO
        </div>
      )}
      <span className="ap-logo-name">ByteBud</span>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AuthPage({
  initialMode = "login",
  logoSrc,
  onLogin = demoHandler("login"),
  onRegister = demoHandler("register"),
  showForgotPassword = false,
  onForgotPassword = demoHandler("forgot password"),
  onSuccess,
}) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const firstFieldRef = useRef(null);
  const isRegister = mode === "register";

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const forgotDialogRef = useRef(null);
  const forgotEmailRef = useRef(null);

  // Follow the route if it changes between /login and /register.
  useEffect(() => {
    setMode(initialMode);
    setErrors({});
    setFormError("");
  }, [initialMode]);

  // Focus the first field when the mode changes.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [mode]);

  // Forgot password modal: lock scroll, close on Esc, keep Tab focus inside, restore focus on close.
  useEffect(() => {
    if (!forgotOpen) return;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setForgotOpen(false);
        return;
      }
      if (event.key !== "Tab" || !forgotDialogRef.current) return;

      const focusable = forgotDialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), a[href]'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [forgotOpen]);

  // Focus the email field when the modal opens or the user tries again.
  useEffect(() => {
    if (forgotOpen && !forgotSent) forgotEmailRef.current?.focus();
  }, [forgotOpen, forgotSent]);

  const openForgot = () => {
    setForgotEmail(form.email.trim());
    setForgotError("");
    setForgotSent(false);
    setForgotLoading(false);
    setForgotOpen(true);
  };

  const closeForgot = () => setForgotOpen(false);

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    if (forgotLoading) return;

    const email = forgotEmail.trim();
    if (!email) {
      setForgotError("Enter your email address.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setForgotError("Enter a valid email address.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");
    try {
      await onForgotPassword({ email: email.toLowerCase() });
      setForgotSent(true);
    } catch (error) {
      setForgotError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError("");
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setErrors({});
    setFormError("");
    setShowPassword(false);
  };

  const validate = () => {
    const next = {};
    const email = form.email.trim();

    if (isRegister && !form.fullName.trim()) {
      next.fullName = "Enter your full name.";
    }
    if (!email) {
      next.email = "Enter your email address.";
    } else if (!EMAIL_RE.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (!form.password) {
      next.password = "Enter your password.";
    } else if (isRegister && form.password.length < 8) {
      next.password = "Use at least 8 characters.";
    }
    if (isRegister && form.isStudent) {
      const schoolEmail = form.schoolEmail.trim();
      if (!schoolEmail) {
        next.schoolEmail = "Enter your school email to verify your student status.";
      } else if (!EMAIL_RE.test(schoolEmail)) {
        next.schoolEmail = "Enter a valid school email address.";
      }
    }
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    setFormError("");

    try {
      if (isRegister) {
        await onRegister({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          isStudent: form.isStudent,
          schoolEmail: form.isStudent ? form.schoolEmail.trim().toLowerCase() : null,
        });
      } else {
        await onLogin({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
      }
      onSuccess?.();
    } catch (error) {
      setFormError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ap-page">
      {/* ---------- Left: form ---------- */}
      <section className="ap-form-side">
        <header className="ap-topbar">
          <Logo logoSrc={logoSrc} />
        </header>

        <div className="ap-form-wrap">
          <h1 className="ap-title">{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="ap-subtitle">
            {isRegister
              ? "Sign up to reserve laptops, check out, and get student pricing."
              : "Log in to reserve laptops and track your orders."}
          </p>

          <div className="ap-tabs" role="tablist" aria-label="Log in or register">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={`ap-tab ${!isRegister ? "is-active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={`ap-tab ${isRegister ? "is-active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          <form className="ap-form" onSubmit={handleSubmit} noValidate>
            {formError && (
              <div className="ap-alert" role="alert">
                {formError}
              </div>
            )}

            {isRegister && (
              <div className="ap-name-phone-row">
                <div className="ap-field">
                  <label htmlFor="ap-fullname">Full name</label>
                  <input
                    id="ap-fullname"
                    ref={firstFieldRef}
                    type="text"
                    autoComplete="name"
                    placeholder="Juan Dela Cruz"
                    value={form.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? "ap-fullname-error" : undefined}
                  />
                  {errors.fullName && (
                    <p className="ap-error" id="ap-fullname-error">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="ap-field">
                  <label htmlFor="ap-phone">Phone number <span className="ap-optional">(optional)</span></label>
                  <input
                    id="ap-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+63 912 345 6789"
                    maxLength={32}
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="ap-field">
              <label htmlFor="ap-email">Email</label>
              <input
                id="ap-email"
                ref={isRegister ? undefined : firstFieldRef}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "ap-email-error" : undefined}
              />
              {errors.email && (
                <p className="ap-error" id="ap-email-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="ap-field">
              <div className="ap-label-row">
                <label htmlFor="ap-password">Password</label>
                {!isRegister && showForgotPassword && (
                  <button type="button" className="ap-link ap-forgot" onClick={openForgot}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="ap-password">
                <input
                  id="ap-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? "At least 8 characters" : "Your password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "ap-password-error" : undefined}
                />
                <button
                  type="button"
                  className="ap-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {errors.password && (
                <p className="ap-error" id="ap-password-error">
                  {errors.password}
                </p>
              )}
            </div>

            {isRegister && (
              <div className="ap-student">
                <label className="ap-check" htmlFor="ap-student">
                  <input
                    id="ap-student"
                    type="checkbox"
                    checked={form.isStudent}
                    onChange={(e) => setField("isStudent", e.target.checked)}
                  />
                  <span className="ap-check-box" aria-hidden="true" />
                  <span className="ap-check-text">
                    I'm a student
                    <small>Get student pricing after we verify your school.</small>
                  </span>
                </label>

                {form.isStudent && (
                  <div className="ap-field ap-field-nested">
                    <label htmlFor="ap-school-email">School email</label>
                    <input
                      id="ap-school-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@school.edu.ph"
                      value={form.schoolEmail}
                      onChange={(e) => setField("schoolEmail", e.target.value)}
                      aria-invalid={!!errors.schoolEmail}
                      aria-describedby={errors.schoolEmail ? "ap-school-error" : "ap-school-hint"}
                    />
                    {errors.schoolEmail ? (
                      <p className="ap-error" id="ap-school-error">
                        {errors.schoolEmail}
                      </p>
                    ) : (
                      <p className="ap-hint" id="ap-school-hint">
                        Use the email your partner school gave you. You can upload proof later from your account.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="ap-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="ap-spinner" aria-hidden="true" />
                  {isRegister ? "Creating account..." : "Logging in..."}
                </>
              ) : isRegister ? (
                "Create account"
              ) : (
                "Log in"
              )}
            </button>
          </form>

          <p className="ap-switch">
            {isRegister ? "Already have an account?" : "New to ByteBud?"}{" "}
            <button
              type="button"
              className="ap-link"
              onClick={() => switchMode(isRegister ? "login" : "register")}
            >
              {isRegister ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>

      {/* ---------- Right: slogan ---------- */}
      <aside className="ap-hero-side" aria-label="About ByteBud">
        <div className="ap-hero-glow" aria-hidden="true" />
        <div className="ap-hero-content">
          <h2 className="ap-slogan">The right laptop for your course, at a price that fits.</h2>
          <p className="ap-slogan-sub">
            Refurbished and surplus business laptops, tested and graded, then matched to what you study.
          </p>

          <ul className="ap-points">
            <li>
              <CheckIcon />
              <span>Every laptop inspected, graded, and data-wiped</span>
            </li>
            <li>
              <CheckIcon />
              <span>Warranty included with every purchase</span>
            </li>
            <li>
              <CheckIcon />
              <span>Student pricing for verified students</span>
            </li>
          </ul>
        </div>
      </aside>

      {/* ---------- Forgot password modal ---------- */}
      {showForgotPassword && forgotOpen && (
        <div
          className="ap-fp-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForgot();
          }}
        >
          <div
            className="ap-fp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ap-fp-title"
            ref={forgotDialogRef}
          >
            <button type="button" className="ap-fp-close" onClick={closeForgot} aria-label="Close">
              <CloseIcon />
            </button>

            {forgotSent ? (
              <div className="ap-fp-body">
                <div className="ap-fp-icon is-success">
                  <MailCheckIcon />
                </div>
                <h2 id="ap-fp-title" className="ap-fp-title">
                  Check your email
                </h2>
                <p className="ap-fp-text">
                  If an account exists for <strong>{forgotEmail.trim()}</strong>, we've sent a link to reset your
                  password. The link expires soon, so use it right away.
                </p>
                <button type="button" className="ap-submit" onClick={closeForgot}>
                  Back to log in
                </button>
                <p className="ap-switch">
                  Didn't get it?{" "}
                  <button type="button" className="ap-link" onClick={() => setForgotSent(false)}>
                    Try again
                  </button>
                </p>
              </div>
            ) : (
              <form className="ap-fp-body" onSubmit={handleForgotSubmit} noValidate>
                <div className="ap-fp-icon">
                  <MailIcon />
                </div>
                <h2 id="ap-fp-title" className="ap-fp-title">
                  Reset your password
                </h2>
                <p className="ap-fp-text">
                  Enter the email you signed up with and we'll send you a link to choose a new password.
                </p>

                {forgotError && (
                  <div className="ap-alert" role="alert">
                    {forgotError}
                  </div>
                )}

                <div className="ap-field">
                  <label htmlFor="ap-fp-email">Email</label>
                  <input
                    id="ap-fp-email"
                    ref={forgotEmailRef}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      setForgotError("");
                    }}
                    aria-invalid={!!forgotError}
                  />
                </div>

                <button type="submit" className="ap-submit" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <span className="ap-spinner" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>

                <p className="ap-switch">
                  Remembered it?{" "}
                  <button type="button" className="ap-link" onClick={closeForgot}>
                    Back to log in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
