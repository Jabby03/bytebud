import { useEffect, useRef } from "react";
import "./AdminShared.css";

/**
 * Shared pieces for the ByteBud admin panel:
 * constants (status lists), formatters, icons, StatusBadge, Drawer, Modal, Field, Pagination, Toast.
 *
 * The diagram does not list enum values, so the lists below are ASSUMPTIONS. Change them here
 * (one place) to match what you store in MongoDB.
 */

/* ---------- Status lists (assumed enum values) ---------- */

export const UNIT_STATUSES = [
  { value: "awaiting_inspection", label: "Awaiting inspection", tone: "amber" },
  { value: "in_repair", label: "In repair", tone: "red" },
  { value: "ready_to_list", label: "Ready to list", tone: "grey" },
  { value: "available", label: "Available", tone: "green" },
  { value: "reserved", label: "Reserved", tone: "burgundy" },
  { value: "sold", label: "Sold", tone: "dark" },
];

export const GRADES = [
  { value: "A", label: "Grade A" },
  { value: "B", label: "Grade B" },
  { value: "C", label: "Grade C" },
];

export const ACQ_STATUSES = [
  { value: "ordered", label: "Ordered", tone: "grey" },
  { value: "received", label: "Received", tone: "amber" },
  { value: "split", label: "Units created", tone: "green" },
];

export const SOURCE_TYPES = [
  { value: "corporate_surplus", label: "Corporate surplus" },
  { value: "refurbished", label: "Refurbished stock" },
  { value: "trade_in", label: "Trade-in" },
];

export const SUPPLIER_TYPES = [
  { value: "corporate", label: "Corporate" },
  { value: "refurbisher", label: "Refurbisher" },
  { value: "individual", label: "Individual" },
];

export const labelOf = (list, value) => list.find((i) => i.value === value)?.label ?? value ?? "";

/* ---------- Formatters ---------- */

const pesoFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export const formatPeso = (n) => (n == null || n === "" || Number.isNaN(Number(n)) ? "-" : pesoFormat.format(Number(n)));

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "-";

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "-";

export function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)} hr ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)} ${Math.floor(days) === 1 ? "day" : "days"} ago`;
  return formatDate(iso);
}

const pad = (n) => String(n).padStart(2, "0");

export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);
export const toDateInput = (iso) => (iso ? toLocalInput(iso).slice(0, 10) : "");
export const fromDateInput = (value) => (value ? new Date(`${value}T00:00:00`).toISOString() : null);

export const toNumber = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/* ---------- Icons ---------- */

const icon = (children, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {children}
  </svg>
);
const stroke = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const CloseIcon = () => icon(<path d="M6 6l12 12M18 6L6 18" {...stroke} />, 20);
export const PlusIcon = () => icon(<path d="M12 5v14M5 12h14" {...stroke} />);
export const CheckIcon = () => icon(<path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} />, 16);
export const CrossIcon = () => icon(<path d="M7 7l10 10M17 7L7 17" {...stroke} />, 16);
export const TrashIcon = () =>
  icon(
    <>
      <path d="M4 7h16M10 11v6M14 11v6" {...stroke} />
      <path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7M9 7V4.5h6V7" {...stroke} />
    </>
  );
export const ImageIcon = ({ size = 22 }) =>
  icon(
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" {...stroke} strokeWidth="1.6" />
    </>,
    size
  );
export const SearchIcon = () =>
  icon(
    <>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4.5 4.5" {...stroke} />
    </>
  );

/* ---------- Small components ---------- */

export function StatusBadge({ list, value }) {
  const item = list.find((i) => i.value === value);
  return <span className={`ad-badge tone-${item?.tone || "grey"}`}>{item?.label ?? value ?? "-"}</span>;
}

export function Field({ label, htmlFor, error, hint, className = "", children }) {
  return (
    <div className={`ad-field ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="ad-error">{error}</p> : hint ? <p className="ad-hint">{hint}</p> : null}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="ad-pagination" aria-label="Pagination">
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange(page - 1)} disabled={page === 1}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange(page + 1)} disabled={page === totalPages}>
        Next
      </button>
    </nav>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`ad-toast ${toast.type === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}

/* ---------- Dialog behaviour (Esc, scroll lock, focus trap) shared by Drawer and Modal ---------- */

const dialogStack = [];

function useDialog(open, onClose, panelRef) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = {};
    dialogStack.push(token);

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (event) => {
      if (dialogStack[dialogStack.length - 1] !== token) return; // only the top-most dialog reacts
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

/** Right-side drawer with optional sub-tabs and a sticky footer. */
export function Drawer({ open, onClose, title, subtitle, badge, tabs, activeTab, onTabChange, footer, children }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef);
  if (!open) return null;

  return (
    <div
      className="ad-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <aside className="ad-drawer" role="dialog" aria-modal="true" aria-labelledby="ad-drawer-title" tabIndex={-1} ref={panelRef}>
        <header className="ad-drawer-head">
          <div className="ad-drawer-titles">
            <h2 id="ad-drawer-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {badge}
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        {tabs && (
          <div className="ad-subtabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                className={`ad-subtab ${activeTab === t.key ? "is-active" : ""}`}
                disabled={t.disabled}
                onClick={() => onTabChange?.(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="ad-drawer-body">{children}</div>
        {footer && <footer className="ad-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

/** Centered modal dialog. */
export function Modal({ open, onClose, title, footer, size = "md", children }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef);
  if (!open) return null;

  return (
    <div
      className="ad-overlay is-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`ad-modal size-${size}`} role="dialog" aria-modal="true" aria-labelledby="ad-modal-title" tabIndex={-1} ref={panelRef}>
        <header className="ad-modal-head">
          <h2 id="ad-modal-title">{title}</h2>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="ad-modal-body">{children}</div>
        {footer && <footer className="ad-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
