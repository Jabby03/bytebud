import { useEffect, useMemo, useRef, useState } from "react";
import { BuyerShell, ChevronIcon, ClockIcon, Drawer, Field, LaptopIcon, Modal, ShieldIcon, StatusChip, Toast, useNow, useToast } from "./BuyerShared";
import { formatDate, formatPeso } from "./buyerUtils";
import "./MyAccountPage.css";

/**
 * ByteBud: A4. My Account (/account)
 *
 * <MyAccountPage
 *   initialTab="orders"                    // orders | warranty | verification | profile (also read from ?tab=)
 *   user={{ fullName, email, phone }}      // Users
 *   orders={[...]}                         // this user's Orders (with orderItems[], statusHistory[], returns[], payment)
 *   warranties={[...]}                     // this user's Warranties (with claims[])
 *   verifications={[...]}                  // this user's Student_Verifications records
 *   cartCount={0}                          // for the navbar badge
 *   onTabChange={(tab) => {}}              // keep ?tab= in the URL if you want
 *   onFileClaim={async ({ warrantyId, claimType, description }) => ({ claimNo })}
 *   onRequestReturn={async ({ orderId, returnUnitId, reason }) => {}}
 *   onSubmitProof={async ({ schoolEmail, file }) => ({ verificationId, proofUrl })}
 *   onSaveProfile={async ({ fullName, phone }) => {}}
 *   onChangePassword={async ({ currentPassword, newPassword }) => {}}
 *   onNavigate={(href) => navigate(href)}
 *   onLogout={() => {}}
 * />
 * Every handler may throw an Error; its message is shown to the buyer.
 * After a successful action the page adds the new record locally; pass fresh arrays after you refetch.
 * App supplies live account records from the buyer account API.
 */

/* ---------- Constants and helpers ---------- */

const TABS = [
  { key: "orders", label: "Orders" },
  { key: "warranty", label: "Warranty & Returns" },
  { key: "verification", label: "Student Verification" },
  { key: "profile", label: "Profile" },
];

// Status values are suggestions from the plan; adjust to your enums.
const ORDER_STATUS = {
  pending: { label: "Pending", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "burgundy" },
  ready_for_pickup: { label: "Ready for pickup", tone: "green" },
  picked_up: { label: "Picked up", tone: "dark" },
  cancelled: { label: "Cancelled", tone: "grey" },
};
const PAY_STATUS = {
  pending: { label: "Pending", tone: "amber" },
  unpaid: { label: "Unpaid", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  refunded: { label: "Refunded", tone: "grey" },
};
const RETURN_STATUS = {
  requested: { label: "Requested", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  refunded: { label: "Refunded", tone: "green" },
};
const CLAIM_STATUS = {
  filed: { label: "Filed", tone: "amber" },
  in_review: { label: "In review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  resolved: { label: "Resolved", tone: "green" },
};
const VERIF_STATUS = {
  none: { label: "Not verified", tone: "grey" },
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  expired: { label: "Expired", tone: "grey" },
};
const CLAIM_TYPES = ["Screen", "Keyboard", "Battery", "Ports", "Performance", "Other"];
const PROOF_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const DAY_MS = 86400000;

const humanize = (v) => (v ? String(v).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "-");
const statusMeta = (map, key) => map[key] || { label: humanize(key), tone: "grey" };
const toTime = (d) => (d ? new Date(d).getTime() : 0);
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
};
const formatDateTime = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};
const normalizePhone = (v) => v.replace(/[\s-]/g, "");
const isValidPhone = (v) => /^(09\d{9}|\+639\d{9})$/.test(normalizePhone(v));
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const itemLabel = (snap = {}) => `${snap.snapBrand || ""} ${snap.snapModelName || "Laptop"}`.trim();

function readTab(initial) {
  const keys = TABS.map((t) => t.key);
  if (keys.includes(initial)) return initial;
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (keys.includes(q)) return q;
  }
  return "orders";
}

/* ---------- Orders tab ---------- */

