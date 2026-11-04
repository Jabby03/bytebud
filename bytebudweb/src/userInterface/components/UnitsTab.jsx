import { useEffect, useMemo, useState } from "react";
import {
  Drawer, Field, Pagination, StatusBadge, CheckIcon, CrossIcon, ImageIcon, PlusIcon, TrashIcon,
  GRADES, UNIT_STATUSES, formatDate, formatDateTime, formatPeso, fromLocalInput, toLocalInput, toNumber,
} from "../pages/AdminShared.jsx";

/**
 * B2 > Units tab: table + [Add unit] + drawer with sub-tabs (Details | Inspection | Repairs | Listing).
 *
 * Collections: Units (serialNumber, modelId, acquisitionId, costBasis, conditionGrade, cosmeticNotes,
 * batteryHealthPct, estimatedBatteryHrs, osInstalled, accessories[], unitStatus, reserveUntil,
 * actualSpecs, listing, inspections[], repairs[]), joined with Laptop_Models (brand, modelName).
 */

const PAGE_SIZE = 10;
const clone = (v) => JSON.parse(JSON.stringify(v));
const byNewest = (field) => (a, b) => new Date(b[field]) - new Date(a[field]);
const sumRepairs = (u) => (u.repairs || []).reduce((s, r) => s + (Number(r.partCost) || 0) + (Number(r.laborCost) || 0), 0);

export const blankUnit = () => ({
  unitId: null, serialNumber: "", modelId: "", acquisitionId: "", costBasis: "", conditionGrade: "",
  cosmeticNotes: "", batteryHealthPct: "", estimatedBatteryHrs: "", osInstalled: "", accessories: [],
  unitStatus: "awaiting_inspection", reserveUntil: null,
  actualSpecs: { actualRamGb: "", actualStorageGb: "", actualStorageType: "" },
  listing: { price: "", studentPrice: "", warrantyMonths: "", listedAt: null, photos: [] },
  inspections: [], repairs: [],
});

// Turns the form strings into the stored types.
function normalize(d) {
  return {
    ...d,
    serialNumber: String(d.serialNumber || "").trim(),
    acquisitionId: d.acquisitionId || null,
    costBasis: toNumber(d.costBasis),
    batteryHealthPct: toNumber(d.batteryHealthPct),
    estimatedBatteryHrs: toNumber(d.estimatedBatteryHrs),
    osInstalled: String(d.osInstalled || "").trim(),
    actualSpecs: {
      actualRamGb: toNumber(d.actualSpecs?.actualRamGb),
      actualStorageGb: toNumber(d.actualSpecs?.actualStorageGb),
      actualStorageType: String(d.actualSpecs?.actualStorageType || "").trim(),
    },
    listing: normalizeListing(d.listing),
  };
}

function normalizeListing(l = {}) {
  return {
    ...l,
    price: toNumber(l.price),
    studentPrice: toNumber(l.studentPrice),
    warrantyMonths: toNumber(l.warrantyMonths),
    photos: l.photos || [],
  };
}

function validateDetails(d, units, isAdmin) {
  const e = {};
  const serial = String(d.serialNumber || "").trim();
  if (!serial) e.serialNumber = "Enter the serial number.";
  else if (units.some((u) => u.unitId !== d.unitId && String(u.serialNumber).toLowerCase() === serial.toLowerCase()))
    e.serialNumber = "This serial number already exists.";
  if (!d.modelId) e.modelId = "Choose a laptop model.";
  if (!d.acquisitionId) e.acquisitionId = "Choose an acquisition batch.";
  if (!d.conditionGrade) e.conditionGrade = "Choose a grade.";
  const cost = toNumber(d.costBasis);
  if (isAdmin && (cost == null || cost < 0)) e.costBasis = "Enter the cost (0 or more).";
  const battery = toNumber(d.batteryHealthPct);
  if (battery != null && (battery < 0 || battery > 100)) e.batteryHealthPct = "Use a value from 0 to 100.";
  const hrs = toNumber(d.estimatedBatteryHrs);
  if (hrs != null && hrs < 0) e.estimatedBatteryHrs = "Use 0 or more.";
  const ram = toNumber(d.actualSpecs?.actualRamGb);
  if (ram != null && ram < 0) e.actualRamGb = "Use 0 or more.";
  const storage = toNumber(d.actualSpecs?.actualStorageGb);
  if (storage != null && storage < 0) e.actualStorageGb = "Use 0 or more.";
  return e;
}

