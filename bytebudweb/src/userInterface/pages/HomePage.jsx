import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/NavbarHome.jsx";
import Footer from "../components/FooterHome.jsx";
import { demoCourses, demoUnits, demoUser, demoVerification } from "../../../Homedemodata.js";
import "./HomePage.css";

/**
 * ByteBud: A1. Home / Find My Laptop (/)
 *
 * <HomePage
 *   user={{ fullName, role }}              // Users
 *   verification={{ verifStatus, expiresAt }} // latest Student_Verifications of this user (or null)
 *   courses={[...]}                        // Courses[]
 *   units={[...]}                          // Units[] each joined with its Laptop_Models as `model`
 *   cartCount={cart.cartItems.length}      // Carts.cartItems[]
 *   loading={false}
 *   error=""
 *   onLogout={() => {}}
 *   onOpenUnit={(unitId) => navigate(`/laptops/${unitId}`)}   // optional; otherwise plain links are used
 * />
 *
 * Remove the demo defaults (homeDemoData.js) once the page is connected to the API.
 *
 * Unit shape expected:
 *   { unitId, conditionGrade, estimatedBatteryHrs, unitStatus,
 *     actualSpecs: { actualRamGb, actualStorageGb, actualStorageType },
 *     listing: { price, studentPrice, listedAt, photos: [{ photoUrl, isPrimary }], warrantyMonths /* [NEW] *\/ },
 *     model: { brand, modelName, specs: { cpuTier, gpu, screenSizeIn, weightKg, designBatteryHrs } } }
 */

/* ---------- Constants (UI rules, not stored in the data model) ---------- */

const PAGE_SIZE = 12;
const PRICE_STEP = 500;
const BATTERY_MUST_HRS = 8; // "Battery" chip: estimatedBatteryHrs at or above this
const LIGHT_MAX_KG = 1.5; // "Light" chip: weightKg at or below this

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available now" },
  { value: "reserved", label: "Reserved" },
];

const MUST_HAVES = [
  { value: "battery", label: "Long battery" },
  { value: "gpu", label: "Dedicated GPU" },
  { value: "light", label: "Light to carry" },
];

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

/* ---------- Helpers ---------- */

// Laptop_Models.specs.gpu is free text, so "dedicated" is inferred from the name.
const hasDedicatedGpu = (gpu) =>
  !!gpu && !/integrated|none|n\/a|uhd|iris|radeon graphics|vega/i.test(gpu);

const meets = (value, min) => min == null || (value != null && value >= min);

// Student_Verifications.verifStatus = approved AND expiresAt in the future
const isStudentVerified = (verification) =>
  !!verification &&
  verification.verifStatus === "approved" &&
  !!verification.expiresAt &&
  new Date(verification.expiresAt) > new Date();

const getPrice = (unit, verified) => {
  const listing = unit.listing || {};
  return verified && listing.studentPrice != null ? listing.studentPrice : listing.price;
};

const getPhoto = (unit) => {
  const photos = unit.listing?.photos || [];
  return (photos.find((p) => p.isPrimary) || photos[0])?.photoUrl || "";
};

const toggleIn = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

// Compare Courses.requirements with the unit's real (actual) specs
function evaluateCourse(unit, course) {
  const req = course.requirements || {};
  const specs = unit.model?.specs || {};
  const actual = unit.actualSpecs || {};

  const ok =
    meets(actual.actualRamGb, req.minRamGb) &&
    meets(actual.actualStorageGb, req.minStorageGb) &&
    meets(specs.cpuTier, req.minCpuTier) &&
    (!req.gpuRequired || hasDedicatedGpu(specs.gpu)) &&
    meets(unit.estimatedBatteryHrs, req.minBatteryHours);

  const ratio = (value, min) => (min ? (value || 0) / min : 1);
  const headroom =
    ratio(actual.actualRamGb, req.minRamGb) +
    ratio(actual.actualStorageGb, req.minStorageGb) +
    ratio(unit.estimatedBatteryHrs, req.minBatteryHours);

  return { ok, headroom };
}

