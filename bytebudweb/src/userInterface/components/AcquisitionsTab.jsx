import { useMemo, useState } from "react";
import {
  Drawer, Field, Modal, Pagination, StatusBadge, PlusIcon, TrashIcon,
  ACQ_STATUSES, SOURCE_TYPES, formatDate, formatPeso, fromDateInput, labelOf, toDateInput, toNumber,
} from "./AdminShared";

/**
 * B2 > Acquisitions tab: table + [New acquisition] form (drawer) + [Split into units].
 *
 * Collections: Acquisitions (supplierId, recordedBy, sourceType, invoiceNo, totalCost, acqStatus,
 * acquiredAt, acqItems[] with modelId, quantity, unitCost), joined with Suppliers.companyName,
 * Laptop_Models (brand, modelName) and Users.fullName.
 */

const PAGE_SIZE = 10;
const clone = (v) => JSON.parse(JSON.stringify(v));

const itemsTotal = (items) => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
const unitCount = (acq) => (acq.acqItems || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);

const blankAcquisition = (admin) => ({
  acquisitionId: null,
  supplierId: "",
  recordedBy: admin.userId,
  sourceType: "",
  invoiceNo: "",
  totalCost: 0,
  acqStatus: "ordered",
  acquiredAt: new Date().toISOString(),
  acqItems: [{ modelId: "", quantity: 1, unitCost: "" }],
});

const normalize = (d) => {
  const acqItems = d.acqItems.map((i) => ({ modelId: i.modelId, quantity: toNumber(i.quantity), unitCost: toNumber(i.unitCost) }));
  return { ...d, invoiceNo: d.invoiceNo.trim(), acqItems, totalCost: itemsTotal(acqItems) };
};

function validate(d, acquisitions) {
  const e = {};
  if (!d.supplierId) e.supplierId = "Choose a supplier.";
  if (!d.sourceType) e.sourceType = "Choose a source type.";
  const invoice = d.invoiceNo.trim();
  if (!invoice) e.invoiceNo = "Enter the invoice number.";
  else if (acquisitions.some((a) => a.acquisitionId !== d.acquisitionId && a.invoiceNo.toLowerCase() === invoice.toLowerCase()))
    e.invoiceNo = "This invoice number is already recorded.";
  if (!d.acquiredAt) e.acquiredAt = "Choose a date.";
  if (!d.acqItems.length) e.items = "Add at least one item.";
  const itemErrors = d.acqItems.map((i) => {
    const row = {};
    if (!i.modelId) row.modelId = "Choose a model.";
    const q = toNumber(i.quantity);
    if (q == null || q < 1 || !Number.isInteger(q)) row.quantity = "Whole number, 1 or more.";
    const c = toNumber(i.unitCost);
    if (c == null || c < 0) row.unitCost = "Enter the cost.";
    return row;
  });
  if (itemErrors.some((r) => Object.keys(r).length)) e.itemErrors = itemErrors;
  return e;
}

/* ======================================================================= */