function validateListing(l = {}) {
  const e = {};
  const price = toNumber(l.price);
  const student = toNumber(l.studentPrice);
  const months = toNumber(l.warrantyMonths);
  if (price != null && price < 0) e.price = "Use 0 or more.";
  if (student != null && student < 0) e.studentPrice = "Use 0 or more.";
  if (price != null && student != null && student > price) e.studentPrice = "Student price cannot be higher than the price.";
  if (months != null && (months < 0 || !Number.isInteger(months))) e.warrantyMonths = "Use a whole number of months.";
  return e;
}

const DETAIL_KEYS = ["serialNumber", "modelId", "conditionGrade", "costBasis", "batteryHealthPct", "estimatedBatteryHrs", "actualRamGb", "actualStorageGb"];

/* ======================================================================= */

export default function UnitsTab({
  units, models, acquisitions, users, admin, query, acquisitionFilter, onClearAcquisitionFilter,
  initialStatus = "", onSave, onCreate, notify, isAdmin = false,
}) {
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [gradeFilter, setGradeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null); // unitId | "new" | null

  const modelsById = useMemo(() => new Map(models.map((m) => [m.modelId, m])), [models]);
  const modelLabel = (id) => {
    const m = modelsById.get(id);
    return m ? `${m.brand} ${m.modelName}` : "Unknown model";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units
      .filter((u) => {
        if (statusFilter && u.unitStatus !== statusFilter) return false;
        if (gradeFilter && u.conditionGrade !== gradeFilter) return false;
        if (acquisitionFilter && u.acquisitionId !== acquisitionFilter) return false;
        if (q && !`${u.serialNumber} ${modelLabel(u.modelId)}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort(byNewest("unitCreatedAt"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, query, statusFilter, gradeFilter, acquisitionFilter, modelsById]);

  useEffect(() => setPage(1), [query, statusFilter, gradeFilter, acquisitionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = selectedId && selectedId !== "new" ? units.find((u) => u.unitId === selectedId) : null;
  const acqFilterLabel = acquisitions.find((a) => a.acquisitionId === acquisitionFilter)?.invoiceNo;

  const handleCreate = async (unit) => {
    const created = await onCreate(unit);
    setSelectedId(created.unitId);
    return created;
  };

  return (
    <div className="iv-panel">
      <div className="iv-toolbar">
        <div className="iv-filters">
          <select className="ad-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {UNIT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select className="ad-select" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} aria-label="Filter by grade">
            <option value="">All grades</option>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
          {acquisitionFilter && (
            <button type="button" className="iv-chip" onClick={onClearAcquisitionFilter}>
              Batch {acqFilterLabel} <CrossIcon />
            </button>
          )}
        </div>
        <button type="button" className="ad-btn ad-btn-primary" onClick={() => setSelectedId("new")}>
          <PlusIcon /> Add unit
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="ad-empty">
          <strong>No units found</strong>
          Try another search or filter, or add a unit.
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Serial number</th>
                <th>Model</th>
                <th>Grade</th>
                <th>Status</th>
                {isAdmin && <th className="num">Cost basis</th>}
                <th className="num">Listing price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.unitId} onClick={() => setSelectedId(u.unitId)}>
                  <td>
                    <button type="button" className="ad-row-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(u.unitId); }}>
                      {u.serialNumber}
                    </button>
                    {String(u.serialNumber).startsWith("TBA-") && <span className="ad-cell-sub">Serial number needed</span>}
                  </td>
                  <td>{modelLabel(u.modelId)}</td>
                  <td>{u.conditionGrade ? `Grade ${u.conditionGrade}` : "-"}</td>
                  <td><StatusBadge list={UNIT_STATUSES} value={u.unitStatus} /></td>
                  {isAdmin && <td className="num">{formatPeso(u.costBasis)}</td>}
                  <td className="num">{formatPeso(u.listing?.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />

      {selectedId && (
        <UnitDrawer
          key={selectedId}
          unit={selected}
          isNew={selectedId === "new"}
          units={units}
          models={models}
          acquisitions={acquisitions}
          users={users}
          admin={admin}
          isAdmin={isAdmin}
          modelLabel={modelLabel}
          onSave={onSave}
          onCreate={handleCreate}
          onClose={() => setSelectedId(null)}
          notify={notify}
        />
      )}
    </div>
  );
}

/* ======================================================================= */

function UnitDrawer({ unit, isNew, units, models, acquisitions, users, admin, isAdmin, modelLabel, onSave, onCreate, onClose, notify }) {
  const [saved, setSaved] = useState(() => (isNew ? blankUnit() : clone(unit)));
  const [draft, setDraft] = useState(() => (isNew ? blankUnit() : clone(unit)));
  const [tab, setTab] = useState("details");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [inspForm, setInspForm] = useState(null);
  const [repairForm, setRepairForm] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [accInput, setAccInput] = useState("");

  const nameOf = (id) => users.find((u) => u.userId === id)?.fullName || "Unknown";
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setSpec = (key, value) => setDraft((d) => ({ ...d, actualSpecs: { ...d.actualSpecs, [key]: value } }));
  const setListing = (key, value) => setDraft((d) => ({ ...d, listing: { ...d.listing, [key]: value } }));
  const clearError = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

  // Saves only a part of the unit (inspection, repair, publish) on top of the last saved version.
  const commitPartial = async (patch, message) => {
    setBusy(true);
    try {
      const next = { ...saved, ...patch };
      await onSave(next);
      setSaved(next);
      setDraft((d) => ({ ...d, ...patch }));
      notify(message);
      return true;
    } catch (error) {
      notify(error?.message || "Could not save.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const found = { ...validateDetails(draft, units, isAdmin), ...validateListing(draft.listing) };
    setErrors(found);
    if (Object.keys(found).length) {
      setTab(DETAIL_KEYS.some((k) => found[k]) ? "details" : "listing");
      notify("Please fix the highlighted fields.", "error");
      return;
    }
    const next = { ...normalize(draft), inspections: saved.inspections, repairs: saved.repairs };
    setBusy(true);
    try {
      if (isNew) {
        await onCreate(next);
        notify("Unit added.");
      } else {
        await onSave(next);
        setSaved(next);
        setDraft(next);
        notify("Changes saved.");
      }
    } catch (error) {
      notify(error?.message || "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  };

  /* ----- Accessories ----- */
  const addAccessory = () => {
    const value = accInput.trim().replace(/,$/, "");
    if (value && !draft.accessories.includes(value)) set("accessories", [...draft.accessories, value]);
    setAccInput("");
  };

  /* ----- Photos ----- */
  const addPhoto = () => {
    const url = photoUrl.trim();
    if (!url) return;
    setListing("photos", [...draft.listing.photos, { photoUrl: url, isPrimary: draft.listing.photos.length === 0 }]);
    setPhotoUrl("");
  };
  const setPrimary = (index) => setListing("photos", draft.listing.photos.map((p, i) => ({ ...p, isPrimary: i === index })));
  const removePhoto = (index) => {
    const rest = draft.listing.photos.filter((_, i) => i !== index);
    if (rest.length && !rest.some((p) => p.isPrimary)) rest[0] = { ...rest[0], isPrimary: true };
    setListing("photos", rest);
  };

  /* ----- Inspection ----- */
  const startInspection = () =>
    setInspForm({ screenOk: false, keyboardOk: false, portsOk: false, batteryOk: false, dataWiped: false, wipeMethod: "", passed: false, touched: false, inspectNotes: "", error: "" });

  const setCheck = (key, value) =>
    setInspForm((f) => {
      const next = { ...f, [key]: value, error: "" };
      if (!next.touched && key !== "wipeMethod" && key !== "inspectNotes" && key !== "passed") {
        next.passed = next.screenOk && next.keyboardOk && next.portsOk && next.batteryOk && next.dataWiped;
      }
      return next;
    });

  const submitInspection = async (event) => {
    event.preventDefault();
    if (inspForm.dataWiped && !inspForm.wipeMethod.trim()) {
      setInspForm((f) => ({ ...f, error: "Enter the data wipe method." }));
      return;
    }
    const entry = {
      inspectedBy: admin.userId,
      inspectedAt: new Date().toISOString(),
      dataWiped: inspForm.dataWiped,
      wipeMethod: inspForm.dataWiped ? inspForm.wipeMethod.trim() : "",
      screenOk: inspForm.screenOk,
      keyboardOk: inspForm.keyboardOk,
      portsOk: inspForm.portsOk,
      batteryOk: inspForm.batteryOk,
      passed: inspForm.passed,
      inspectNotes: inspForm.inspectNotes.trim(),
    };
    // Flow rule: a passed inspection makes the unit ready to list; a failed one sends it to repair.
    let status = saved.unitStatus;
    if (entry.passed && ["awaiting_inspection", "in_repair"].includes(status)) status = "ready";
    else if (!entry.passed && ["awaiting_inspection", "ready", "ready_to_list"].includes(status)) status = "in_repair";

    const ok = await commitPartial(
      { inspections: [entry, ...saved.inspections], unitStatus: status },
      entry.passed ? "Inspection recorded: passed." : "Inspection recorded: failed. Unit moved to repair."
    );
    if (ok) setInspForm(null);
  };

  /* ----- Repairs ----- */
  const submitRepair = async (event) => {
    event.preventDefault();
    const part = repairForm.partReplaced.trim();
    const partCost = toNumber(repairForm.partCost) ?? 0;
    const laborCost = toNumber(repairForm.laborCost) ?? 0;
    const found = {};
    if (!part) found.partReplaced = "Enter what was replaced or fixed.";
    if (partCost < 0) found.partCost = "Use 0 or more.";
    if (laborCost < 0) found.laborCost = "Use 0 or more.";
    if (Object.keys(found).length) return setRepairForm((f) => ({ ...f, errors: found }));

    const entry = {
      repairedBy: admin.userId,
      repairedAt: new Date().toISOString(),
      partReplaced: part,
      partCost,
      laborCost,
      repairNotes: repairForm.repairNotes.trim(),
    };
    const ok = await commitPartial({ repairs: [entry, ...saved.repairs] }, "Repair added.");
    if (ok) setRepairForm(null);
  };

  /* ----- Listing ----- */
  const latestInspection = [...saved.inspections].sort(byNewest("inspectedAt"))[0];
  const checks = {
    inspection: !!latestInspection?.passed,
    price: Number(draft.listing.price) > 0,
    photo: draft.listing.photos.length > 0,
  };
  const isPublished = saved.unitStatus === "available";
  const canPublish = ["ready", "ready_to_list"].includes(saved.unitStatus) && checks.inspection && checks.price && checks.photo;

  const publish = async () => {
    const found = validateListing(draft.listing);
    setErrors((e) => ({ ...e, ...found }));
    if (Object.keys(found).length) return notify("Please fix the highlighted fields.", "error");
    await commitPartial(
      { listing: { ...normalizeListing(draft.listing), listedAt: saved.listing.listedAt || new Date().toISOString() }, unitStatus: "available" },
      "Published to the store."
    );
  };
  const unpublish = () => commitPartial({ unitStatus: "ready" }, "Removed from the store.");

  /* ----- Render ----- */
  const repairTotal = sumRepairs(saved);
  const tabs = [
    { key: "details", label: "Details" },
    { key: "inspection", label: `Inspection${saved.inspections.length ? ` (${saved.inspections.length})` : ""}`, disabled: isNew },
    { key: "repairs", label: `Repairs${saved.repairs.length ? ` (${saved.repairs.length})` : ""}`, disabled: isNew },
    { key: "listing", label: "Listing" },
  ];

  const footer =
    tab === "details" || tab === "listing" ? (
      <>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={onClose}>
          {isNew ? "Cancel" : "Close"}
        </button>
        <button type="button" className="ad-btn ad-btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? "Saving..." : isNew ? "Add unit" : "Save changes"}
        </button>
      </>
    ) : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? "Add unit" : saved.serialNumber}
      subtitle={isNew ? "Create a unit that did not come from an acquisition batch" : modelLabel(saved.modelId)}
      badge={isNew ? null : <StatusBadge list={UNIT_STATUSES} value={saved.unitStatus} />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      footer={footer}
    >
      {/* ================= Details ================= */}
      {tab === "details" && (
        <div className="ad-form-grid">
          <Field label="Serial number" htmlFor="u-serial" error={errors.serialNumber} hint={String(draft.serialNumber).startsWith("TBA-") ? "Temporary value: enter the real serial number." : undefined}>
            <input id="u-serial" type="text" value={draft.serialNumber} aria-invalid={!!errors.serialNumber}
              onChange={(e) => { set("serialNumber", e.target.value); clearError("serialNumber"); }} />
          </Field>

          <Field label="Laptop model" htmlFor="u-model" error={errors.modelId}>
            <select id="u-model" value={draft.modelId} aria-invalid={!!errors.modelId}
              onChange={(e) => { set("modelId", e.target.value); clearError("modelId"); }}>
              <option value="">Choose a model</option>
              {models.map((m) => (
                <option key={m.modelId} value={m.modelId}>{m.brand} {m.modelName}</option>
              ))}
            </select>
          </Field>

          <Field label="Acquisition batch" htmlFor="u-acq" error={errors.acquisitionId}>
            <select id="u-acq" value={draft.acquisitionId || ""} aria-invalid={!!errors.acquisitionId}
              onChange={(e) => { set("acquisitionId", e.target.value); clearError("acquisitionId"); }}>
              <option value="">Choose an acquisition</option>
              {acquisitions.map((a) => (
                <option key={a.acquisitionId} value={a.acquisitionId}>{a.invoiceNo}</option>
              ))}
            </select>
          </Field>

          <Field label="Condition grade" htmlFor="u-grade" error={errors.conditionGrade}>
            <select id="u-grade" value={draft.conditionGrade} aria-invalid={!!errors.conditionGrade}
              onChange={(e) => { set("conditionGrade", e.target.value); clearError("conditionGrade"); }}>
              <option value="">Choose a grade</option>
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </Field>

          {isAdmin && <Field label="Cost basis (PHP)" htmlFor="u-cost" error={errors.costBasis} hint="What this unit cost you, before repairs.">
            <input id="u-cost" type="number" min="0" step="1" value={draft.costBasis ?? ""} aria-invalid={!!errors.costBasis}
              onChange={(e) => { set("costBasis", e.target.value); clearError("costBasis"); }} />
          </Field>}

          <Field label="Status" htmlFor="u-status">
            <select id="u-status" value={draft.unitStatus} onChange={(e) => set("unitStatus", e.target.value)}>
              {UNIT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Reserved until" htmlFor="u-reserve" hint={draft.unitStatus === "reserved" ? undefined : "Only used when the status is Reserved."}>
            <input id="u-reserve" type="datetime-local" value={toLocalInput(draft.reserveUntil)} disabled={draft.unitStatus !== "reserved"}
              onChange={(e) => set("reserveUntil", fromLocalInput(e.target.value))} />
          </Field>

          <Field label="Operating system installed" htmlFor="u-os">
            <input id="u-os" type="text" placeholder="Windows 11 Pro" value={draft.osInstalled ?? ""} onChange={(e) => set("osInstalled", e.target.value)} />
          </Field>

          <Field label="Battery health (%)" htmlFor="u-bhealth" error={errors.batteryHealthPct}>
            <input id="u-bhealth" type="number" min="0" max="100" value={draft.batteryHealthPct ?? ""} aria-invalid={!!errors.batteryHealthPct}
              onChange={(e) => { set("batteryHealthPct", e.target.value); clearError("batteryHealthPct"); }} />
          </Field>

          <Field label="Estimated battery life (hours)" htmlFor="u-bhrs" error={errors.estimatedBatteryHrs}>
            <input id="u-bhrs" type="number" min="0" step="0.5" value={draft.estimatedBatteryHrs ?? ""} aria-invalid={!!errors.estimatedBatteryHrs}
              onChange={(e) => { set("estimatedBatteryHrs", e.target.value); clearError("estimatedBatteryHrs"); }} />
          </Field>

          <div className="span-2 ad-section-title" style={{ margin: "6px 0 -4px" }}>Actual specs of this unit</div>

          <Field label="RAM (GB)" htmlFor="u-ram" error={errors.actualRamGb}>
            <input id="u-ram" type="number" min="0" value={draft.actualSpecs.actualRamGb ?? ""} aria-invalid={!!errors.actualRamGb}
              onChange={(e) => { setSpec("actualRamGb", e.target.value); clearError("actualRamGb"); }} />
          </Field>

          <Field label="Storage (GB)" htmlFor="u-storage" error={errors.actualStorageGb}>
            <input id="u-storage" type="number" min="0" value={draft.actualSpecs.actualStorageGb ?? ""} aria-invalid={!!errors.actualStorageGb}
              onChange={(e) => { setSpec("actualStorageGb", e.target.value); clearError("actualStorageGb"); }} />
          </Field>

          <Field label="Storage type" htmlFor="u-stype" className="span-2">
            <input id="u-stype" type="text" list="u-stype-options" placeholder="SSD" value={draft.actualSpecs.actualStorageType ?? ""}
              onChange={(e) => setSpec("actualStorageType", e.target.value)} />
            <datalist id="u-stype-options">
              <option value="SSD" /><option value="NVMe SSD" /><option value="HDD" />
            </datalist>
          </Field>

          <Field label="Cosmetic notes" htmlFor="u-cosmetic" className="span-2">
            <textarea id="u-cosmetic" placeholder="Scratches, dents, worn keys..." value={draft.cosmeticNotes ?? ""} onChange={(e) => set("cosmeticNotes", e.target.value)} />
          </Field>

          <Field label="Accessories included" htmlFor="u-acc" className="span-2" hint="Press Enter to add each item.">
            <div className="iv-tags">
              {draft.accessories.map((a) => (
                <span key={a} className="iv-tag">
                  {a}
                  <button type="button" aria-label={`Remove ${a}`} onClick={() => set("accessories", draft.accessories.filter((x) => x !== a))}>
                    <CrossIcon />
                  </button>
                </span>
              ))}
              <input id="u-acc" type="text" className="iv-tag-input" placeholder="Charger, laptop bag..." value={accInput}
                onChange={(e) => setAccInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addAccessory(); }
                }}
                onBlur={addAccessory} />
            </div>
          </Field>
        </div>
      )}

      {/* ================= Inspection ================= */}
      {tab === "inspection" && (
        <div className="ad-section">
          <div className="iv-section-head">
            <h3 className="ad-section-title">Inspection history</h3>
            {!inspForm && (
              <button type="button" className="ad-btn ad-btn-primary ad-btn-sm" onClick={startInspection}>
                <PlusIcon /> Record inspection
              </button>
            )}
          </div>

          {inspForm && (
            <form className="ad-card iv-form" onSubmit={submitInspection} noValidate>
              <p className="ad-hint">Tick each check the unit passed. Inspector: {admin.fullName}.</p>
              <div className="iv-checks">
                {[
                  ["screenOk", "Screen works"],
                  ["keyboardOk", "Keyboard works"],
                  ["portsOk", "Ports work"],
                  ["batteryOk", "Battery holds a charge"],
                  ["dataWiped", "Data wiped"],
                ].map(([key, label]) => (
                  <label key={key} className="ad-check">
                    <input type="checkbox" checked={inspForm[key]} onChange={(e) => setCheck(key, e.target.checked)} />
                    <span className="ad-check-box" aria-hidden="true" />
                    {label}
                  </label>
                ))}
              </div>

              {inspForm.dataWiped && (
                <Field label="Wipe method" htmlFor="i-wipe" error={inspForm.error}>
                  <input id="i-wipe" type="text" placeholder="e.g. NIST 800-88 secure erase" value={inspForm.wipeMethod} aria-invalid={!!inspForm.error}
                    onChange={(e) => setCheck("wipeMethod", e.target.value)} />
                </Field>
              )}

              <Field label="Notes" htmlFor="i-notes">
                <textarea id="i-notes" value={inspForm.inspectNotes} onChange={(e) => setCheck("inspectNotes", e.target.value)} />
              </Field>

              <label className="ad-check">
                <input type="checkbox" checked={inspForm.passed}
                  onChange={(e) => setInspForm((f) => ({ ...f, passed: e.target.checked, touched: true }))} />
                <span className="ad-check-box" aria-hidden="true" />
                Mark this inspection as passed
              </label>

              <div className="iv-form-actions">
                <button type="button" className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setInspForm(null)}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary ad-btn-sm" disabled={busy}>Save inspection</button>
              </div>
            </form>
          )}

          {saved.inspections.length === 0 && !inspForm ? (
            <div className="ad-empty"><strong>No inspection yet</strong>Record the first inspection to make this unit ready to list.</div>
          ) : (
            [...saved.inspections].sort(byNewest("inspectedAt")).map((i, idx) => (
              <div key={`${i.inspectedAt}-${idx}`} className="ad-card">
                <div className="iv-entry-head">
                  <span className={`ad-badge tone-${i.passed ? "green" : "red"}`}>{i.passed ? "Passed" : "Failed"}</span>
                  <span className="iv-entry-meta">{formatDateTime(i.inspectedAt)} by {nameOf(i.inspectedBy)}</span>
                </div>
                <ul className="iv-checklist">
                  {[["screenOk", "Screen"], ["keyboardOk", "Keyboard"], ["portsOk", "Ports"], ["batteryOk", "Battery"], ["dataWiped", "Data wiped"]].map(([key, label]) => (
                    <li key={key} className={i[key] ? "is-ok" : "is-bad"}>
                      {i[key] ? <CheckIcon /> : <CrossIcon />} {label}
                    </li>
                  ))}
                </ul>
                {i.dataWiped && i.wipeMethod && <p className="iv-entry-line">Wipe method: {i.wipeMethod}</p>}
                {i.inspectNotes && <p className="iv-entry-line">{i.inspectNotes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= Repairs ================= */}
      {tab === "repairs" && (
        <div className="ad-section">
          <div className="iv-section-head">
            <h3 className="ad-section-title">Repair history</h3>
            {!repairForm && (
              <button type="button" className="ad-btn ad-btn-primary ad-btn-sm"
                onClick={() => setRepairForm({ partReplaced: "", partCost: "", laborCost: "", repairNotes: "", errors: {} })}>
                <PlusIcon /> Add repair
              </button>
            )}
          </div>

          {isAdmin && <dl className="iv-totals">
            <div><dt>Cost basis</dt><dd>{formatPeso(saved.costBasis)}</dd></div>
            <div><dt>Repairs</dt><dd>{formatPeso(repairTotal)}</dd></div>
            <div><dt>Total cost</dt><dd>{formatPeso((Number(saved.costBasis) || 0) + repairTotal)}</dd></div>
          </dl>}

          {saved.unitStatus === "in_repair" && !repairForm && (
            <div className="ad-note is-warn">
              This unit is in repair. When the work is done, send it back for another inspection.
              <div style={{ marginTop: 10 }}>
                <button type="button" className="ad-btn ad-btn-ghost ad-btn-sm" disabled={busy}
                  onClick={() => commitPartial({ unitStatus: "awaiting_inspection" }, "Unit sent back to inspection.")}>
                  Repair finished: send to inspection
                </button>
              </div>
            </div>
          )}

          {repairForm && (
            <form className="ad-card iv-form" onSubmit={submitRepair} noValidate>
              <p className="ad-hint">Recorded by {admin.fullName}.</p>
              <div className="ad-form-grid">
                <Field label="Part replaced or fixed" htmlFor="r-part" className="span-2" error={repairForm.errors?.partReplaced}>
                  <input id="r-part" type="text" placeholder="e.g. Battery, RAM upgrade, keyboard" value={repairForm.partReplaced}
                    aria-invalid={!!repairForm.errors?.partReplaced}
                    onChange={(e) => setRepairForm((f) => ({ ...f, partReplaced: e.target.value, errors: {} }))} />
                </Field>
                <Field label="Part cost (PHP)" htmlFor="r-pcost" error={repairForm.errors?.partCost}>
                  <input id="r-pcost" type="number" min="0" value={repairForm.partCost} onChange={(e) => setRepairForm((f) => ({ ...f, partCost: e.target.value, errors: {} }))} />
                </Field>
                <Field label="Labor cost (PHP)" htmlFor="r-lcost" error={repairForm.errors?.laborCost}>
                  <input id="r-lcost" type="number" min="0" value={repairForm.laborCost} onChange={(e) => setRepairForm((f) => ({ ...f, laborCost: e.target.value, errors: {} }))} />
                </Field>
                <Field label="Notes" htmlFor="r-notes" className="span-2">
                  <textarea id="r-notes" value={repairForm.repairNotes} onChange={(e) => setRepairForm((f) => ({ ...f, repairNotes: e.target.value }))} />
                </Field>
              </div>
              <div className="iv-form-actions">
                <button type="button" className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setRepairForm(null)}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary ad-btn-sm" disabled={busy}>Save repair</button>
              </div>
            </form>
          )}

          {saved.repairs.length === 0 && !repairForm ? (
            <div className="ad-empty"><strong>No repairs</strong>Repairs and their costs will appear here.</div>
          ) : (
            [...saved.repairs].sort(byNewest("repairedAt")).map((r, idx) => (
              <div key={`${r.repairedAt}-${idx}`} className="ad-card">
                <div className="iv-entry-head">
                  <strong>{r.partReplaced}</strong>
                  <span className="iv-entry-cost">{formatPeso((Number(r.partCost) || 0) + (Number(r.laborCost) || 0))}</span>
                </div>
                <p className="iv-entry-meta">{formatDateTime(r.repairedAt)} by {nameOf(r.repairedBy)}</p>
                <p className="iv-entry-line">Part {formatPeso(r.partCost)} + labor {formatPeso(r.laborCost)}</p>
                {r.repairNotes && <p className="iv-entry-line">{r.repairNotes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= Listing ================= */}
      {tab === "listing" && (
        <>
          <div className="ad-section">
            <h3 className="ad-section-title">Store listing</h3>

            <ul className="iv-ready">
              <li className={checks.inspection ? "is-ok" : ""}>{checks.inspection ? <CheckIcon /> : <CrossIcon />} Latest inspection passed</li>
              <li className={checks.price ? "is-ok" : ""}>{checks.price ? <CheckIcon /> : <CrossIcon />} Price is set</li>
              <li className={checks.photo ? "is-ok" : ""}>{checks.photo ? <CheckIcon /> : <CrossIcon />} At least one photo</li>
            </ul>

            <div className="ad-form-grid">
              <Field label="Price (PHP)" htmlFor="l-price" error={errors.price}>
                <input id="l-price" type="number" min="0" value={draft.listing.price ?? ""} aria-invalid={!!errors.price}
                  onChange={(e) => { setListing("price", e.target.value); clearError("price"); }} />
              </Field>
              <Field label="Student price (PHP)" htmlFor="l-student" error={errors.studentPrice} hint="Shown to verified students.">
                <input id="l-student" type="number" min="0" value={draft.listing.studentPrice ?? ""} aria-invalid={!!errors.studentPrice}
                  onChange={(e) => { setListing("studentPrice", e.target.value); clearError("studentPrice"); }} />
              </Field>
              <Field label="Warranty (months)" htmlFor="l-warranty" error={errors.warrantyMonths}>
                <input id="l-warranty" type="number" min="0" step="1" value={draft.listing.warrantyMonths ?? ""} aria-invalid={!!errors.warrantyMonths}
                  onChange={(e) => { setListing("warrantyMonths", e.target.value); clearError("warrantyMonths"); }} />
              </Field>
              <Field label="Listed on" htmlFor="l-listed">
                <input id="l-listed" type="text" value={saved.listing?.listedAt ? formatDate(saved.listing.listedAt) : "Not listed yet"} disabled readOnly />
              </Field>
            </div>
          </div>

          <div className="ad-section">
            <h3 className="ad-section-title">Photos</h3>
            {draft.listing.photos.length === 0 ? (
              <p className="ad-hint">No photos yet. Paste an image link below.</p>
            ) : (
              <ul className="iv-photos">
                {draft.listing.photos.map((p, i) => (
                  <li key={`${p.photoUrl}-${i}`}>
                    <span className="iv-thumb">
                      {p.photoUrl ? <img src={p.photoUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                      <ImageIcon />
                    </span>
                    <span className="iv-photo-url">{p.photoUrl || "(empty link)"}</span>
                    <label className="ad-check">
                      <input type="radio" name="primary-photo" checked={!!p.isPrimary} onChange={() => setPrimary(i)} />
                      <span className="ad-check-box" aria-hidden="true" style={{ borderRadius: "50%" }} />
                      Primary
                    </label>
                    <button type="button" className="ad-icon-btn" aria-label="Remove photo" onClick={() => removePhoto(i)}>
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="iv-add-photo">
              <input type="url" className="ad-input" placeholder="https://..." aria-label="Photo link" value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhoto(); } }} />
              <button type="button" className="ad-btn ad-btn-ghost" onClick={addPhoto}>Add photo</button>
            </div>
          </div>

          {!isNew && (
            <div className="ad-section">
              <h3 className="ad-section-title">Publish</h3>
              {isPublished ? (
                <>
                  <p className="ad-hint">This laptop is live in the store.</p>
                  <button type="button" className="ad-btn ad-btn-danger" onClick={unpublish} disabled={busy}>Unpublish</button>
                </>
              ) : canPublish ? (
                <>
                  <p className="ad-hint">All checks passed. Publishing makes the unit available to buyers.</p>
                  <button type="button" className="ad-btn ad-btn-primary" onClick={publish} disabled={busy}>Publish to store</button>
                </>
              ) : (
                <p className="ad-note is-warn">
                  {["ready", "ready_to_list"].includes(saved.unitStatus)
                    ? "Complete the checklist above, then publish."
                    : saved.unitStatus === "reserved" || saved.unitStatus === "sold"
                      ? "This unit is reserved or sold, so it cannot be published or unpublished."
                      : "Finish inspection and repair first. A passed inspection makes the unit ready to list."}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
