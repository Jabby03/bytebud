import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryIcon, BuyerShell, CheckIcon, ChevronIcon, CrossIcon, InfoIcon, LaptopIcon, ShieldIcon, StatusChip, useNow } from "./BuyerShared";
import {
  CPU_TIER_LABEL, courseFit, formatDate, formatPeso, formatRemaining, getPhotos, getPrefs, getPrice, isStudentVerified,
  setPrefs, similarUnits, toBool, unitName,
} from "./buyerUtils";
import "./LaptopDetailPage.css";

/**
 * ByteBud: A2. Laptop Detail (/laptops/:unitId)
 *
 * <LaptopDetailPage
 *   unitId="u1"                         // route param
 *   units={[...]}                       // Units joined with Laptop_Models as `model` (also used for "Similar laptops")
 *   courses={[...]}                     // Courses (for the "why this fits" box)
 *   user={{ fullName, role }}
 *   verifications={[...]}               // this user's Student_Verifications records
 *   cartItems={[{ unitId, addedAt }]}   // Carts.cartItems[]
 *   onAddToCart={async (unitId) => {}}  // atomic server call: set unitStatus available -> reserved + reserveUntil
 *                                       // (only if it is still available), add to Carts.cartItems[]; throw an Error if taken
 *   onRemoveFromCart={async (unitId) => {}}
 *   onNavigate={(href) => navigate(href)}
 *   onLogout={() => {}}
 * />
 * Remove the demo defaults once connected to the API.
 */

/* ---------- Plain-language copy (static text, not stored in the model) ---------- */

const HINTS = {
  ram: "Memory (RAM) is the laptop's workspace. More memory lets you keep more programs and browser tabs open without slowing down.",
  storage: "Storage is where your files and programs live. SSD storage is much faster than an older hard drive, so the laptop starts up and opens apps quickly.",
  cpu: "The processor is the laptop's brain. ByteBud rates it from Basic to High-performance so you can compare laptops easily.",
  gpu: "A dedicated graphics card helps with 3D drawing, video editing, and design software. Built-in graphics is fine for documents, browsing, and coding.",
  screen: "Measured diagonally. Smaller screens are easier to carry, and larger ones are easier to work on.",
  weight: "A laptop under about 1.5 kg is easy to carry around campus every day.",
  os: "The system the laptop runs. It is already installed and ready to use.",
  battery: "Estimated hours of normal use on one charge. Battery health shows how much of the original battery capacity is left.",
};

const COVERED = [
  "Faults in the laptop's parts and workmanship",
  "A battery that stops holding a charge normally",
  "Screen, keyboard, and port failures that are not caused by damage",
];
const NOT_COVERED = ["Accidental damage, spills, and drops", "Damage from repairs done by someone else", "Software you install yourself"];

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "specs", label: "Specs" },
  { key: "inspection", label: "Inspection" },
  { key: "warranty", label: "Warranty" },
];

/* ---------- Small components ---------- */

function Photo({ src, alt, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`ld-photo-empty ${className || ""}`} aria-hidden="true">
        <LaptopIcon size={className === "is-thumb" ? 28 : 72} />
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}

function SpecRow({ label, value, hint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ld-spec">
      <div className="ld-spec-row">
        <dt>{label}</dt>
        <dd>{value}</dd>
        <button type="button" className="ld-hint-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`What does ${label} mean?`}>
          <InfoIcon />
        </button>
      </div>
      {open && <p className="ld-hint">{hint}</p>}
    </div>
  );
}

/* ---------- Page ---------- */