export default function AcquisitionsTab({
  acquisitions, suppliers, models, users, admin, query, onSave, onSplit, onViewUnits, notify,
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null); // acquisitionId | "new" | null

  const supplierName = (id) => suppliers.find((s) => s.supplierId === id)?.companyName || "Unknown supplier";
  const userName = (id) => users.find((u) => u.userId === id)?.fullName || "Unknown";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return acquisitions
      .filter((a) => {
        if (statusFilter && a.acqStatus !== statusFilter) return false;
        if (q && !`${a.invoiceNo} ${supplierName(a.supplierId)}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.acquiredAt) - new Date(a.acquiredAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquisitions, suppliers, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = selectedId && selectedId !== "new" ? acquisitions.find((a) => a.acquisitionId === selectedId) : null;

  return (
    <div className="iv-panel">
      <div className="iv-toolbar">
        <div className="iv-filters">
          <select className="ad-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            {ACQ_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="ad-btn ad-btn-primary" onClick={() => setSelectedId("new")}>
          <PlusIcon /> New acquisition
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="ad-empty">
          <strong>No acquisitions found</strong>
          Record a purchase from a supplier to start a new batch.
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Invoice no.</th>
                <th>Supplier</th>
                <th>Source</th>
                <th className="num">Units</th>
                <th className="num">Total cost</th>
                <th>Status</th>
                <th>Acquired</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.acquisitionId} onClick={() => setSelectedId(a.acquisitionId)}>
                  <td>
                    <button type="button" className="ad-row-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(a.acquisitionId); }}>
                      {a.invoiceNo}
                    </button>
                  </td>
                  <td>{supplierName(a.supplierId)}</td>
                  <td>{labelOf(SOURCE_TYPES, a.sourceType)}</td>
                  <td className="num">{unitCount(a)}</td>
                  <td className="num">{formatPeso(a.totalCost)}</td>
                  <td><StatusBadge list={ACQ_STATUSES} value={a.acqStatus} /></td>
                  <td>{formatDate(a.acquiredAt)}</td>
                  <td>{userName(a.recordedBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />

      {selectedId && (
        <AcquisitionDrawer
          key={selectedId}
          acquisition={selected}
          isNew={selectedId === "new"}
          acquisitions={acquisitions}
          suppliers={suppliers}
          models={models}
          admin={admin}
          userName={userName}
          onSave={onSave}
          onSplit={onSplit}
          onViewUnits={(a) => { setSelectedId(null); onViewUnits(a); }}
          onCreated={(created) => setSelectedId(created.acquisitionId)}
          onClose={() => setSelectedId(null)}
          notify={notify}
        />
      )}
    </div>
  );
}

/* ======================================================================= */

function AcquisitionDrawer({ acquisition, isNew, acquisitions, suppliers, models, admin, userName, onSave, onSplit, onViewUnits, onCreated, onClose, notify }) {
  const [saved, setSaved] = useState(() => (isNew ? blankAcquisition(admin) : clone(acquisition)));
  const [draft, setDraft] = useState(() => (isNew ? blankAcquisition(admin) : clone(acquisition)));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmSplit, setConfirmSplit] = useState(false);

  const locked = saved.acqStatus === "split"; // units already created: batch is read-only
  const total = itemsTotal(draft.acqItems);
  const dirty = JSON.stringify(normalize(draft)) !== JSON.stringify(saved);
  const set = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); };
  const setItem = (index, key, value) => {
    setDraft((d) => ({ ...d, acqItems: d.acqItems.map((it, i) => (i === index ? { ...it, [key]: value } : it)) }));
    setErrors((e) => ({ ...e, itemErrors: undefined, items: undefined }));
  };

  const handleSave = async () => {
    const found = validate(draft, acquisitions);
    setErrors(found);
    if (Object.keys(found).length) return notify("Please fix the highlighted fields.", "error");

    const next = normalize(draft);
    setBusy(true);
    try {
      const result = await onSave(next, isNew);
      if (isNew) {
        notify("Acquisition recorded.");
        onCreated(result);
      } else {
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

  const handleSplit = async () => {
    setBusy(true);
    try {
      const count = await onSplit(saved);
      const next = { ...saved, acqStatus: "split" };
      setSaved(next);
      setDraft(next);
      setConfirmSplit(false);
      notify(`${count} unit records created. Enter their serial numbers in the Units tab.`);
    } catch (error) {
      notify(error?.message || "Could not create the units.", "error");
    } finally {
      setBusy(false);
    }
  };

  const modelLabel = (id) => {
    const m = models.find((x) => x.modelId === id);
    return m ? `${m.brand} ${m.modelName}` : "";
  };

  const footer = (
    <>
      {!isNew && saved.acqStatus === "received" && (
        <button type="button" className="ad-btn ad-btn-ghost iv-footer-left" onClick={() => setConfirmSplit(true)} disabled={dirty || busy} title={dirty ? "Save your changes first" : undefined}>
          Split into units
        </button>
      )}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={onClose}>{isNew || !locked ? "Cancel" : "Close"}</button>
      {!locked && (
        <button type="button" className="ad-btn ad-btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? "Saving..." : isNew ? "Record acquisition" : "Save changes"}
        </button>
      )}
    </>
  );

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={isNew ? "New acquisition" : saved.invoiceNo}
        subtitle={isNew ? "Record stock bought from a supplier" : `Recorded by ${userName(saved.recordedBy)}`}
        badge={isNew ? null : <StatusBadge list={ACQ_STATUSES} value={saved.acqStatus} />}
        footer={footer}
      >
        {locked && (
          <div className="ad-note">
            Units were already created from this batch, so it is read-only.{" "}
            <button type="button" className="iv-inline-link" onClick={() => onViewUnits(saved)}>View its units</button>
          </div>
        )}
        {!isNew && saved.acqStatus === "ordered" && (
          <div className="ad-note is-warn">Mark this batch as Received when the stock arrives. Then you can split it into units.</div>
        )}

        <div className="ad-form-grid">
          <Field label="Supplier" htmlFor="a-supplier" error={errors.supplierId}>
            <select id="a-supplier" value={draft.supplierId} disabled={locked} aria-invalid={!!errors.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
              <option value="">Choose a supplier</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>{s.companyName}</option>
              ))}
            </select>
          </Field>

          <Field label="Source type" htmlFor="a-source" error={errors.sourceType}>
            <select id="a-source" value={draft.sourceType} disabled={locked} aria-invalid={!!errors.sourceType} onChange={(e) => set("sourceType", e.target.value)}>
              <option value="">Choose a source</option>
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Invoice number" htmlFor="a-invoice" error={errors.invoiceNo}>
            <input id="a-invoice" type="text" value={draft.invoiceNo} disabled={locked} aria-invalid={!!errors.invoiceNo} onChange={(e) => set("invoiceNo", e.target.value)} />
          </Field>

          <Field label="Status" htmlFor="a-status">
            <select id="a-status" value={draft.acqStatus} disabled={locked} onChange={(e) => set("acqStatus", e.target.value)}>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              {locked && <option value="split">Units created</option>}
            </select>
          </Field>

          <Field label="Acquired on" htmlFor="a-date" error={errors.acquiredAt}>
            <input id="a-date" type="date" value={toDateInput(draft.acquiredAt)} disabled={locked} aria-invalid={!!errors.acquiredAt}
              onChange={(e) => set("acquiredAt", fromDateInput(e.target.value))} />
          </Field>

          <Field label="Recorded by" htmlFor="a-by">
            <input id="a-by" type="text" value={userName(draft.recordedBy)} disabled readOnly />
          </Field>
        </div>

        <div className="ad-section">
          <div className="iv-section-head">
            <h3 className="ad-section-title">Items</h3>
            {!locked && (
              <button type="button" className="ad-btn ad-btn-ghost ad-btn-sm"
                onClick={() => setDraft((d) => ({ ...d, acqItems: [...d.acqItems, { modelId: "", quantity: 1, unitCost: "" }] }))}>
                <PlusIcon /> Add item
              </button>
            )}
          </div>
          {errors.items && <p className="ad-error" style={{ marginBottom: 10 }}>{errors.items}</p>}

          <div className="iv-items">
            {draft.acqItems.map((item, i) => {
              const err = errors.itemErrors?.[i] || {};
              return (
                <div key={i} className="iv-item">
                  <Field label="Laptop model" htmlFor={`a-model-${i}`} error={err.modelId} className="iv-item-model">
                    <select id={`a-model-${i}`} value={item.modelId} disabled={locked} aria-invalid={!!err.modelId} onChange={(e) => setItem(i, "modelId", e.target.value)}>
                      <option value="">Choose a model</option>
                      {models.map((m) => (
                        <option key={m.modelId} value={m.modelId}>{m.brand} {m.modelName}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Quantity" htmlFor={`a-qty-${i}`} error={err.quantity}>
                    <input id={`a-qty-${i}`} type="number" min="1" step="1" value={item.quantity ?? ""} disabled={locked} aria-invalid={!!err.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
                  </Field>
                  <Field label="Unit cost (PHP)" htmlFor={`a-cost-${i}`} error={err.unitCost}>
                    <input id={`a-cost-${i}`} type="number" min="0" value={item.unitCost ?? ""} disabled={locked} aria-invalid={!!err.unitCost} onChange={(e) => setItem(i, "unitCost", e.target.value)} />
                  </Field>
                  <div className="iv-item-total">
                    <span>{formatPeso((Number(item.quantity) || 0) * (Number(item.unitCost) || 0))}</span>
                    {!locked && draft.acqItems.length > 1 && (
                      <button type="button" className="ad-icon-btn" aria-label={`Remove ${modelLabel(item.modelId) || "item"}`}
                        onClick={() => setDraft((d) => ({ ...d, acqItems: d.acqItems.filter((_, idx) => idx !== i) }))}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <dl className="iv-totals">
            <div><dt>Units</dt><dd>{draft.acqItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</dd></div>
            <div><dt>Total cost</dt><dd>{formatPeso(total)}</dd></div>
          </dl>
        </div>
      </Drawer>

      <Modal
        open={confirmSplit}
        onClose={() => setConfirmSplit(false)}
        title="Split into units?"
        size="sm"
        footer={
          <>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setConfirmSplit(false)}>Cancel</button>
            <button type="button" className="ad-btn ad-btn-primary" onClick={handleSplit} disabled={busy}>
              {busy ? "Creating..." : `Create ${unitCount(saved)} units`}
            </button>
          </>
        }
      >
        <p>
          This creates {unitCount(saved)} unit records for {saved.invoiceNo}. Each one gets this batch, its model, a cost basis equal to the
          unit cost, and the status Awaiting inspection.
        </p>
        <p>Serial numbers are set to temporary values (TBA-...). Replace them with the real ones as you inspect each laptop.</p>
      </Modal>
    </>
  );
}
