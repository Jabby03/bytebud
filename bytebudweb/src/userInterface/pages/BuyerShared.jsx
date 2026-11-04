import { useEffect, useRef, useState } from "react";
import Navbar from "../components/NavbarHome.jsx";
import Footer from "../components/FooterHome.jsx";
import "./BuyerShared.css";

/**
 * Shared UI for the buyer pages A2 to A4: page shell (navbar + footer), Modal, Drawer, Toast,
 * StatusChip, Field, icons, and the useNow clock hook.
 */

/* ---------- Icons ---------- */

const base = { fill: "none", "aria-hidden": true };
const st = { stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };

export const CheckIcon = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" {...st} /></svg>
);
export const CrossIcon = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" {...st} /></svg>
);
export const CloseIcon = () => (
  <svg {...base} width="20" height="20" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" {...st} strokeWidth="2" /></svg>
);
export const ChevronIcon = ({ dir = "right", size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" style={{ transform: { left: "rotate(180deg)", down: "rotate(90deg)", up: "rotate(-90deg)" }[dir] }}>
    <path d="M9 5l7 7-7 7" {...st} />
  </svg>
);
export const LaptopIcon = ({ size = 56 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24">
    <rect x="5" y="5.5" width="14" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 18.5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
export const BatteryIcon = () => (
  <svg {...base} width="18" height="18" viewBox="0 0 24 24">
    <rect x="3" y="7.5" width="16" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M21 10.5v3M6.5 10.5v3M9.5 10.5v3" {...st} strokeWidth="1.7" />
  </svg>
);
export const ShieldIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V5.8L12 3Z" {...st} strokeWidth="1.7" />
    <path d="M8.8 12l2.2 2.2 4.2-4.4" {...st} strokeWidth="1.7" />
  </svg>
);
export const InfoIcon = () => (
  <svg {...base} width="16" height="16" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 11v5M12 7.8v.01" {...st} strokeWidth="2" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...base} width="18" height="18" viewBox="0 0 24 24">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7M9 7V4.5h6V7" {...st} />
  </svg>
);
export const ClockIcon = () => (
  <svg {...base} width="16" height="16" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7.5V12l3 2" {...st} />
  </svg>
);

/* ---------- Hooks ---------- */

/** Current time in ms, refreshed every `intervalMs` while `enabled`. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

const dialogStack = [];

function useDialog(open, onClose, panelRef) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    dialogStack.push(token);
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (event) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
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
      dialogStack.splice(dialogStack.indexOf(token), 1);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}

/* ---------- Components ---------- */

export function StatusChip({ tone = "grey", children }) {
  return <span className={`by-chip tone-${tone}`}>{children}</span>;
}

export function Field({ label, htmlFor, error, hint, className = "", children }) {
  return (
    <div className={`by-field ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="by-error">{error}</p> : hint ? <p className="by-hint">{hint}</p> : null}
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`by-toast ${toast.type === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}

/** Small hook for toasts: const [toast, notify] = useToast(); */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const notify = (message, type = "success") => {
    setToast({ message, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3400);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, notify];
}

export function Modal({ open, onClose, title, footer, children }) {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="by-overlay is-center" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="by-modal" role="dialog" aria-modal="true" aria-labelledby="by-modal-title" tabIndex={-1} ref={ref}>
        <header className="by-modal-head">
          <h2 id="by-modal-title">{title}</h2>
          <button type="button" className="by-icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>
        <div className="by-modal-body">{children}</div>
        {footer && <footer className="by-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, badge, footer, children }) {
  const ref = useRef(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="by-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside className="by-drawer" role="dialog" aria-modal="true" aria-labelledby="by-drawer-title" tabIndex={-1} ref={ref}>
        <header className="by-drawer-head">
          <div className="by-drawer-titles">
            <h2 id="by-drawer-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {badge}
          <button type="button" className="by-icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>
        <div className="by-drawer-body">{children}</div>
        {footer && <footer className="by-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

/** Page shell shared by A2 to A4: navbar, main area, footer. */
export function BuyerShell({ active, user, cartCount, logoSrc, onLogout, onNavigate, children }) {
  return (
    <div className="by-page">
      <Navbar user={user} cartCount={cartCount} logoSrc={logoSrc} onLogout={onLogout} onNavigate={onNavigate} activePage={active} />
      <main className="by-main">{children}</main>
      <Footer logoSrc={logoSrc} />
    </div>
  );
}
