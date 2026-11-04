import { useMemo, useState } from "react";
import { BuyerShell, CheckIcon, ChevronIcon, ClockIcon, Field, LaptopIcon, ShieldIcon, StatusChip, TrashIcon, useNow } from "./BuyerShared";
import { formatDate, formatPeso, formatRemaining, getPhotos, getPrice, isStudentVerified, unitName } from "./buyerUtils";
import "./LaptopDetailPage.css";
import "./CartCheckoutPage.css";

/**
 * ByteBud: A3. Cart & Checkout (/checkout)
 *
 * <CartCheckoutPage
 *   units={[...]}                        // Units joined with Laptop_Models as `model`
 *   cartItems={[{ unitId, addedAt }]}    // the user's single Carts document: Carts.cartItems[]
 *   user={{ fullName, role }}
 *   verifications={[...]}                // this user's Student_Verifications records
 *   paymentMethods={["Cash on pickup", ...]}   // allowed values for Orders.payment.method
 *   onRemoveFromCart={async (unitId) => {}}    // remove from Carts.cartItems[]; set Units.unitStatus back to available
 *   onPlaceOrder={async ({ unitIds, pickupDate, paymentMethod }) => ({ orderNo, pickupDate, paymentMethod, total, discountTotal, itemCount })}
 *                                        // one atomic server call (see notes at the bottom of this file); throw an Error to show a message
 *   onNavigate={(href) => navigate(href)}
 *   onLogout={() => {}}
 * />
 * App supplies live catalog, cart, verification, and order API data at runtime.
 */

const DEFAULT_METHODS = ["Cash on pickup", "GCash", "Bank transfer"];
const MIN_PICKUP_DAYS = 1;
const MAX_PICKUP_DAYS = 30;
const LOW_TIME_MS = 2 * 60 * 1000;