function OrdersTab({ orders, onOpen, go }) {
  if (!orders.length) {
    return (
      <div className="by-empty">
        <div className="by-empty-icon"><LaptopIcon size={30} /></div>
        <h2>No orders yet</h2>
        <p>When you place an order it will show up here, with its status and pickup details.</p>
        <a className="by-btn by-btn-primary" href="/" onClick={(e) => go(e, "/")}>Find a laptop</a>
      </div>
    );
  }
  return (
    <section aria-labelledby="ma-orders-title">
      <h2 id="ma-orders-title" className="ma-h2">Your orders</h2>
      <div className="ma-orders-head" aria-hidden="true">
        <span>Order</span><span>Date</span><span>Status</span><span className="is-right">Total</span><span />
      </div>
      <ul className="ma-orders">
        {orders.map((o) => {
          const s = statusMeta(ORDER_STATUS, o.orderStatus);
          return (
            <li key={o.orderId}>
              <button type="button" className="ma-order" onClick={() => onOpen(o.orderId)} aria-label={`View order ${o.orderNo}`}>
                <strong className="ma-order-no">{o.orderNo}</strong>
                <span className="ma-order-date">{formatDate(o.orderCreatedAt)}</span>
                <span className="ma-order-status"><StatusChip tone={s.tone}>{s.label}</StatusChip></span>
                <span className="ma-order-total">{formatPeso(o.total)}</span>
                <span className="ma-order-go"><ChevronIcon /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OrderDrawer({ order, onClose, onGoWarranty }) {
  const s = statusMeta(ORDER_STATUS, order?.orderStatus);
  const history = order ? [...(order.statusHistory || [])].sort((a, b) => toTime(a.changedAt) - toTime(b.changedAt)) : [];
  const pay = order?.payment || {};
  const payStatus = statusMeta(PAY_STATUS, pay.payStatus);

  return (
    <Drawer
      open={!!order}
      onClose={onClose}
      title={order?.orderNo}
      subtitle={order ? `Placed ${formatDate(order.orderCreatedAt)}` : ""}
      badge={order ? <StatusChip tone={s.tone}>{s.label}</StatusChip> : null}
      footer={
        order && (
          <>
            <button type="button" className="by-btn by-btn-ghost by-btn-sm" onClick={onClose}>Close</button>
            {order.orderStatus === "picked_up" && (
              <button type="button" className="by-btn by-btn-primary by-btn-sm" onClick={onGoWarranty}>Warranty and returns</button>
            )}
          </>
        )
      }
    >
      {order && (
        <>
          <section className="ma-section">
            <h3 className="ma-h3">Status</h3>
            {history.length ? (
              <ol className="ma-timeline">
                {history.map((h, i) => (
                  <li key={`${h.newStatus}-${i}`} className={i === history.length - 1 ? "is-current" : ""}>
                    <span className="ma-dot" />
                    <div>
                      <strong>{statusMeta(ORDER_STATUS, h.newStatus).label}</strong>
                      <span>{formatDateTime(h.changedAt)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ma-muted">Current status: {s.label}.</p>
            )}
          </section>

          <section className="ma-section">
            <h3 className="ma-h3">Laptops</h3>
            <ul className="ma-lines">
              {(order.orderItems || []).map((item) => {
                const snap = item.snapshot || {};
                return (
                  <li key={item.unitId} className="ma-line">
                    <div className="ma-line-info">
                      <strong>{itemLabel(snap)}</strong>
                      <span>Serial: {snap.snapSerialNumber || "-"}</span>
                      {snap.snapConditionGrades && <StatusChip tone={snap.snapConditionGrades === "A" ? "burgundy" : "grey"}>Grade {snap.snapConditionGrades}</StatusChip>}
                    </div>
                    <div className="ma-line-price">
                      <strong>{formatPeso(item.priceAtSale)}</strong>
                      {item.discountAmount > 0 && <span className="is-green">Student discount -{formatPeso(item.discountAmount)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="ma-section">
            <h3 className="ma-h3">Pickup</h3>
            <dl className="ma-kv">
              <div><dt>Pickup date</dt><dd>{formatDate(order.pickupDate)}</dd></div>
              <div><dt>Picked up</dt><dd>{order.pickedUpAt ? formatDate(order.pickedUpAt) : "Not yet"}</dd></div>
            </dl>
          </section>

          <section className="ma-section">
            <h3 className="ma-h3">Payment</h3>
            <dl className="ma-kv">
              <div><dt>Method</dt><dd>{pay.method || "-"}</dd></div>
              <div><dt>Status</dt><dd><StatusChip tone={payStatus.tone}>{payStatus.label}</StatusChip></dd></div>
              {pay.reference && <div><dt>Reference</dt><dd>{pay.reference}</dd></div>}
              {pay.paidAt && <div><dt>Paid on</dt><dd>{formatDate(pay.paidAt)}</dd></div>}
            </dl>
          </section>

          <section className="ma-section">
            <h3 className="ma-h3">Totals</h3>
            <dl className="ma-kv">
              <div><dt>Subtotal</dt><dd>{formatPeso(order.subtotal)}</dd></div>
              {order.discountTotal > 0 && <div className="is-green"><dt>Student discount</dt><dd>-{formatPeso(order.discountTotal)}</dd></div>}
              <div className="is-total"><dt>Total</dt><dd>{formatPeso(order.total)}</dd></div>
            </dl>
          </section>
        </>
      )}
    </Drawer>
  );
}

/* ---------- Warranty & Returns tab (picked-up orders only) ---------- */

function WarrantyTab({ orders, warranties, now, onClaim, onReturn, goOrders }) {
  const pickedUp = orders.filter((o) => o.orderStatus === "picked_up");

  if (!pickedUp.length) {
    return (
      <div className="by-empty">
        <div className="by-empty-icon"><ShieldIcon size={30} /></div>
        <h2>Nothing here yet</h2>
        <p>Your warranty and return period start the day you pick up your laptop. Once you do, you can file claims and request returns here.</p>
        <button type="button" className="by-btn by-btn-primary" onClick={goOrders}>View my orders</button>
      </div>
    );
  }

  return (
    <div className="ma-stack">
      {pickedUp.map((order) => (
        <section key={order.orderId} className="ma-card" aria-label={`Order ${order.orderNo}`}>
          <header className="ma-card-head">
            <h2 className="ma-h2">Order {order.orderNo}</h2>
            <span className="ma-muted">Picked up on {formatDate(order.pickedUpAt || order.pickupDate)}</span>
          </header>

          {(order.orderItems || []).map((item) => {
            const snap = item.snapshot || {};
            const w = warranties.find((x) => x.orderId === order.orderId && x.unitId === item.unitId);
            const ret = (order.returns || []).find((r) => r.returnUnitId === item.unitId);
            const deadline = item.returnDeadline ? endOfDay(item.returnDeadline) : null;
            const canReturn = !ret && deadline != null && now <= deadline;
            const wActive = !!w && endOfDay(w.endDate) >= now;
            const daysLeft = w ? Math.max(0, Math.ceil((endOfDay(w.endDate) - now) / DAY_MS)) : 0;
            const claims = [...(w?.claims || [])].sort((a, b) => toTime(b.filedAt) - toTime(a.filedAt));
            const retStatus = ret ? statusMeta(RETURN_STATUS, ret.returnStatus) : null;
            const label = itemLabel(snap);

            return (
              <article key={item.unitId} className="ma-unit">
                <div className="ma-unit-head">
                  <div>
                    <strong>{label}</strong>
                    <span className="ma-muted">Serial: {snap.snapSerialNumber || "-"}</span>
                  </div>
                  {snap.snapConditionGrades && <StatusChip tone={snap.snapConditionGrades === "A" ? "burgundy" : "grey"}>Grade {snap.snapConditionGrades}</StatusChip>}
                </div>

                {/* Warranty */}
                <div className="ma-block">
                  <div className="ma-block-head">
                    <h3 className="ma-h3"><ShieldIcon size={18} /> Warranty</h3>
                    {w && <StatusChip tone={wActive ? "green" : "grey"}>{wActive ? "Active" : "Expired"}</StatusChip>}
                  </div>
                  {w ? (
                    <>
                      <dl className="ma-kv">
                        <div><dt>Valid</dt><dd>{formatDate(w.startDate)} to {formatDate(w.endDate)}</dd></div>
                        {wActive && <div><dt>Time left</dt><dd>{daysLeft} {daysLeft === 1 ? "day" : "days"}</dd></div>}
                        {w.extensionMonths > 0 && <div><dt>Extension</dt><dd>{w.extensionMonths} months</dd></div>}
                        <div><dt>Type</dt><dd>{humanize(w.source)}</dd></div>
                      </dl>

                      <div className="ma-block-actions">
                        <button
                          type="button"
                          className="by-btn by-btn-outline by-btn-sm"
                          disabled={!wActive}
                          onClick={() => onClaim({ warrantyId: w.warrantyId, label })}
                        >
                          File a claim
                        </button>
                        {!wActive && <span className="ma-muted">The warranty has ended, so new claims cannot be filed.</span>}
                      </div>

                      {claims.length > 0 && (
                        <ul className="ma-claims" aria-label="Your claims">
                          {claims.map((c) => {
                            const cs = statusMeta(CLAIM_STATUS, c.claimStatus);
                            return (
                              <li key={c.claimNo} className="ma-claim">
                                <div className="ma-claim-top">
                                  <strong>{c.claimNo}</strong>
                                  <span className="ma-claim-type">{c.claimType}</span>
                                  <StatusChip tone={cs.tone}>{cs.label}</StatusChip>
                                </div>
                                {c.description && <p>{c.description}</p>}
                                <span className="ma-muted">Filed {formatDate(c.filedAt)}</span>
                                {c.resolution && (
                                  <p className="ma-resolution">
                                    <strong>Resolution{c.claimResolvedAt ? ` (${formatDate(c.claimResolvedAt)})` : ""}:</strong> {c.resolution}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="ma-muted">Your warranty record is not available yet. Please check again soon.</p>
                  )}
                </div>

                {/* Return */}
                <div className="ma-block">
                  <div className="ma-block-head">
                    <h3 className="ma-h3"><ClockIcon /> Return</h3>
                    {retStatus && <StatusChip tone={retStatus.tone}>{retStatus.label}</StatusChip>}
                  </div>

                  {ret ? (
                    <dl className="ma-kv">
                      <div><dt>Requested</dt><dd>{formatDate(ret.requestedAt)}</dd></div>
                      <div><dt>Reason</dt><dd>{ret.reason}</dd></div>
                      {ret.returnResolveAt && <div><dt>Decided</dt><dd>{formatDate(ret.returnResolveAt)}</dd></div>}
                      {ret.refundAmount > 0 && <div><dt>Refund</dt><dd>{formatPeso(ret.refundAmount)}</dd></div>}
                    </dl>
                  ) : canReturn ? (
                    <>
                      <p className="ma-muted">You can request a return until {formatDate(item.returnDeadline)}.</p>
                      <div className="ma-block-actions">
                        <button type="button" className="by-btn by-btn-ghost by-btn-sm" onClick={() => onReturn({ orderId: order.orderId, unitId: item.unitId, label, deadline: item.returnDeadline })}>
                          Request a return
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="ma-muted">
                      {item.returnDeadline ? `The return period ended on ${formatDate(item.returnDeadline)}.` : "No return period is set for this laptop."}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function ClaimModal({ target, onClose, onSubmit }) {
  const [claimType, setClaimType] = useState(CLAIM_TYPES[0]);
  const [description, setDescription] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (description.trim().length < 10) {
      setFieldError("Please describe the problem (at least 10 characters).");
      return;
    }
    setFieldError("");
    setBusy(true);
    try {
      await onSubmit({ warrantyId: target.warrantyId, claimType, description: description.trim() });
      onClose();
    } catch (e) {
      setError(e?.message || "We could not file your claim. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="File a claim"
      footer={
        <>
          <button type="button" className="by-btn by-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="ma-claim-form" className="by-btn by-btn-primary" disabled={busy}>{busy ? "Filing..." : "File claim"}</button>
        </>
      }
    >
      <p>Laptop: <strong>{target.label}</strong></p>
      {error && <div className="by-alert" role="alert">{error}</div>}
      <form id="ma-claim-form" className="ma-form" onSubmit={submit} noValidate>
        <Field label="What is the problem about?" htmlFor="ma-claim-type">
          <select id="ma-claim-type" value={claimType} onChange={(e) => setClaimType(e.target.value)}>
            {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Describe the problem" htmlFor="ma-claim-desc" error={fieldError} hint="Tell us what happens and when it started.">
          <textarea id="ma-claim-desc" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={fieldError ? "true" : undefined} />
        </Field>
      </form>
    </Modal>
  );
}

function ReturnModal({ target, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 10) {
      setFieldError("Please tell us why you are returning it (at least 10 characters).");
      return;
    }
    setFieldError("");
    setBusy(true);
    try {
      await onSubmit({ orderId: target.orderId, returnUnitId: target.unitId, reason: reason.trim() });
      onClose();
    } catch (e) {
      setError(e?.message || "We could not send your request. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Request a return"
      footer={
        <>
          <button type="button" className="by-btn by-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="ma-return-form" className="by-btn by-btn-primary" disabled={busy}>{busy ? "Sending..." : "Send request"}</button>
        </>
      }
    >
      <p>Laptop: <strong>{target.label}</strong></p>
      <p className="by-note">Our staff review every request, and you can follow its status in this tab. Returns must be requested by {formatDate(target.deadline)}.</p>
      {error && <div className="by-alert" role="alert">{error}</div>}
      <form id="ma-return-form" className="ma-form" onSubmit={submit} noValidate>
        <Field label="Reason for the return" htmlFor="ma-return-reason" error={fieldError}>
          <textarea id="ma-return-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={fieldError ? "true" : undefined} />
        </Field>
      </form>
    </Modal>
  );
}

/* ---------- Student Verification tab ---------- */

function VerificationTab({ records, now, onSubmit }) {
  const sorted = [...records].sort((a, b) => toTime(b.submittedAt || b.verifiedAt) - toTime(a.submittedAt || a.verifiedAt));
  const latest = sorted[0] || null;
  const activeApproved = records.find((r) => r.verifStatus === "approved" && r.expiresAt && toTime(r.expiresAt) > now);

  let key = "none";
  if (activeApproved) key = "approved";
  else if (latest) key = latest.verifStatus === "pending" ? "pending" : latest.verifStatus === "rejected" ? "rejected" : latest.verifStatus === "approved" ? "expired" : "none";

  const meta = VERIF_STATUS[key];
  const shown = key === "approved" ? activeApproved : latest;
  const canSubmit = ["none", "rejected", "expired"].includes(key);

  const text = {
    none: "You are not verified yet. Verify as a student to get the student price on every laptop.",
    pending: `Your proof is under review${shown?.submittedAt ? `. You sent it on ${formatDate(shown.submittedAt)}` : ""}. We will update this page once it is reviewed.`,
    approved: `You are a verified student. Student prices apply until ${formatDate(shown?.expiresAt)}.`,
    rejected: "Your last proof was not accepted. Please send a new one.",
    expired: `Your verification expired${shown?.expiresAt ? ` on ${formatDate(shown.expiresAt)}` : ""}. Send your proof again to keep the student price.`,
  }[key];

  return (
    <div className="ma-stack">
      <section className="ma-card ma-verif" aria-labelledby="ma-verif-title">
        <div className="ma-verif-head">
          <h2 id="ma-verif-title" className="ma-h2">Student status</h2>
          <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
        </div>
        <p className="ma-verif-text">{text}</p>

        {key === "rejected" && shown?.remarks && (
          <p className="by-alert"><strong>Reason:</strong> {shown.remarks}</p>
        )}

        {canSubmit && (
          <button type="button" className="by-btn by-btn-primary" onClick={onSubmit}>
            {key === "none" ? "Submit proof" : "Submit new proof"}
          </button>
        )}
        {key === "pending" && <p className="ma-muted">You cannot send another proof while this one is being reviewed.</p>}
      </section>

      {sorted.length > 0 && (
        <section className="ma-card" aria-labelledby="ma-history-title">
          <h2 id="ma-history-title" className="ma-h2">History</h2>
          <ul className="ma-history">
            {sorted.map((r, i) => {
              const expired = r.verifStatus === "approved" && !(r.expiresAt && toTime(r.expiresAt) > now);
              const s = VERIF_STATUS[expired ? "expired" : r.verifStatus] || VERIF_STATUS.none;
              return (
                <li key={r.verificationId || i} className="ma-history-row">
                  <div>
                    <strong>{r.submittedAt ? `Sent ${formatDate(r.submittedAt)}` : "Record"}</strong>
                    {r.schoolEmail && <span className="ma-muted">{r.schoolEmail}</span>}
                  </div>
                  <div className="ma-history-side">
                    <StatusChip tone={s.tone}>{s.label}</StatusChip>
                    {r.verifStatus === "approved" && r.expiresAt && <span className="ma-muted">Until {formatDate(r.expiresAt)}</span>}
                    {r.verifStatus === "rejected" && r.remarks && <span className="ma-muted">{r.remarks}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function ProofModal({ defaultEmail, onClose, onSubmit }) {
  const [schoolEmail, setSchoolEmail] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const onFile = (event) => {
    const f = event.target.files?.[0] || null;
    setFile(f);
    setErrors((prev) => ({ ...prev, file: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const next = {};
    if (!schoolEmail.trim()) next.schoolEmail = "Enter your school email.";
    else if (!isValidEmail(schoolEmail.trim())) next.schoolEmail = "Enter a valid email address.";
    if (!file) next.file = "Choose a photo or PDF of your proof.";
    else if (!PROOF_TYPES.includes(file.type)) next.file = "Use a PNG, JPG, or PDF file.";
    else if (file.size > PROOF_MAX_BYTES) next.file = "The file is too large. The limit is 5 MB.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await onSubmit({ schoolEmail: schoolEmail.trim(), file });
      onClose();
    } catch (e) {
      setError(e?.message || "We could not send your proof. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Submit proof"
      footer={
        <>
          <button type="button" className="by-btn by-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="ma-proof-form" className="by-btn by-btn-primary" disabled={busy}>{busy ? "Sending..." : "Send proof"}</button>
        </>
      }
    >
      <p>Send your school email and a clear photo of your student ID or enrollment proof. Our team will review it.</p>
      {error && <div className="by-alert" role="alert">{error}</div>}
      <form id="ma-proof-form" className="ma-form" onSubmit={submit} noValidate>
        <Field label="School email" htmlFor="ma-school-email" error={errors.schoolEmail}>
          <input
            id="ma-school-email"
            type="email"
            autoComplete="email"
            placeholder={defaultEmail ? `For example, ${defaultEmail}` : "name@school.edu.ph"}
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
            aria-invalid={errors.schoolEmail ? "true" : undefined}
          />
        </Field>
        <Field label="Proof of enrollment" htmlFor="ma-proof-file" error={errors.file} hint="PNG, JPG, or PDF. Up to 5 MB.">
          <input
            id="ma-proof-file"
            ref={fileRef}
            className="ma-file"
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={onFile}
            aria-invalid={errors.file ? "true" : undefined}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ---------- Profile tab ---------- */

function ProfileTab({ user, onSave, onChangePassword, notify }) {
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const saveProfile = async (event) => {
    event.preventDefault();
    setFormError("");
    const next = {};
    if (!fullName.trim()) next.fullName = "Enter your name.";
    if (phone.trim() && !isValidPhone(phone)) next.phone = "Enter a mobile number like 0917 123 4567.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await onSave({ fullName: fullName.trim(), phone: phone.trim() ? normalizePhone(phone) : "" });
      notify("Profile saved");
    } catch (e) {
      setFormError(e?.message || "We could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPwError("");
    const next = {};
    if (!pw.current) next.current = "Enter your current password.";
    if (pw.next.length < 8) next.next = "Use at least 8 characters.";
    else if (pw.next === pw.current) next.next = "Choose a different password from your current one.";
    if (pw.confirm !== pw.next) next.confirm = "The passwords do not match.";
    setPwErrors(next);
    if (Object.keys(next).length) return;

    setPwBusy(true);
    try {
      await onChangePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      notify("Password changed");
    } catch (e) {
      setPwError(e?.message || "We could not change your password. Please try again.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="ma-stack">
      <section className="ma-card" aria-labelledby="ma-profile-title">
        <h2 id="ma-profile-title" className="ma-h2">Your details</h2>
        {formError && <div className="by-alert" role="alert">{formError}</div>}
        <form className="ma-form" onSubmit={saveProfile} noValidate>
          <div className="by-form-grid">
            <Field label="Full name" htmlFor="ma-name" error={errors.fullName}>
              <input id="ma-name" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={errors.fullName ? "true" : undefined} />
            </Field>
            <Field label="Email" htmlFor="ma-email" hint="Your email is your login, so it cannot be changed here.">
              <input id="ma-email" type="email" value={user?.email || ""} disabled readOnly />
            </Field>
            <Field label="Mobile number" htmlFor="ma-phone" className="span-2" error={errors.phone} hint="Optional. We use it to coordinate your pickup.">
              <input id="ma-phone" type="tel" autoComplete="tel" placeholder="0917 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={errors.phone ? "true" : undefined} />
            </Field>
          </div>
          <div className="ma-form-actions">
            <button type="submit" className="by-btn by-btn-primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </form>
      </section>

      <section className="ma-card" aria-labelledby="ma-password-title">
        <h2 id="ma-password-title" className="ma-h2">Change password</h2>
        {pwError && <div className="by-alert" role="alert">{pwError}</div>}
        <form className="ma-form" onSubmit={savePassword} noValidate>
          <div className="by-form-grid">
            <Field label="Current password" htmlFor="ma-pw-current" className="span-2" error={pwErrors.current}>
              <input id="ma-pw-current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} aria-invalid={pwErrors.current ? "true" : undefined} />
            </Field>
            <Field label="New password" htmlFor="ma-pw-new" error={pwErrors.next} hint="At least 8 characters.">
              <input id="ma-pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-invalid={pwErrors.next ? "true" : undefined} />
            </Field>
            <Field label="Confirm new password" htmlFor="ma-pw-confirm" error={pwErrors.confirm}>
              <input id="ma-pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} aria-invalid={pwErrors.confirm ? "true" : undefined} />
            </Field>
          </div>
          <div className="ma-form-actions">
            <button type="submit" className="by-btn by-btn-outline" disabled={pwBusy}>{pwBusy ? "Updating..." : "Update password"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ---------- Page ---------- */

export default function MyAccountPage({
  initialTab,
  user = null,
  orders = [],
  warranties = [],
  verifications = [],
  cartCount = 0,
  loading = false,
  error = "",
  onRetry,
  logoSrc,
  onTabChange,
  onFileClaim,
  onRequestReturn,
  onSubmitProof,
  onSaveProfile,
  onChangePassword,
  onNavigate,
  onLogout,
}) {
  const [tab, setTab] = useState(() => readTab(initialTab));
  const [localOrders, setLocalOrders] = useState(orders);
  const [localWarranties, setLocalWarranties] = useState(warranties);
  const [localVerifs, setLocalVerifs] = useState(verifications);
  const [openOrderId, setOpenOrderId] = useState(null);
  const [claimTarget, setClaimTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [toast, notify] = useToast();
  const tabRefs = useRef({});
  const now = useNow(60000, true);

  // Pick up fresh data after the parent refetches.
  useEffect(() => setLocalOrders(orders), [orders]);
  useEffect(() => setLocalWarranties(warranties), [warranties]);
  useEffect(() => setLocalVerifs(verifications), [verifications]);

  const sortedOrders = useMemo(() => [...localOrders].sort((a, b) => toTime(b.orderCreatedAt) - toTime(a.orderCreatedAt)), [localOrders]);
  const openOrder = localOrders.find((o) => o.orderId === openOrderId) || null;

  const go = (event, href) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(href);
    }
  };

  const selectTab = (key) => {
    setTab(key);
    onTabChange?.(key);
  };

  const onTabKey = (event) => {
    const i = TABS.findIndex((t) => t.key === tab);
    let next = null;
    if (event.key === "ArrowRight") next = (i + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    if (next === null) return;
    event.preventDefault();
    selectTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  /* ----- Actions: call the API, then reflect the returned records locally ----- */
  const fileClaim = async (values) => {
    const result = await onFileClaim?.(values);
    const claim = {
      claimNo: result.claimNo,
      claimType: values.claimType,
      description: values.description,
      claimStatus: "filed",
      filedAt: new Date().toISOString(),
    };
    setLocalWarranties((prev) => prev.map((w) => (w.warrantyId === values.warrantyId ? { ...w, claims: [...(w.claims || []), claim] } : w)));
    notify("Claim filed");
  };

  const requestReturn = async (values) => {
    await onRequestReturn?.(values);
    const entry = { returnUnitId: values.returnUnitId, reason: values.reason, returnStatus: "requested", requestedAt: new Date().toISOString() };
    setLocalOrders((prev) => prev.map((o) => (o.orderId === values.orderId ? { ...o, returns: [...(o.returns || []), entry] } : o)));
    notify("Return requested");
  };

  const submitProof = async (values) => {
    const result = await onSubmitProof?.(values);
    const record = {
      verificationId: result.verificationId,
      schoolEmail: values.schoolEmail,
      proofUrl: result.proofUrl,
      verifStatus: "pending",
      submittedAt: new Date().toISOString(),
    };
    setLocalVerifs((prev) => [...prev, record]);
    notify("Proof sent for review");
  };

  const shell = { user, cartCount, logoSrc, onLogout, onNavigate };

  if (loading) {
    return (
      <BuyerShell active="account" {...shell}>
        <p className="by-subheading">Loading your account...</p>
      </BuyerShell>
    );
  }

  return (
    <BuyerShell active="account" {...shell}>
      <h1 className="by-heading">My account</h1>
      <p className="by-subheading">Track your orders, manage your warranty and returns, and keep your student status up to date.</p>
      {error && <div className="by-alert" role="alert">{error} <button type="button" className="by-link" onClick={onRetry}>Retry</button></div>}

      <div className="ma-tabs" role="tablist" aria-label="Account sections" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.key}
            ref={(el) => { tabRefs.current[t.key] = el; }}
            type="button"
            role="tab"
            id={`ma-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`ma-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={`ma-tab ${tab === t.key ? "is-active" : ""}`}
            onClick={() => selectTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ma-panel" role="tabpanel" id={`ma-panel-${tab}`} aria-labelledby={`ma-tab-${tab}`}>
        {tab === "orders" && <OrdersTab orders={sortedOrders} onOpen={setOpenOrderId} go={go} />}
        {tab === "warranty" && (
          <WarrantyTab
            orders={sortedOrders}
            warranties={localWarranties}
            now={now}
            onClaim={setClaimTarget}
            onReturn={setReturnTarget}
            goOrders={() => selectTab("orders")}
          />
        )}
        {tab === "verification" && <VerificationTab records={localVerifs} now={now} onSubmit={() => setProofOpen(true)} />}
        {tab === "profile" && (
          <ProfileTab
            user={user}
            notify={notify}
            onSave={async (values) => { await onSaveProfile?.(values); }}
            onChangePassword={async (values) => { await onChangePassword?.(values); }}
          />
        )}
      </div>

      <OrderDrawer
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onGoWarranty={() => { setOpenOrderId(null); selectTab("warranty"); }}
      />
      {claimTarget && <ClaimModal target={claimTarget} onClose={() => setClaimTarget(null)} onSubmit={fileClaim} />}
      {returnTarget && <ReturnModal target={returnTarget} onClose={() => setReturnTarget(null)} onSubmit={requestReturn} />}
      {proofOpen && <ProofModal defaultEmail={user?.email} onClose={() => setProofOpen(false)} onSubmit={submitProof} />}
      <Toast toast={toast} />
    </BuyerShell>
  );
}

/*
 * Rules this page follows (A4 in the plan):
 * - Warranty & Returns lists picked-up orders only. The Warranties record and returnDeadline are created when B3 marks the order picked up.
 * - [File a claim] adds to Warranties.claims[] (claimStatus = filed, filedAt). Disabled once endDate has passed.
 * - [Request return] adds to Orders.returns[] (returnStatus = requested, requestedAt); shown only until orderItems[].returnDeadline,
 *   and only if that unit has no return request yet.
 * - [Submit proof] ALWAYS creates a new Student_Verifications record (userId, schoolEmail, proofUrl, verifStatus = pending, submittedAt).
 *   It is hidden while a record is pending, and available when the latest record is rejected or expired (or there is none).
 *   "Expired" is derived from expiresAt; it is not stored.
 * - Profile edits Users.fullName and phone, and passwordHash on a password change. Email is read-only.
 * - priceAtSale is shown as the price before discount (subtotal - discountTotal = total), with the discount on its own line.
 */


