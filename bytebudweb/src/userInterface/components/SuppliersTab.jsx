import { useMemo, useState } from "react";
import { Field, Modal, Pagination, PlusIcon, SUPPLIER_TYPES, formatDate, labelOf } from "./AdminShared";

/**
 * B2 > Suppliers tab: table + add/edit modal.
 *
 * Collections: Suppliers (companyName, supplierType, contact{contactPerson, contactEmail, contactPhone}).
 * The acquisition count is derived from Acquisitions.supplierId.
 */

const PAGE_SIZE = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const blankSupplier = () => ({
  supplierId: null,
  companyName: "",
  supplierType: "",
  contact: { contactPerson: "", contactEmail: "", contactPhone: "" },
});

export default function SuppliersTab({ suppliers, acquisitions, query, onSave, notify }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // supplier draft or null
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const map = new Map();
    acquisitions.forEach((a) => map.set(a.supplierId, (map.get(a.supplierId) || 0) + 1));
    return map;
  }, [acquisitions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => !q || `${s.companyName} ${s.contact?.contactPerson} ${s.contact?.contactEmail}`.toLowerCase().includes(q))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [suppliers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const open = (supplier) => {
    setErrors({});
    setEditing(supplier ? JSON.parse(JSON.stringify(supplier)) : blankSupplier());
  };
  const set = (key, value) => { setEditing((s) => ({ ...s, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); };
  const setContact = (key, value) => { setEditing((s) => ({ ...s, contact: { ...s.contact, [key]: value } })); setErrors((e) => ({ ...e, [key]: undefined })); };

  const handleSave = async (event) => {
    event.preventDefault();
    const found = {};
    const name = editing.companyName.trim();
    if (!name) found.companyName = "Enter the company name.";
    else if (suppliers.some((s) => s.supplierId !== editing.supplierId && s.companyName.toLowerCase() === name.toLowerCase()))
      found.companyName = "A supplier with this name already exists.";
    if (!editing.supplierType) found.supplierType = "Choose a supplier type.";
    const email = editing.contact.contactEmail.trim();
    if (email && !EMAIL_RE.test(email)) found.contactEmail = "Enter a valid email address.";
    setErrors(found);
    if (Object.keys(found).length) return;

    const next = {
      ...editing,
      companyName: name,
      contact: {
        contactPerson: editing.contact.contactPerson.trim(),
        contactEmail: email,
        contactPhone: editing.contact.contactPhone.trim(),
      },
    };
    setBusy(true);
    try {
      await onSave(next, !editing.supplierId);
      notify(editing.supplierId ? "Supplier updated." : "Supplier added.");
      setEditing(null);
    } catch (error) {
      notify(error?.message || "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="iv-panel">
      <div className="iv-toolbar">
        <p className="iv-count">{filtered.length} {filtered.length === 1 ? "supplier" : "suppliers"}</p>
        <button type="button" className="ad-btn ad-btn-primary" onClick={() => open(null)}>
          <PlusIcon /> Add supplier
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="ad-empty">
          <strong>No suppliers found</strong>
          Add the companies and people you buy stock from.
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Type</th>
                <th>Contact person</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="num">Acquisitions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.supplierId} onClick={() => open(s)}>
                  <td>
                    <button type="button" className="ad-row-btn" onClick={(e) => { e.stopPropagation(); open(s); }}>
                      {s.companyName}
                    </button>
                    <span className="ad-cell-sub">Added {formatDate(s.supplierCreatedAt)}</span>
                  </td>
                  <td>{labelOf(SUPPLIER_TYPES, s.supplierType)}</td>
                  <td>{s.contact?.contactPerson || "-"}</td>
                  <td>{s.contact?.contactEmail || "-"}</td>
                  <td>{s.contact?.contactPhone || "-"}</td>
                  <td className="num">{counts.get(s.supplierId) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.supplierId ? "Edit supplier" : "Add supplier"}
        footer={
          <>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="supplier-form" className="ad-btn ad-btn-primary" disabled={busy}>
              {busy ? "Saving..." : editing?.supplierId ? "Save changes" : "Add supplier"}
            </button>
          </>
        }
      >
        {editing && (
          <form id="supplier-form" className="ad-form-grid" onSubmit={handleSave} noValidate>
            <Field label="Company name" htmlFor="s-name" className="span-2" error={errors.companyName}>
              <input id="s-name" type="text" value={editing.companyName} aria-invalid={!!errors.companyName} onChange={(e) => set("companyName", e.target.value)} />
            </Field>
            <Field label="Supplier type" htmlFor="s-type" className="span-2" error={errors.supplierType}>
              <select id="s-type" value={editing.supplierType} aria-invalid={!!errors.supplierType} onChange={(e) => set("supplierType", e.target.value)}>
                <option value="">Choose a type</option>
                {SUPPLIER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact person" htmlFor="s-person" className="span-2">
              <input id="s-person" type="text" value={editing.contact.contactPerson} onChange={(e) => setContact("contactPerson", e.target.value)} />
            </Field>
            <Field label="Contact email" htmlFor="s-email" error={errors.contactEmail}>
              <input id="s-email" type="email" value={editing.contact.contactEmail} aria-invalid={!!errors.contactEmail} onChange={(e) => setContact("contactEmail", e.target.value)} />
            </Field>
            <Field label="Contact phone" htmlFor="s-phone">
              <input id="s-phone" type="text" value={editing.contact.contactPhone} onChange={(e) => setContact("contactPhone", e.target.value)} />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