const toInputDate = (d) => {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};
const daysFromToday = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};
function Photo({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="cc-photo-empty" aria-hidden="true">
        <LaptopIcon size={34} />
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

export default function CartCheckoutPage({
  units = [],
  cartItems = [],
  user = null,
  verifications = [],
  paymentMethods = DEFAULT_METHODS,
  loading = false,
  logoSrc,
  onRemoveFromCart,
  onPlaceOrder,
  onNavigate,
  onLogout,
}) {
  const verified = isStudentVerified(verifications);

  const [pickupDate, setPickupDate] = useState("");
  const [method, setMethod] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [placed, setPlaced] = useState(null);

  const now = useNow(1000, !placed && cartItems.length > 0);
  const minDate = useMemo(() => toInputDate(daysFromToday(MIN_PICKUP_DAYS)), []);
  const maxDate = useMemo(() => toInputDate(daysFromToday(MAX_PICKUP_DAYS)), []);

  const go = (event, href) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(href);
    }
  };

  /* ----- Join Carts.cartItems[] with Units and work out each line's state ----- */
  const lines = cartItems.map((ci) => {
    const unit = units.find((u) => u.unitId === ci.unitId) || null;
    const remaining = unit?.reserveUntil ? new Date(unit.reserveUntil).getTime() - now : null;
    let state = "ok";
    if (!unit) state = "missing";
    else if (unit.unitStatus === "sold") state = "sold";
    else if (remaining != null && remaining <= 0) state = "expired";
    return { ci, unit, remaining, state };
  });
  const active = lines.filter((l) => l.state === "ok");
  const hasProblem = lines.some((l) => l.state !== "ok");
  const lowTime = active.some((l) => l.remaining != null && l.remaining < LOW_TIME_MS);

  /* ----- Totals: Orders.subtotal, discountTotal, total ----- */
  const subtotal = active.reduce((sum, l) => sum + (l.unit.listing?.price || 0), 0);
  const payable = active.reduce((sum, l) => sum + (getPrice(l.unit, verified) || 0), 0);
  const discountTotal = Math.max(0, subtotal - payable);
  const potentialSaving = active.reduce((sum, l) => {
    const { price, studentPrice } = l.unit.listing || {};
    return studentPrice != null && price != null ? sum + Math.max(0, price - studentPrice) : sum;
  }, 0);

  const cartCount = placed ? 0 : cartItems.length;
  const shell = { user, cartCount, logoSrc, onLogout, onNavigate };

  const handleRemove = async (unitId) => {
    setRemoving(unitId);
    setFormError("");
    try {
      await onRemoveFromCart?.(unitId);
    } catch (e) {
      setFormError(e?.message || "We could not remove it. Please try again.");
    } finally {
      setRemoving(null);
    }
  };

  const validate = () => {
    const next = {};
    if (!pickupDate) next.pickupDate = "Choose a pickup date.";
    else if (pickupDate < minDate || pickupDate > maxDate) {
      next.pickupDate = `Choose a date between ${formatDate(minDate)} and ${formatDate(maxDate)}.`;
    }
    if (!method) next.method = "Choose a payment method.";
    return next;
  };

  const handlePlaceOrder = async () => {
    setFormError("");
    if (active.length === 0) {
      setFormError("Your cart has no laptops that can be ordered. Remove the unavailable ones or find another laptop.");
      return;
    }
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const result = await onPlaceOrder?.({
        unitIds: active.map((l) => l.unit.unitId),
        pickupDate,
        paymentMethod: method,
      });
      if (!result?.orderNo) throw new Error("The server did not confirm the order. Please refresh your cart and try again.");
      setPlaced({
        orderNo: result.orderNo,
        pickupDate: result?.pickupDate || pickupDate,
        paymentMethod: result?.paymentMethod || method,
        total: result?.total ?? payable,
        discountTotal: result?.discountTotal ?? discountTotal,
        itemCount: result?.itemCount ?? active.length,
      });
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setFormError(e?.message || "We could not place your order. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ----- Loading ----- */
  if (loading) {
    return (
      <BuyerShell active="cart" {...shell}>
        <p className="by-subheading">Loading your cart...</p>
      </BuyerShell>
    );
  }

  /* ----- Success state ----- */
  if (placed) {
    return (
      <BuyerShell active="cart" {...shell}>
        <section className="cc-success" aria-labelledby="cc-success-title">
          <span className="cc-success-icon"><CheckIcon size={30} /></span>
          <h1 id="cc-success-title" className="by-heading">Order placed</h1>
          <p className="by-subheading">Thank you, {user?.fullName?.split(" ")[0] || "there"}. Your laptop is reserved for pickup.</p>

          <dl className="cc-success-card">
            <div><dt>Order number</dt><dd className="cc-order-no">{placed.orderNo}</dd></div>
            <div><dt>Pickup date</dt><dd>{formatDate(placed.pickupDate)}</dd></div>
            <div><dt>Payment method</dt><dd>{placed.paymentMethod}</dd></div>
            <div><dt>Laptops</dt><dd>{placed.itemCount}</dd></div>
            {placed.discountTotal > 0 && <div><dt>Student discount</dt><dd className="is-green">-{formatPeso(placed.discountTotal)}</dd></div>}
            <div className="is-total"><dt>Total</dt><dd>{formatPeso(placed.total)}</dd></div>
          </dl>

          <p className="by-note cc-success-note">
            Your warranty and return period start on the day you pick up your laptop. Bring your order number when you come.
          </p>

          <div className="cc-success-actions">
            <a className="by-btn by-btn-primary" href="/account?tab=orders" onClick={(e) => go(e, "/account?tab=orders")}>View my orders</a>
            <a className="by-btn by-btn-ghost" href="/" onClick={(e) => go(e, "/")}>Keep browsing</a>
          </div>
        </section>
      </BuyerShell>
    );
  }

  /* ----- Empty cart ----- */
  if (cartItems.length === 0) {
    return (
      <BuyerShell active="cart" {...shell}>
        <h1 className="by-heading">Your cart</h1>
        <div className="by-empty">
          <div className="by-empty-icon"><LaptopIcon size={30} /></div>
          <h2>Your cart is empty</h2>
          <p>Reserve a laptop and it will show up here, held for you while you check out.</p>
          <a className="by-btn by-btn-primary" href="/" onClick={(e) => go(e, "/")}>Find a laptop</a>
        </div>
      </BuyerShell>
    );
  }

  const placeLabel = busy ? "Placing order..." : `Place order${active.length ? ` (${formatPeso(payable)})` : ""}`;

  return (
    <BuyerShell active="cart" {...shell}>
      <nav className="ld-crumbs" aria-label="Breadcrumb">
        <a href="/" onClick={(e) => go(e, "/")}>Find a Laptop</a>
        <ChevronIcon size={14} />
        <span aria-current="page">Cart and checkout</span>
      </nav>

      <h1 className="by-heading">Cart and checkout</h1>
      <p className="by-subheading">Review your laptops, choose a pickup date and a payment method.</p>

      {formError && <div className="by-alert" role="alert">{formError}</div>}
      {lowTime && (
        <p className="by-note is-warn" role="status">
          <strong>A reservation is about to end.</strong> Place your order soon or the laptop goes back on sale.
        </p>
      )}
      {hasProblem && (
        <p className="by-note is-warn" role="status">
          Some laptops in your cart can no longer be ordered. They are not counted in your total. Remove them to continue.
        </p>
      )}

      <div className="cc-layout">
        <div className="cc-main">
          {/* ---------- Items ---------- */}
          <section className="cc-card" aria-labelledby="cc-items-title">
            <h2 id="cc-items-title" className="ld-h2">Your laptops ({cartItems.length})</h2>
            <ul className="cc-items">
              {lines.map(({ ci, unit, remaining, state }) => {
                const model = unit?.model || {};
                const actual = unit?.actualSpecs || {};
                const listing = unit?.listing || {};
                const price = unit ? getPrice(unit, verified) : null;
                const showStudent = verified && listing.studentPrice != null;
                const specsLine = [
                  actual.actualRamGb != null ? `${actual.actualRamGb} GB memory` : null,
                  actual.actualStorageGb != null ? `${actual.actualStorageGb} GB ${actual.actualStorageType || ""}`.trim() : null,
                ].filter(Boolean).join(" · ");
                const href = unit ? `/laptops/${unit.unitId}` : null;

                return (
                  <li key={ci.unitId} className={`cc-item ${state !== "ok" ? "is-unavailable" : ""}`}>
                    <div className="cc-thumb">
                      {unit ? <Photo src={getPhotos(unit)[0]} alt={unitName(unit)} /> : <Photo src={null} alt="" />}
                    </div>

                    <div className="cc-item-info">
                      {unit ? (
                        <>
                          <p className="cc-item-brand">{model.brand}</p>
                          <a className="cc-item-title" href={href} onClick={(e) => go(e, href)}>{model.modelName}</a>
                          <div className="cc-item-meta">
                            {unit.conditionGrade && <StatusChip tone={unit.conditionGrade === "A" ? "burgundy" : "grey"}>Grade {unit.conditionGrade}</StatusChip>}
                            {specsLine && <span>{specsLine}</span>}
                          </div>
                        </>
                      ) : (
                        <p className="cc-item-title">This laptop is no longer available</p>
                      )}

                      {state === "ok" && (
                        remaining != null ? (
                          <p className={`cc-hold ${remaining < LOW_TIME_MS ? "is-low" : ""}`}>
                            <ClockIcon /> Reserved for you: <strong>{formatRemaining(remaining)}</strong> left
                          </p>
                        ) : (
                          <p className="cc-hold"><ClockIcon /> Reserved for you</p>
                        )
                      )}
                      {state === "expired" && <p className="cc-state is-bad">Your reservation ended. Remove it, then reserve it again if it is still available.</p>}
                      {state === "sold" && <p className="cc-state is-bad">This laptop has been sold. Please remove it.</p>}
                      {state === "missing" && <p className="cc-state is-bad">It may have been sold or taken off the store. Please remove it.</p>}
                    </div>

                    <div className="cc-item-side">
                      {unit && (
                        <div className="cc-item-price">
                          <strong className={showStudent ? "is-student" : ""}>{formatPeso(price)}</strong>
                          {showStudent && <span>{formatPeso(listing.price)}</span>}
                        </div>
                      )}
                      <button
                        type="button"
                        className="by-icon-btn cc-remove"
                        onClick={() => handleRemove(ci.unitId)}
                        disabled={removing === ci.unitId}
                        aria-label={`Remove ${unit ? unitName(unit) : "this laptop"} from cart`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---------- Pickup ---------- */}
          <section className="cc-card" aria-labelledby="cc-pickup-title">
            <h2 id="cc-pickup-title" className="ld-h2">Pickup date</h2>
            <p className="ld-muted cc-lead">All orders are for store pickup. Choose the day you plan to come.</p>
            <Field
              label="Pickup date"
              htmlFor="cc-pickup"
              className="cc-date"
              error={errors.pickupDate}
              hint={`You can choose a date from ${formatDate(minDate)} to ${formatDate(maxDate)}.`}
            >
              <input
                id="cc-pickup"
                type="date"
                value={pickupDate}
                min={minDate}
                max={maxDate}
                aria-invalid={errors.pickupDate ? "true" : undefined}
                onChange={(e) => {
                  setPickupDate(e.target.value);
                  setErrors((prev) => ({ ...prev, pickupDate: undefined }));
                }}
              />
            </Field>
          </section>

          {/* ---------- Payment ---------- */}
          <section className="cc-card" aria-labelledby="cc-pay-title">
            <h2 id="cc-pay-title" className="ld-h2">Payment method</h2>
            <p className="ld-muted cc-lead">Our staff will confirm your payment, and you can follow its status on your order.</p>
            <div className="cc-methods" role="radiogroup" aria-labelledby="cc-pay-title" aria-invalid={errors.method ? "true" : undefined}>
              {paymentMethods.map((m) => (
                <label key={m} className={`cc-method ${method === m ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment-method"
                    value={m}
                    checked={method === m}
                    onChange={() => {
                      setMethod(m);
                      setErrors((prev) => ({ ...prev, method: undefined }));
                    }}
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>
            {errors.method && <p className="by-error cc-method-error">{errors.method}</p>}
          </section>
        </div>

        {/* ---------- Summary ---------- */}
        <aside className="cc-summary" aria-label="Order summary">
          <h2 className="ld-h2">Order summary</h2>

          <dl className="cc-totals">
            <div><dt>Subtotal ({active.length} {active.length === 1 ? "laptop" : "laptops"})</dt><dd>{formatPeso(subtotal)}</dd></div>
            {verified && discountTotal > 0 && (
              <div className="is-green"><dt>Student discount</dt><dd>-{formatPeso(discountTotal)}</dd></div>
            )}
            <div className="is-total"><dt>Total</dt><dd>{formatPeso(payable)}</dd></div>
          </dl>

          {!verified && potentialSaving > 0 && (
            <p className="ld-student-hint">
              Verified students save {formatPeso(potentialSaving)} on this order.{" "}
              <a href="/account?tab=verification" onClick={(e) => go(e, "/account?tab=verification")}>Verify your student status</a>
            </p>
          )}
          {verified && <p className="cc-small">Your student discount is checked again when you place the order.</p>}

          <button type="button" className="by-btn by-btn-primary by-btn-block cc-place" onClick={handlePlaceOrder} disabled={busy || active.length === 0}>
            {placeLabel}
          </button>

          <p className="cc-assure"><ShieldIcon size={18} /> Your warranty and return period start the day you pick up your laptop.</p>
        </aside>
      </div>

      {/* ---------- Mobile bar ---------- */}
      <div className="cc-mobilebar">
        <div>
          <strong>{formatPeso(payable)}</strong>
          {verified && discountTotal > 0 && <small>Student price</small>}
        </div>
        <div className="cc-mobile-action">
          <button type="button" className="by-btn by-btn-primary by-btn-block" onClick={handlePlaceOrder} disabled={busy || active.length === 0}>
            {busy ? "Placing order..." : "Place order"}
          </button>
        </div>
      </div>
    </BuyerShell>
  );
}

/*
 * Server notes for onPlaceOrder (one atomic transaction, A3 in the plan):
 * - Re-check Student_Verifications (any record with verifStatus = approved and expiresAt in the future); never trust the price shown here.
 * - Check every unit is still reserved by this user and Units.reserveUntil has not passed.
 * - Create ONE Orders record: orderNo (unique), userId, verificationId (only if the discount applies), subtotal, discountTotal, total,
 *   orderStatus, pickupDate, payment.method, payment.payStatus, statusHistory[], orderItems[] (unitId, priceAtSale, discountAmount,
 *   snapshot: snapBrand, snapModelName, snapSerialNumber, snapConditionGrades), orderCreatedAt.
 * - Set Units.unitStatus = sold and clear Carts.cartItems[].
 * - Do NOT create Warranties or set returnDeadline here; both happen when the order is marked picked up (B3).
 */