export default function LaptopDetailPage({
  unitId,
  units = [],
  courses = [],
  user = null,
  verifications = [],
  cartItems = [],
  loading = false,
  logoSrc,
  onAddToCart,
  onRemoveFromCart,
  onNavigate,
  onLogout,
}) {
  const unit = useMemo(() => units.find((u) => u.unitId === unitId) || null, [units, unitId]);
  const verified = isStudentVerified(verifications);
  const inCart = !!unit && cartItems.some((ci) => ci.unitId === unit.unitId);

  const [tab, setTab] = useState("overview");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [courseId, setCourseId] = useState(() => {
    const saved = getPrefs().courseId;
    return courses.some((c) => c.courseId === saved) ? saved : "";
  });
  const tabRefs = useRef({});

  const now = useNow(1000, inCart);

  // New laptop: back to the first photo and tab.
  useEffect(() => {
    setPhotoIndex(0);
    setTab("overview");
    setError("");
  }, [unitId]);

  const go = (event, href) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(href);
    }
  };

  const similar = useMemo(() => (unit ? similarUnits(unit, units, verified) : []), [unit, units, verified]);

  /* ----- Not found / loading ----- */
  if (loading) {
    return (
      <BuyerShell active="home" user={user} cartCount={cartItems.length} logoSrc={logoSrc} onLogout={onLogout} onNavigate={onNavigate}>
        <p className="by-subheading">Loading laptop...</p>
      </BuyerShell>
    );
  }
  if (!unit) {
    return (
      <BuyerShell active="home" user={user} cartCount={cartItems.length} logoSrc={logoSrc} onLogout={onLogout} onNavigate={onNavigate}>
        <div className="by-empty">
          <div className="by-empty-icon"><LaptopIcon size={30} /></div>
          <h2>This laptop is not available</h2>
          <p>It may have been sold or taken off the store. Browse the laptops that are available now.</p>
          <a className="by-btn by-btn-primary" href="/" onClick={(e) => go(e, "/")}>Find a laptop</a>
        </div>
      </BuyerShell>
    );
  }

  /* ----- Derived values ----- */
  const model = unit.model || {};
  const specs = model.specs || {};
  const actual = unit.actualSpecs || {};
  const listing = unit.listing || {};
  const photos = getPhotos(unit);
  const index = Math.min(photoIndex, Math.max(photos.length - 1, 0));
  const price = getPrice(unit, verified);
  const showStudent = verified && listing.studentPrice != null;
  const course = courses.find((c) => c.courseId === courseId) || null;
  const fit = course ? courseFit(unit, course) : null;
  const latestInspection = [...(unit.inspections || [])].sort((a, b) => new Date(b.inspectedAt) - new Date(a.inspectedAt))[0];
  const hasGpu = toBool(specs.hasDedicatedGpu);
  const remaining = inCart && unit.reserveUntil ? new Date(unit.reserveUntil).getTime() - now : null;

  const status = unit.unitStatus;
  const reservedByOther = status === "reserved" && !inCart;
  const unavailable = !["available", "reserved"].includes(status) || reservedByOther;

  const handleAdd = async () => {
    setBusy(true);
    setError("");
    try {
      await onAddToCart?.(unit.unitId);
    } catch (e) {
      setError(e?.message || "We could not reserve this laptop. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await onRemoveFromCart?.(unit.unitId);
    } catch (e) {
      setError(e?.message || "We could not remove it. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onTabKey = (event) => {
    const i = TABS.findIndex((t) => t.key === tab);
    let next = null;
    if (event.key === "ArrowRight") next = (i + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  const onGalleryKey = (event) => {
    if (photos.length < 2) return;
    if (event.key === "ArrowRight") setPhotoIndex((index + 1) % photos.length);
    if (event.key === "ArrowLeft") setPhotoIndex((index - 1 + photos.length) % photos.length);
  };

  /* ----- Purchase actions (used in the side panel and the mobile bar) ----- */
  const action = inCart ? (
    <a className="by-btn by-btn-primary by-btn-block" href="/checkout" onClick={(e) => go(e, "/checkout")}>Go to checkout</a>
  ) : status === "available" ? (
    <button type="button" className="by-btn by-btn-primary by-btn-block" onClick={handleAdd} disabled={busy}>
      {busy ? "Reserving..." : "Reserve and add to cart"}
    </button>
  ) : (
    <button type="button" className="by-btn by-btn-primary by-btn-block" disabled>
      {status === "sold" ? "Sold" : reservedByOther ? "Reserved by another buyer" : "Not available"}
    </button>
  );

  return (
    <BuyerShell active="home" user={user} cartCount={cartItems.length} logoSrc={logoSrc} onLogout={onLogout} onNavigate={onNavigate}>
      <nav className="ld-crumbs" aria-label="Breadcrumb">
        <a href="/" onClick={(e) => go(e, "/")}>Find a Laptop</a>
        <ChevronIcon size={14} />
        <span aria-current="page">{unitName(unit)}</span>
      </nav>

      <div className="ld-top">
        {/* ---------- Gallery ---------- */}
        <section className="ld-gallery" aria-label="Photos" tabIndex={photos.length > 1 ? 0 : -1} onKeyDown={onGalleryKey}>
          <div className="ld-stage">
            <Photo key={photos[index] || "empty"} src={photos[index]} alt={`${unitName(unit)}, photo ${index + 1}`} />
            {photos.length > 1 && (
              <>
                <button type="button" className="ld-arrow is-prev" onClick={() => setPhotoIndex((index - 1 + photos.length) % photos.length)} aria-label="Previous photo">
                  <ChevronIcon dir="left" />
                </button>
                <button type="button" className="ld-arrow is-next" onClick={() => setPhotoIndex((index + 1) % photos.length)} aria-label="Next photo">
                  <ChevronIcon />
                </button>
                <span className="ld-counter">{index + 1} / {photos.length}</span>
              </>
            )}
          </div>

          {photos.length > 1 && (
            <ul className="ld-thumbs">
              {photos.map((src, i) => (
                <li key={`${src}-${i}`}>
                  <button type="button" className={i === index ? "is-active" : ""} onClick={() => setPhotoIndex(i)} aria-label={`Show photo ${i + 1} of ${photos.length}`} aria-current={i === index}>
                    <Photo src={src} alt="" className="is-thumb" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Purchase panel ---------- */}
        <aside className="ld-buy" aria-label="Buy this laptop">
          <div className="ld-badges">
            {unit.conditionGrade && <StatusChip tone={unit.conditionGrade === "A" ? "burgundy" : "grey"}>Grade {unit.conditionGrade}</StatusChip>}
            <StatusChip tone={status === "available" ? "green" : status === "reserved" ? "amber" : "grey"}>
              {status === "available" ? "Available" : status === "reserved" ? (inCart ? "In your cart" : "Reserved") : "Sold"}
            </StatusChip>
          </div>

          <p className="ld-brand">{model.brand}</p>
          <h1 className="ld-title">{model.modelName}</h1>

          <div className="ld-price">
            <span className={`ld-price-now ${showStudent ? "is-student" : ""}`}>{formatPeso(price)}</span>
            {showStudent && <span className="ld-price-old">{formatPeso(listing.price)}</span>}
          </div>
          {showStudent && <p className="ld-price-tag">Student price applied</p>}
          {!verified && listing.studentPrice != null && (
            <p className="ld-student-hint">
              Verified students pay {formatPeso(listing.studentPrice)}.{" "}
              <a href="/account?tab=verification" onClick={(e) => go(e, "/account?tab=verification")}>Verify your student status</a>
            </p>
          )}

          <ul className="ld-facts">
            <li><span>Memory</span><strong>{actual.actualRamGb != null ? `${actual.actualRamGb} GB` : "-"}</strong></li>
            <li><span>Storage</span><strong>{actual.actualStorageGb != null ? `${actual.actualStorageGb} GB ${actual.actualStorageType || ""}`.trim() : "-"}</strong></li>
            <li><span>Battery</span><strong>{unit.estimatedBatteryHrs != null ? `About ${unit.estimatedBatteryHrs} hrs` : "-"}</strong></li>
            <li><span>Warranty</span><strong>{listing.warrantyMonths != null ? `${listing.warrantyMonths} months` : "-"}</strong></li>
          </ul>

          {error && <div className="by-alert" role="alert">{error}</div>}

          <div className="ld-actions">{action}</div>

          {inCart && (
            <div className="ld-hold">
              <p>
                Reserved for you{remaining != null ? <>: <strong>{formatRemaining(remaining)}</strong> left</> : ""}. Check out before the time runs out.
              </p>
              <button type="button" className="by-link" onClick={handleRemove} disabled={busy}>Remove from cart</button>
            </div>
          )}
          {reservedByOther && <p className="ld-small">Another buyer is holding this laptop. It becomes available again if they do not check out in time.</p>}
          {status === "available" && !inCart && <p className="ld-small">Reserving holds this laptop for you while you check out. You choose your pickup date at checkout.</p>}
        </aside>
      </div>

      {/* ---------- Tabs ---------- */}
      <section className="ld-details">
        <div className="ld-tabs" role="tablist" aria-label="Laptop details" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[t.key] = el; }}
              type="button"
              role="tab"
              id={`ld-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`ld-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              className={`by-tab ld-tab ${tab === t.key ? "is-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="ld-panel" role="tabpanel" id="ld-panel-overview" aria-labelledby="ld-tab-overview">
            <div className="ld-fit">
              <div className="ld-fit-head">
                <h2>Why this fits your course</h2>
                <select
                  className="by-select ld-course"
                  value={courseId}
                  aria-label="Choose your course"
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setPrefs({ courseId: e.target.value });
                  }}
                >
                  <option value="">Choose your course</option>
                  {courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>{c.courseName} ({c.courseCode})</option>
                  ))}
                </select>
              </div>

              {!course ? (
                <p className="ld-muted">Choose your course to see if this laptop has what you need.</p>
              ) : (
                <>
                  <p className={`ld-verdict ${fit.ok ? "is-ok" : "is-bad"}`}>
                    {fit.ok ? `Good for ${course.courseName}. It meets every requirement.` : `Not the best match for ${course.courseName}. It misses some requirements.`}
                  </p>
                  <ul className="ld-fit-list">
                    {fit.rows.map((r) => (
                      <li key={r.key} className={r.ok ? "is-ok" : "is-bad"}>
                        {r.ok ? <CheckIcon /> : <CrossIcon />}
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                  {course.requirements?.reqNotes && <p className="ld-muted">{course.requirements.reqNotes}</p>}
                </>
              )}
            </div>

            <div className="ld-cols">
              <div>
                <h2 className="ld-h2">Condition</h2>
                <p className="ld-text">
                  {unit.conditionGrade ? `Grade ${unit.conditionGrade}. ` : ""}
                  {unit.cosmeticNotes || "No visible marks were noted."}
                </p>
                <dl className="ld-mini">
                  {unit.batteryHealthPct != null && <div><dt>Battery health</dt><dd>{unit.batteryHealthPct}%</dd></div>}
                  {unit.estimatedBatteryHrs != null && <div><dt>Battery life</dt><dd>About {unit.estimatedBatteryHrs} hours</dd></div>}
                </dl>
              </div>
              <div>
                <h2 className="ld-h2">Included in the box</h2>
                {(unit.accessories || []).length ? (
                  <ul className="ld-tags">
                    {unit.accessories.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                ) : (
                  <p className="ld-text">The laptop only.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Specs */}
        {tab === "specs" && (
          <div className="ld-panel" role="tabpanel" id="ld-panel-specs" aria-labelledby="ld-tab-specs">
            <dl className="ld-specs">
              <SpecRow label="Memory (RAM)" value={actual.actualRamGb != null ? `${actual.actualRamGb} GB` : "-"} hint={HINTS.ram} />
              <SpecRow label="Storage" value={actual.actualStorageGb != null ? `${actual.actualStorageGb} GB ${actual.actualStorageType || ""}`.trim() : "-"} hint={HINTS.storage} />
              <SpecRow label="Processor" value={`${specs.cpuName || "-"}${CPU_TIER_LABEL[specs.cpuTier] ? ` (${CPU_TIER_LABEL[specs.cpuTier]})` : ""}`} hint={HINTS.cpu} />
              <SpecRow label="Graphics" value={hasGpu ? `${specs.gpu || "Graphics card"} (dedicated)` : `${specs.gpu || "Built-in graphics"} (built-in)`} hint={HINTS.gpu} />
              <SpecRow label="Screen" value={specs.screenSizeIn != null ? `${specs.screenSizeIn}-inch` : "-"} hint={HINTS.screen} />
              <SpecRow label="Weight" value={specs.weightKg != null ? `${specs.weightKg} kg` : "-"} hint={HINTS.weight} />
              <SpecRow label="Operating system" value={unit.osInstalled || "-"} hint={HINTS.os} />
              <SpecRow label="Battery" value={unit.estimatedBatteryHrs != null ? `About ${unit.estimatedBatteryHrs} hours${unit.batteryHealthPct != null ? `, ${unit.batteryHealthPct}% health` : ""}` : "-"} hint={HINTS.battery} />
            </dl>
          </div>
        )}

        {/* Inspection */}
        {tab === "inspection" && (
          <div className="ld-panel" role="tabpanel" id="ld-panel-inspection" aria-labelledby="ld-tab-inspection">
            {!latestInspection ? (
              <p className="ld-muted">No inspection record is available for this laptop.</p>
            ) : (
              <>
                <div className="ld-insp-head">
                  <h2 className="ld-h2" style={{ margin: 0 }}>Checked by our team</h2>
                  <StatusChip tone={latestInspection.passed ? "green" : "red"}>{latestInspection.passed ? "Passed" : "Did not pass"}</StatusChip>
                </div>
                <p className="ld-muted">Inspected on {formatDate(latestInspection.inspectedAt)}.</p>
                <ul className="ld-checklist">
                  {[
                    ["screenOk", "Screen"],
                    ["keyboardOk", "Keyboard"],
                    ["portsOk", "Ports"],
                    ["batteryOk", "Battery"],
                    ["dataWiped", "Previous data wiped"],
                  ].map(([key, label]) => (
                    <li key={key} className={latestInspection[key] ? "is-ok" : "is-bad"}>
                      <span className="ld-mark">{latestInspection[key] ? <CheckIcon size={18} /> : <CrossIcon size={18} />}</span>
                      {label}
                    </li>
                  ))}
                </ul>
                {latestInspection.dataWiped && latestInspection.wipeMethod && <p className="ld-muted">Data wipe method: {latestInspection.wipeMethod}.</p>}
              </>
            )}
          </div>
        )}

        {/* Warranty */}
        {tab === "warranty" && (
          <div className="ld-panel" role="tabpanel" id="ld-panel-warranty" aria-labelledby="ld-tab-warranty">
            <div className="ld-warranty-head">
              <span className="ld-shield"><ShieldIcon size={26} /></span>
              <div>
                <h2 className="ld-h2" style={{ margin: 0 }}>
                  {listing.warrantyMonths != null ? `${listing.warrantyMonths}-month warranty` : "Warranty included"}
                </h2>
                <p className="ld-muted" style={{ margin: "4px 0 0" }}>The warranty starts on the day you pick up your laptop.</p>
              </div>
            </div>

            <div className="ld-cols">
              <div>
                <h3 className="ld-h3">What it covers</h3>
                <ul className="ld-fit-list">
                  {COVERED.map((t) => <li key={t} className="is-ok"><CheckIcon /><span>{t}</span></li>)}
                </ul>
              </div>
              <div>
                <h3 className="ld-h3">What it does not cover</h3>
                <ul className="ld-fit-list">
                  {NOT_COVERED.map((t) => <li key={t} className="is-bad"><CrossIcon /><span>{t}</span></li>)}
                </ul>
              </div>
            </div>
            <p className="ld-muted">After pickup, you can file a claim or request a return from My Account.</p>
          </div>
        )}
      </section>

      {/* ---------- Similar laptops ---------- */}
      {similar.length > 0 && (
        <section className="ld-similar" aria-label="Similar laptops">
          <h2 className="ld-h2">Similar laptops</h2>
          <ul className="ld-similar-grid">
            {similar.map((u) => {
              const p = getPrice(u, verified);
              return (
                <li key={u.unitId}>
                  <a href={`/laptops/${u.unitId}`} onClick={(e) => go(e, `/laptops/${u.unitId}`)}>
                    <span className="ld-sim-media"><Photo src={getPhotos(u)[0]} alt="" /></span>
                    <span className="ld-sim-body">
                      <span className="ld-sim-brand">{u.model?.brand}</span>
                      <strong>{u.model?.modelName}</strong>
                      <span className="ld-sim-price">{formatPeso(p)}</span>
                      <span className="ld-sim-meta">
                        <BatteryIcon /> {u.estimatedBatteryHrs != null ? `About ${u.estimatedBatteryHrs} hrs` : "-"}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---------- Mobile purchase bar ---------- */}
      <div className="ld-mobilebar">
        <div>
          <strong>{formatPeso(price)}</strong>
          {showStudent && <small>Student price</small>}
        </div>
        <div className="ld-mobile-action">{action}</div>
      </div>
    </BuyerShell>
  );
}