// "Good for Civil Engineering: 16GB RAM + dedicated GPU"
function fitLabel(unit, course) {
  const req = course.requirements || {};
  const actual = unit.actualSpecs || {};
  const parts = [];
  if (actual.actualRamGb != null) parts.push(`${actual.actualRamGb}GB RAM`);
  if (req.gpuRequired) parts.push("dedicated GPU");
  if (actual.actualStorageGb != null) parts.push(`${actual.actualStorageGb}GB ${actual.actualStorageType || "storage"}`);
  return `Good for ${course.courseName}: ${parts.join(" + ")}`;
}

// Shown when no course is selected: plain specs
function specSummary(unit) {
  const actual = unit.actualSpecs || {};
  const parts = [];
  if (actual.actualRamGb != null) parts.push(`${actual.actualRamGb}GB RAM`);
  if (actual.actualStorageGb != null) parts.push(`${actual.actualStorageGb}GB ${actual.actualStorageType || "storage"}`);
  return parts.join(", ");
}

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  const list = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

/* ---------- Icons ---------- */

const svgProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };

const LaptopIcon = ({ size = 56 }) => (
  <svg {...svgProps} width={size} height={size}>
    <rect x="5" y="5.5" width="14" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 18.5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const BatteryIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="7.5" width="16" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M21 10.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M6.5 10.5v3M9.5 10.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg {...svgProps}>
    <path
      d="M12 3l7 2.8v5.4c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V5.8L12 3Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg {...svgProps} width="16" height="16">
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M7.8 12.4l3 3 5.4-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FilterIcon = () => (
  <svg {...svgProps}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg {...svgProps} width="20" height="20">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ dir = "right" }) => (
  <svg {...svgProps} width="16" height="16" style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}>
    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SearchCheckIcon = () => (
  <svg {...svgProps} width="26" height="26">
    <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const InspectIcon = () => (
  <svg {...svgProps} width="26" height="26">
    <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8.5 12.3l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CapIcon = () => (
  <svg {...svgProps} width="26" height="26">
    <path d="M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M6.5 11.8V16c0 1.3 2.5 2.5 5.5 2.5s5.5-1.2 5.5-2.5v-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/* ---------- Small components ---------- */

function CardPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="hp-photo-empty" aria-hidden="true">
        <LaptopIcon />
      </div>
    );
  }
  return <img className="hp-photo" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function LaptopCard({ row, course, verified, onOpenUnit }) {
  const { unit, price } = row;
  const listing = unit.listing || {};
  const model = unit.model || {};
  const showStudent = verified && listing.studentPrice != null;
  const reserved = unit.unitStatus === "reserved";
  const months = listing.warrantyMonths;
  const fullName = `${model.brand || ""} ${model.modelName || ""}`.trim();

  return (
    <article className={`hp-card ${reserved ? "is-reserved" : ""}`}>
      <a
        className="hp-card-link"
        href={`/laptops/${unit.unitId}`}
        onClick={(event) => {
          if (onOpenUnit) {
            event.preventDefault();
            onOpenUnit(unit.unitId);
          }
        }}
        aria-label={`${fullName}, ${peso.format(price)}`}
      >
        <div className="hp-card-media">
          <CardPhoto src={getPhoto(unit)} alt={fullName} />
          {unit.conditionGrade && <span className={`hp-grade grade-${String(unit.conditionGrade).toLowerCase()}`}>Grade {unit.conditionGrade}</span>}
          {reserved && <span className="hp-reserved">Reserved</span>}
        </div>

        <div className="hp-card-body">
          <p className="hp-card-brand">{model.brand}</p>
          <h3 className="hp-card-title">{model.modelName}</h3>

          {course ? (
            <p className="hp-fit">
              <CheckCircleIcon />
              <span>{fitLabel(unit, course)}</span>
            </p>
          ) : (
            <p className="hp-specs">{specSummary(unit)}</p>
          )}

          <div className="hp-price">
            <span className={`hp-price-now ${showStudent ? "is-student" : ""}`}>{peso.format(price)}</span>
            {showStudent && <span className="hp-price-old">{peso.format(listing.price)}</span>}
          </div>
          {showStudent && <p className="hp-price-tag">Student price</p>}

          <ul className="hp-meta">
            {unit.estimatedBatteryHrs != null && (
              <li>
                <BatteryIcon />
                About {unit.estimatedBatteryHrs} hrs battery
              </li>
            )}
            {months != null && (
              <li>
                <ShieldIcon />
                {months}-month warranty
              </li>
            )}
          </ul>
        </div>
      </a>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="hp-card hp-skeleton" aria-hidden="true">
      <div className="hp-card-media" />
      <div className="hp-card-body">
        <span className="hp-sk-line w40" />
        <span className="hp-sk-line w80" />
        <span className="hp-sk-line w60" />
        <span className="hp-sk-line w50" />
      </div>
    </div>
  );
}

function CheckGroup({ legend, options, selected, onToggle, idPrefix }) {
  return (
    <fieldset className="hp-group">
      <legend>{legend}</legend>
      {options.map((option) => {
        const id = `${idPrefix}-${legend}-${option.value}`.replace(/\s+/g, "-");
        return (
          <label key={option.value} className="hp-check" htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span className="hp-check-box" aria-hidden="true" />
            <span className="hp-check-label">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function FilterPanel({ idPrefix, facets, filters, setFilters, maxPrice, onMaxPriceChange, onClear, activeCount }) {
  return (
    <div className="hp-filters">
      <div className="hp-filters-head">
        <h2>Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="hp-link" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {facets.brands.length > 0 && (
        <CheckGroup
          legend="Brand"
          idPrefix={idPrefix}
          options={facets.brands.map((b) => ({ value: b, label: b }))}
          selected={filters.brands}
          onToggle={(v) => setFilters((f) => ({ ...f, brands: toggleIn(f.brands, v) }))}
        />
      )}

      {facets.grades.length > 0 && (
        <CheckGroup
          legend="Condition grade"
          idPrefix={idPrefix}
          options={facets.grades.map((g) => ({ value: g, label: `Grade ${g}` }))}
          selected={filters.grades}
          onToggle={(v) => setFilters((f) => ({ ...f, grades: toggleIn(f.grades, v) }))}
        />
      )}

      <fieldset className="hp-group">
        <legend>Price</legend>
        <div className="hp-price-inputs">
          <div>
            <label htmlFor={`${idPrefix}-min`}>Min</label>
            <input
              id={`${idPrefix}-min`}
              type="number"
              inputMode="numeric"
              min="0"
              step={PRICE_STEP}
              placeholder="0"
              value={filters.minPrice}
              onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-max`}>Max</label>
            <input
              id={`${idPrefix}-max`}
              type="number"
              inputMode="numeric"
              min="0"
              step={PRICE_STEP}
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {facets.screens.length > 0 && (
        <CheckGroup
          legend="Screen size"
          idPrefix={idPrefix}
          options={facets.screens.map((s) => ({ value: s, label: `${s}-inch` }))}
          selected={filters.screens}
          onToggle={(v) => setFilters((f) => ({ ...f, screens: toggleIn(f.screens, v) }))}
        />
      )}

      <CheckGroup
        legend="Availability"
        idPrefix={idPrefix}
        options={AVAILABILITY_OPTIONS}
        selected={filters.availability}
        onToggle={(v) => setFilters((f) => ({ ...f, availability: toggleIn(f.availability, v) }))}
      />
    </div>
  );
}

/* ---------- Page ---------- */

const DEFAULT_FILTERS = { brands: [], grades: [], screens: [], availability: ["available"], minPrice: "" };
const EMPTY_RECO = { courseId: "", budget: null, mustHaves: [] };

export default function HomePage({
  user = demoUser,
  verification = demoVerification,
  courses = demoCourses,
  units = demoUnits,
  cartCount = 0,
  logoSrc,
  loading = false,
  error = "",
  onLogout,
  onOpenUnit,
}) {
  const [draft, setDraft] = useState(EMPTY_RECO); // recommendation bar (not applied until "Show matches")
  const [applied, setApplied] = useState(EMPTY_RECO);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("best");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef(null);

  const verified = useMemo(() => isStudentVerified(verification), [verification]);

  // Only listed units (with a price) can be shown
  const listedUnits = useMemo(() => units.filter((u) => u.listing && u.listing.price != null), [units]);

  // Slider bounds follow the price the buyer actually pays (student price if verified)
  const { sliderMin, sliderMax } = useMemo(() => {
    const prices = listedUnits.map((u) => getPrice(u, verified)).filter((n) => n != null);
    if (!prices.length) return { sliderMin: 0, sliderMax: 100000 };
    const lo = Math.floor(Math.min(...prices) / 1000) * 1000;
    const hi = Math.max(Math.ceil(Math.max(...prices) / 1000) * 1000, lo + PRICE_STEP);
    return { sliderMin: lo, sliderMax: hi };
  }, [listedUnits, verified]);

  const draftBudget = Math.min(Math.max(draft.budget ?? sliderMax, sliderMin), sliderMax);
  const appliedBudget = applied.budget ?? sliderMax;
  const course = useMemo(() => courses.find((c) => c.courseId === applied.courseId) || null, [courses, applied.courseId]);

  const facets = useMemo(() => {
    const unique = (list) => [...new Set(list.filter((v) => v != null && v !== ""))];
    return {
      brands: unique(listedUnits.map((u) => u.model?.brand)).sort(),
      grades: unique(listedUnits.map((u) => u.conditionGrade)).sort(),
      screens: unique(listedUnits.map((u) => u.model?.specs?.screenSizeIn)).sort((a, b) => a - b),
    };
  }, [listedUnits]);

  const results = useMemo(() => {
    const minPrice = Number(filters.minPrice) || 0;
    const rows = [];

    for (const unit of listedUnits) {
      const price = getPrice(unit, verified);
      const specs = unit.model?.specs || {};

      if (price > appliedBudget || price < minPrice) continue;
      if (filters.availability.length && !filters.availability.includes(unit.unitStatus)) continue;
      if (filters.brands.length && !filters.brands.includes(unit.model?.brand)) continue;
      if (filters.grades.length && !filters.grades.includes(unit.conditionGrade)) continue;
      if (filters.screens.length && !filters.screens.includes(specs.screenSizeIn)) continue;

      if (applied.mustHaves.includes("battery") && !((unit.estimatedBatteryHrs ?? 0) >= BATTERY_MUST_HRS)) continue;
      if (applied.mustHaves.includes("gpu") && !hasDedicatedGpu(specs.gpu)) continue;
      if (applied.mustHaves.includes("light") && !(specs.weightKg != null && specs.weightKg <= LIGHT_MAX_KG)) continue;

      let headroom = 0;
      if (course) {
        const evaluation = evaluateCourse(unit, course);
        if (!evaluation.ok) continue;
        headroom = evaluation.headroom;
      }
      rows.push({ unit, price, headroom });
    }

    const byPrice = (a, b) => a.price - b.price;
    const sorters = {
      best: course
        ? (a, b) => b.headroom - a.headroom || byPrice(a, b)
        : (a, b) => new Date(b.unit.listing.listedAt || 0) - new Date(a.unit.listing.listedAt || 0),
      "price-asc": byPrice,
      "price-desc": (a, b) => b.price - a.price,
      battery: (a, b) => (b.unit.estimatedBatteryHrs ?? 0) - (a.unit.estimatedBatteryHrs ?? 0),
    };
    return rows.sort(sorters[sort] || sorters.best);
  }, [listedUnits, verified, appliedBudget, filters, applied.mustHaves, course, sort]);

  useEffect(() => setPage(1), [applied, filters, sort]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeFilterCount =
    filters.brands.length +
    filters.grades.length +
    filters.screens.length +
    (filters.minPrice ? 1 : 0) +
    (applied.budget != null && applied.budget < sliderMax ? 1 : 0) +
    (filters.availability.length === 1 && filters.availability[0] === "available" ? 0 : 1);

  // Lock page scroll while the mobile filter drawer is open
  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => event.key === "Escape" && setFiltersOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const scrollToResults = () => {
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleShowMatches = (event) => {
    event.preventDefault();
    setApplied({ courseId: draft.courseId, budget: draft.budget, mustHaves: draft.mustHaves });
    scrollToResults();
  };

  // The sidebar "Max" price and the budget slider are the same value
  const handleMaxPriceChange = (raw) => {
    const value = raw === "" ? null : Math.max(0, Number(raw));
    setApplied((a) => ({ ...a, budget: value }));
    setDraft((d) => ({ ...d, budget: value }));
  };

  const resetAll = () => {
    setDraft(EMPTY_RECO);
    setApplied(EMPTY_RECO);
    setFilters(DEFAULT_FILTERS);
  };

  const clearSidebarFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setApplied((a) => ({ ...a, budget: null }));
    setDraft((d) => ({ ...d, budget: null }));
  };

  const goToPage = (next) => {
    setPage(next);
    scrollToResults();
  };

  const fillPercent = ((draftBudget - sliderMin) / Math.max(sliderMax - sliderMin, 1)) * 100;

  const filterPanelProps = {
    facets,
    filters,
    setFilters,
    maxPrice: applied.budget ?? "",
    onMaxPriceChange: handleMaxPriceChange,
    onClear: clearSidebarFilters,
    activeCount: activeFilterCount,
  };

  const sortLabelFirst = course ? "Best match" : "Newest";

  return (
    <div className="hp-page">
      <Navbar user={user} cartCount={cartCount} logoSrc={logoSrc} onLogout={onLogout} />

      <main className="hp-main">
        {/* ---------- Hero ---------- */}
        <section className="hp-hero">
          <div className="hp-hero-glow" aria-hidden="true" />
          <div className="hp-hero-inner">
            <h1 className="hp-hero-title">Find the right laptop for your course</h1>
            <p className="hp-hero-sub">Every laptop is tested, graded, and covered by a warranty.</p>
          </div>
        </section>

        {/* ---------- Recommendation bar ---------- */}
        <section className="hp-reco-wrap" aria-label="Find laptops for your course">
          <form className="hp-reco" onSubmit={handleShowMatches}>
            <div className="hp-reco-field">
              <label htmlFor="hp-course">What will you study?</label>
              <select
                id="hp-course"
                value={draft.courseId}
                onChange={(e) => setDraft((d) => ({ ...d, courseId: e.target.value }))}
              >
                <option value="">Choose your course</option>
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.courseName} ({c.courseCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="hp-reco-field hp-reco-budget">
              <label htmlFor="hp-budget">
                Budget <strong>up to {peso.format(draftBudget)}</strong>
              </label>
              <input
                id="hp-budget"
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={PRICE_STEP}
                value={draftBudget}
                style={{ "--fill": `${fillPercent}%` }}
                onChange={(e) => setDraft((d) => ({ ...d, budget: Number(e.target.value) }))}
              />
            </div>

            <div className="hp-reco-field">
              <span className="hp-reco-label" id="hp-must-label">
                Must-haves
              </span>
              <div className="hp-chips" role="group" aria-labelledby="hp-must-label">
                {MUST_HAVES.map((m) => {
                  const on = draft.mustHaves.includes(m.value);
                  return (
                    <button
                      key={m.value}
                      type="button"
                      className={`hp-chip ${on ? "is-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => setDraft((d) => ({ ...d, mustHaves: toggleIn(d.mustHaves, m.value) }))}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="hp-reco-submit">
              Show matches
            </button>
          </form>
        </section>

        {/* ---------- Results ---------- */}
        <section className="hp-results" ref={resultsRef} aria-label="Laptops">
          <aside className="hp-sidebar" aria-label="Filters">
            <FilterPanel idPrefix="side" {...filterPanelProps} />
          </aside>

          <div className="hp-results-main">
            <div className="hp-toolbar">
              <div className="hp-toolbar-info">
                <p className="hp-count" aria-live="polite">
                  {loading ? "Loading laptops..." : `${results.length} ${results.length === 1 ? "laptop" : "laptops"}`}
                  {course && !loading ? ` for ${course.courseName}` : ""}
                </p>
                {verified && <span className="hp-verified">Student pricing applied</span>}
              </div>

              <div className="hp-toolbar-actions">
                <button type="button" className="hp-filter-btn" onClick={() => setFiltersOpen(true)}>
                  <FilterIcon />
                  Filters
                  {activeFilterCount > 0 && <span className="hp-filter-count">{activeFilterCount}</span>}
                </button>

                <div className="hp-sort">
                  <label htmlFor="hp-sort">Sort by</label>
                  <select id="hp-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="best">{sortLabelFirst}</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="battery">Longest battery</option>
                  </select>
                </div>
              </div>
            </div>

            {course && (
              <p className="hp-note">
                Showing laptops that meet the {course.courseName} requirements.
                {course.requirements?.reqNotes ? ` ${course.requirements.reqNotes}` : ""}
              </p>
            )}

            {error && (
              <div className="hp-alert" role="alert">
                {error}
              </div>
            )}

            {loading ? (
              <div className="hp-grid">
                {Array.from({ length: 8 }, (_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="hp-empty">
                <div className="hp-empty-icon">
                  <SearchCheckIcon />
                </div>
                <h2>No laptops match yet</h2>
                <p>Try a higher budget, fewer must-haves, or another course.</p>
                <button type="button" className="hp-empty-btn" onClick={resetAll}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="hp-grid">
                  {pageRows.map((row) => (
                    <LaptopCard key={row.unit.unitId} row={row} course={course} verified={verified} onOpenUnit={onOpenUnit} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="hp-pagination" aria-label="Pagination">
                    <button
                      type="button"
                      className="hp-page-btn"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <ChevronIcon dir="left" />
                    </button>
                    {pageNumbers(currentPage, totalPages).map((p) =>
                      typeof p === "string" ? (
                        <span key={p} className="hp-page-gap" aria-hidden="true">
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={`hp-page-btn ${p === currentPage ? "is-current" : ""}`}
                          onClick={() => goToPage(p)}
                          aria-current={p === currentPage ? "page" : undefined}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="hp-page-btn"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      <ChevronIcon />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>

        {/* ---------- Trust strip ---------- */}
        <section className="hp-trust" aria-label="Why buy from ByteBud">
          <div className="hp-trust-inner">
            <div className="hp-trust-item">
              <span className="hp-trust-icon">
                <InspectIcon />
              </span>
              <div>
                <h3>How grading works</h3>
                <p>
                  Every laptop is inspected for its screen, keyboard, ports, and battery, and its data is wiped. The
                  grade rates its overall condition.
                </p>
              </div>
            </div>
            <div className="hp-trust-item">
              <span className="hp-trust-icon">
                <CapIcon />
              </span>
              <div>
                <h3>Student discount</h3>
                <p>Verified students see student pricing automatically. Submit your school proof from your account.</p>
              </div>
            </div>
            <div className="hp-trust-item">
              <span className="hp-trust-icon">
                <ShieldIcon />
              </span>
              <div>
                <h3>Warranty included</h3>
                <p>Every laptop is covered by a warranty. The length is shown on each listing.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer logoSrc={logoSrc} />

      {/* ---------- Mobile filter drawer ---------- */}
      {filtersOpen && (
        <div
          className="hp-drawer-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFiltersOpen(false);
          }}
        >
          <div className="hp-drawer" role="dialog" aria-modal="true" aria-label="Filters">
            <button type="button" className="hp-drawer-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <CloseIcon />
            </button>
            <div className="hp-drawer-body">
              <FilterPanel idPrefix="drawer" {...filterPanelProps} />
            </div>
            <div className="hp-drawer-foot">
              <button type="button" className="hp-reco-submit" onClick={() => setFiltersOpen(false)}>
                Show {results.length} {results.length === 1 ? "laptop" : "laptops"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
