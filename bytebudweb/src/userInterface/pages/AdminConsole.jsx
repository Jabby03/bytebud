import { useCallback, useEffect, useMemo, useState } from "react";
import { adminRequest } from "../../api";
import AdminDashboard from "./AdminDashboard";
import AdminLayout from "./AdminLayout";
import UnitsTab from "../components/UnitsTab";
import AcquisitionsTab from "../components/AcquisitionsTab";
import SuppliersTab from "../components/SuppliersTab";
import { Drawer, formatDateTime, formatPeso } from "./AdminShared";

const emptyData = {
  units: [], acquisitions: [], suppliers: [], orders: [], student_verifications: [],
  warranties: [], laptop_models: [], courses: [], users: [], audit_logs: [],
};
const pageFromPath = (path) => path.split("/").filter(Boolean)[1] || "dashboard";
const titles = {
  orders: "Orders & Returns", verifications: "Student verifications", catalog: "Catalog",
  users: "Users", audit: "Audit log",
};
const labels = {
  orderNo: "Order", fullName: "Name", email: "Email", phone: "Phone", role: "Role", isActive: "Active",
  verifStatus: "Status", schoolEmail: "School email", expiresAt: "Expires", companyName: "Supplier", sourceType: "Source",
  invoiceNo: "Invoice", totalCost: "Total cost", acqStatus: "Status", serialNumber: "Serial number",
  unitStatus: "Status", conditionGrade: "Grade", brand: "Brand", modelName: "Model", courseCode: "Code",
  courseName: "Course", action: "Action", targetCollection: "Collection", targetId: "Record", logCreatedAt: "When",
};
const display = (key, value) => {
  if (value == null || value === "") return "—";
  if (["total", "totalCost", "refundAmount", "priceAtSale"].includes(key)) return formatPeso(value);
  if (key.toLowerCase().includes("at") || key.endsWith("Date")) return formatDateTime(value);
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

export default function AdminConsole({ admin, pathname, onNavigate, onLogout }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [inventoryTab, setInventoryTab] = useState("units");
  const page = pageFromPath(pathname);
  const isAdmin = admin.role === "admin";
  const routeParams = new URLSearchParams(window.location.search);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = { ...emptyData, ...await adminRequest("/data") };
      loaded.units = loaded.units.map((unit) => unit.unitStatus === "ready_to_list" ? { ...unit, unitStatus: "ready" } : unit);
      setData(loaded);
    }
    catch (e) { setError(e.message || "Could not load admin data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async (collection, record, idField) => {
    const isNew = !record[idField];
    const result = await adminRequest(`/${collection}${isNew ? "" : `/${record[idField]}`}`, {
      method: isNew ? "POST" : "PATCH", body: record,
    });
    await refresh();
    return result;
  };

  const badgeCount = useMemo(() => data.student_verifications.filter((v) => v.verifStatus === "pending").length, [data.student_verifications]);
  const handleNavigate = (href) => onNavigate(href);
  const handleSaveUnit = (unit) => save("units", unit, "unitId");
  const handleCreateUnit = (unit) => save("units", unit, "unitId");
  const handleSaveAcquisition = (record) => save("acquisitions", record, "acquisitionId");
  const handleSplit = async (acquisitionId) => {
    const id = typeof acquisitionId === "object" ? acquisitionId.acquisitionId : acquisitionId;
    const result = await adminRequest(`/acquisitions/${id}/split`, { method: "POST", body: {} });
    await refresh();
    return result.units?.length || 0;
  };
  const handleSaveSupplier = (record) => save("suppliers", record, "supplierId");

  if (page === "dashboard") {
    return <AdminDashboard admin={admin} users={data.users} verifications={data.student_verifications}
      units={data.units} orders={data.orders} warranties={data.warranties} auditLogs={data.audit_logs}
      onNavigate={handleNavigate} onLogout={onLogout} loading={loading} error={error} onRetry={refresh} />;
  }

  const active = page === "inventory" ? "inventory" : page;
  const content = () => {
    if (loading) return <div className="ad-empty"><strong>Loading admin data…</strong></div>;
    if (error) return <div className="ad-note is-warn" role="alert">{error} <button className="ad-btn ad-btn-ghost" onClick={refresh}>Retry</button></div>;
    if (page === "inventory") return (
      <>
        <div className="ad-tabs" role="tablist" aria-label="Inventory sections">
          {["units", ...(isAdmin ? ["acquisitions", "suppliers"] : [])].map((tab) => (
            <button type="button" role="tab" aria-selected={inventoryTab === tab} className={`ad-tab ${inventoryTab === tab ? "is-active" : ""}`} key={tab} onClick={() => setInventoryTab(tab)}>
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {inventoryTab === "units" && <UnitsTab units={data.units} models={data.laptop_models} acquisitions={data.acquisitions}
          users={data.users} admin={admin} isAdmin={isAdmin} query={search} initialStatus={routeParams.get("status") || ""}
          acquisitionFilter={routeParams.get("acquisition") || ""} onClearAcquisitionFilter={() => onNavigate("/admin/inventory")}
          onSave={handleSaveUnit} onCreate={handleCreateUnit}
          notify={(message, type) => type === "error" && setError(message)} />}
        {isAdmin && inventoryTab === "acquisitions" && <AcquisitionsTab acquisitions={data.acquisitions} suppliers={data.suppliers}
          models={data.laptop_models} users={data.users} admin={admin} query={search} onSave={handleSaveAcquisition}
          onSplit={handleSplit} onViewUnits={(id) => onNavigate(`/admin/inventory?acquisition=${id}`)} notify={(message, type) => type === "error" && setError(message)} />}
        {isAdmin && inventoryTab === "suppliers" && <SuppliersTab suppliers={data.suppliers} acquisitions={data.acquisitions} query={search}
          onSave={handleSaveSupplier} notify={(message, type) => type === "error" && setError(message)} />}
      </>
    );
    if (page === "verifications") return <RecordsTable title={titles.verifications} collection="student_verifications" rows={data.student_verifications} users={data.users}
      admin={admin} query={search} refresh={refresh} />;
    if (page === "orders") return <RecordsTable title={titles.orders} collection="orders" rows={data.orders} warranties={data.warranties} users={data.users} units={data.units} admin={admin} query={search} refresh={refresh} />;
    if (page === "users" && isAdmin) return <RecordsTable title={titles.users} collection="users" rows={data.users} admin={admin} query={search} refresh={refresh} />;
    if (page === "audit" && isAdmin) return <RecordsTable title={titles.audit} collection="audit_logs" rows={data.audit_logs} users={data.users} admin={admin} query={search} refresh={refresh} />;
    if (page === "catalog") return <RecordsTable title={titles.catalog} collection="catalog" rows={[...data.laptop_models.map((x) => ({ ...x, _kind: "laptop_models" })), ...data.courses.map((x) => ({ ...x, _kind: "courses" }))]} admin={admin} query={search} refresh={refresh} />;
    return <div className="ad-empty"><strong>Page not found</strong><button className="ad-btn ad-btn-primary" onClick={() => onNavigate("/admin")}>Back to dashboard</button></div>;
  };

  const restricted = (["users", "audit"].includes(page) && !isAdmin) || !["inventory", "orders", "verifications", "catalog", "users", "audit"].includes(page);
  return <AdminLayout active={restricted ? "dashboard" : active} admin={admin} badges={{ verifications: badgeCount }}
    searchValue={search} onSearchChange={setSearch} onSearchSubmit={setSearch} onNavigate={onNavigate} onLogout={onLogout}>
    <div className="db-head"><div><h1>{restricted ? "Access denied" : page === "inventory" ? "Inventory" : titles[page]}</h1>
      <p>{restricted ? "This section is only available to administrators." : `Manage ByteBud ${page === "audit" ? "activity history" : page.replace("_", " ")}.`}</p></div></div>
    {restricted ? <div className="ad-empty"><strong>Admin role required</strong>Ask an administrator if you need access to this section.</div> : content()}
  </AdminLayout>;
}

function RecordsTable({ title, collection, rows, warranties = [], users = [], units = [], admin, query, refresh }) {
  const [staffForm, setStaffForm] = useState(false);
  const [staff, setStaff] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [auditFilter, setAuditFilter] = useState({ actor: "", action: "", collection: "", from: "", to: "" });
  const filtered = rows.filter((row) => {
    if (!JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (collection !== "audit_logs") return true;
    const d = new Date(row.logCreatedAt);
    return (!auditFilter.actor || String(row.adminId) === auditFilter.actor)
      && (!auditFilter.action || row.action === auditFilter.action)
      && (!auditFilter.collection || row.targetCollection === auditFilter.collection)
      && (!auditFilter.from || d >= new Date(`${auditFilter.from}T00:00:00`))
      && (!auditFilter.to || d <= new Date(`${auditFilter.to}T23:59:59`));
  });
  if (collection === "student_verifications") filtered.sort((a, b) => Number(b.verifStatus === "pending") - Number(a.verifStatus === "pending") || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  const mutate = async (path, options) => {
    setMessage("");
    try { await adminRequest(path, options); await refresh(); return true; }
    catch (error) { setMessage(error.message); return false; }
  };
  const createStaff = async (event) => {
    event.preventDefault();
    if (await mutate("/users", { method: "POST", body: staff })) {
      setStaffForm(false); setStaff({ fullName: "", email: "", phone: "", password: "" });
    }
  };
  const fields = collection === "student_verifications" ? ["fullName", "schoolEmail", "verifStatus", "submittedAt", "expiresAt"]
    : collection === "orders" ? ["orderNo", "fullName", "total", "orderStatus", "pickupDate"]
      : collection === "users" ? ["fullName", "email", "phone", "role", "isActive", "userCreatedAt"]
        : collection === "audit_logs" ? ["fullName", "action", "targetCollection", "targetId", "logCreatedAt"]
          : ["_kind", "brand", "modelName", "msrp", "specs", "courseCode", "courseName", "requirements"];
  return <section className="ad-panel">
    <h2 className="ad-section-title">{title}</h2>
    <div className="iv-toolbar"><strong>{filtered.length} records</strong>
      {collection === "users" && admin.role === "admin" && <button className="ad-btn ad-btn-primary" onClick={() => setStaffForm((v) => !v)}>Add staff user</button>}
      {collection === "catalog" && admin.role === "admin" && <CreateCatalogForm refresh={refresh} />}
    </div>
    {collection === "audit_logs" && <div className="ad-inline-form ad-audit-filters">
      <select aria-label="Filter by actor" value={auditFilter.actor} onChange={(e) => setAuditFilter({ ...auditFilter, actor: e.target.value })}><option value="">All staff/admins</option>{users.filter((u) => ["admin", "staff"].includes(u.role)).map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}</select>
      <select aria-label="Filter by action" value={auditFilter.action} onChange={(e) => setAuditFilter({ ...auditFilter, action: e.target.value })}><option value="">All actions</option>{["create", "update", "delete"].map((a) => <option key={a}>{a}</option>)}</select>
      <select aria-label="Filter by collection" value={auditFilter.collection} onChange={(e) => setAuditFilter({ ...auditFilter, collection: e.target.value })}><option value="">All collections</option>{[...new Set(rows.map((r) => r.targetCollection))].filter(Boolean).map((c) => <option key={c}>{c}</option>)}</select>
      <label>From <input type="date" value={auditFilter.from} onChange={(e) => setAuditFilter({ ...auditFilter, from: e.target.value })} /></label><label>To <input type="date" value={auditFilter.to} onChange={(e) => setAuditFilter({ ...auditFilter, to: e.target.value })} /></label>
    </div>}
    {message && <p className="ad-error" role="alert">{message}</p>}
    {staffForm && <form className="ad-form-grid" onSubmit={createStaff}>
      <label>Full name<input required value={staff.fullName} onChange={(e) => setStaff({ ...staff, fullName: e.target.value })} /></label>
      <label>Email<input required type="email" value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} /></label>
      <label>Phone<input value={staff.phone} onChange={(e) => setStaff({ ...staff, phone: e.target.value })} /></label>
      <label>Temporary password<input required minLength="8" type="password" value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} /></label>
      <button className="ad-btn ad-btn-primary">Create staff account</button>
    </form>}
    <div className="ad-table-wrap"><table className="ad-table"><thead><tr>{fields.map((f) => <th key={f}>{labels[f] || f}</th>)}{collection !== "audit_logs" && <th>Actions</th>}</tr></thead>
      <tbody>{filtered.map((row) => {
        const user = users.find((u) => u.userId === row.userId || u.userId === row.adminId);
        const view = { ...row, fullName: user?.fullName || "—" };
        return <tr key={row.userId || row.orderId || row.verificationId || row.logId || row.courseId || row.modelId} onClick={() => { if (["orders", "audit_logs"].includes(collection)) setSelected(row); else if (collection === "student_verifications") { setExpiresAt(""); setSelected(row); } }}>
        {fields.map((f) => <td key={f}>{display(f, f === "adminId" && collection === "audit_logs" ? view.fullName : f === "userId" && collection === "student_verifications" ? view.fullName : view[f])}</td>)}
        {collection !== "audit_logs" && <td>
          {collection === "student_verifications" && row.verifStatus === "pending" && <>
            <button className="ad-btn ad-btn-primary ad-btn-sm" onClick={(e) => { e.stopPropagation(); setExpiresAt(""); setSelected(row); }}>Review</button>
          </>}
          {collection === "orders" && <OrderStatusButtons order={row} mutate={mutate} />}
          {collection === "users" && row.role !== "admin" && <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => mutate(`/users/${row.userId}/active`, { method: "PATCH", body: { isActive: !row.isActive } })}>{row.isActive ? "Deactivate" : "Activate"}</button>}
          {collection === "catalog" && admin.role === "admin" && <CatalogEdit row={row} refresh={refresh} />}
        </td>}
      </tr>})}</tbody></table></div>
    {!filtered.length && <div className="ad-empty"><strong>No records</strong></div>}
    {collection === "orders" && <>
      <h2 className="ad-section-title">Return requests</h2>
      <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Order</th><th>Unit</th><th>Reason</th><th>Status</th><th>Requested</th>{admin.role === "admin" && <th>Review</th>}</tr></thead>
        <tbody>{rows.flatMap((order) => (order.returns || []).map((item, index) => <tr key={`${order.orderId}-${index}`}>
          <td>{order.orderNo}</td><td>{item.returnUnitId}</td><td>{item.reason || "—"}</td><td>{item.returnStatus || "pending"}</td><td>{display("requestedAt", item.requestedAt)}</td>
          {admin.role === "admin" && <td>{["pending", "requested", "filed"].includes(item.returnStatus) ? <>
            <button className="ad-btn ad-btn-primary ad-btn-sm" onClick={() => { const raw = window.prompt("Refund amount (PHP):", "0"); if (raw === null) return; const amount = Number(raw); if (Number.isFinite(amount) && amount >= 0) mutate(`/orders/${order.orderId}/returns/${index}`, { method: "PATCH", body: { returnStatus: "approved", refundAmount: amount } }); }}>Approve</button>{" "}
            <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => mutate(`/orders/${order.orderId}/returns/${index}`, { method: "PATCH", body: { returnStatus: "rejected", refundAmount: 0 } })}>Reject</button>
          </> : formatPeso(item.refundAmount)}</td>}
        </tr>))}</tbody></table></div>
      <h2 className="ad-section-title">Warranty claims</h2>
      <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Claim</th><th>Type</th><th>Description</th><th>Status</th><th>Filed</th><th>Update</th></tr></thead>
        <tbody>{warranties.flatMap((warranty) => (warranty.claims || []).map((claim, index) => <tr key={`${warranty.warrantyId}-${index}`}>
          <td>{claim.claimNo || warranty.warrantyId}</td><td>{claim.claimType || "—"}</td><td>{claim.description || "—"}</td><td>{claim.claimStatus || "—"}</td><td>{display("filedAt", claim.filedAt)}</td>
          <td><select value={claim.claimStatus} onChange={(e) => mutate(`/warranties/${warranty.warrantyId}/claims/${index}`, { method: "PATCH", body: { claimStatus: e.target.value, resolution: claim.resolution } })}>
            {["filed", "in_review", "approved", "rejected", "resolved"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select></td>
        </tr>))}</tbody></table></div>
    </>}
    {selected && collection === "student_verifications" && <Drawer open onClose={() => setSelected(null)} title="Student verification" subtitle={users.find((u) => u.userId === selected.userId)?.fullName || selected.userId}>
      <section className="ad-section"><h3 className="ad-section-title">Submission</h3><p><b>School email:</b> {selected.schoolEmail}</p><p><b>Status:</b> {selected.verifStatus}</p><p><b>Submitted:</b> {display("submittedAt", selected.submittedAt)}</p>
        {selected.proofUrl ? <><a href={selected.proofUrl} target="_blank" rel="noreferrer">Open submitted proof</a>{/\.(png|jpe?g|gif|webp)(\?|$)/i.test(selected.proofUrl) ? <img src={selected.proofUrl} alt="Verification proof" style={{ display: "block", maxWidth: "100%", marginTop: 12 }} /> : <iframe title="Verification proof" src={selected.proofUrl} style={{ width: "100%", height: 420, marginTop: 12 }} />}</> : <p>No proof URL attached.</p>}
        <p><b>Remarks:</b> {selected.remarks || "—"}</p>
      </section>
      {selected.verifStatus === "pending" && <section className="ad-section"><label>Approval expires on<input required type="date" min={new Date().toISOString().slice(0, 10)} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label><div className="ad-inline-form">
        <button disabled={!expiresAt} className="ad-btn ad-btn-primary" onClick={async () => { const ok = await mutate(`/student_verifications/${selected.verificationId}`, { method: "PATCH", body: { verifStatus: "approved", expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null, remarks: selected.remarks || "" } }); if (ok) setSelected(null); }}>Approve</button>
        <button className="ad-btn ad-btn-ghost" onClick={async () => { const remarks = window.prompt("Reason for rejection:", selected.remarks || ""); if (remarks === null) return; const ok = await mutate(`/student_verifications/${selected.verificationId}`, { method: "PATCH", body: { verifStatus: "rejected", remarks } }); if (ok) setSelected(null); }}>Reject</button>
      </div></section>}
    </Drawer>}
    {selected && collection === "orders" && <Drawer open onClose={() => setSelected(null)} title={`Order ${selected.orderNo}`} subtitle={`Placed ${display("orderCreatedAt", selected.orderCreatedAt)}`}>
      {(() => { const customer = users.find((u) => u.userId === selected.userId); return <>
        <section className="ad-section"><h3 className="ad-section-title">Customer</h3><p>{customer?.fullName || selected.userId}</p><p>{customer?.email || ""}{customer?.phone ? ` · ${customer.phone}` : ""}</p></section>
        <section className="ad-section"><h3 className="ad-section-title">Order details</h3><p><b>Status:</b> {selected.orderStatus}</p><p><b>Pickup:</b> {display("pickupDate", selected.pickupDate)}</p><p><b>Picked up:</b> {display("pickedUpAt", selected.pickedUpAt)}</p><p><b>Subtotal:</b> {formatPeso(selected.subtotal)} · <b>Discount:</b> {formatPeso(selected.discountTotal)} · <b>Total:</b> {formatPeso(selected.total)}</p><p><b>Payment:</b> {selected.payment?.method || "—"} / {selected.payment?.payStatus || "—"}{selected.payment?.reference ? ` · ${selected.payment.reference}` : ""}</p><p><b>Verification:</b> {selected.verificationId || "None"}</p></section>
        <section className="ad-section"><h3 className="ad-section-title">Items</h3>{(selected.orderItems || []).map((item, i) => { const unit = units.find((u) => u.unitId === item.unitId); return <article className="ad-card" key={item.unitId || i}><b>{item.snapshot?.snapBrand} {item.snapshot?.snapModelName}</b><p>Serial: {item.snapshot?.snapSerialNumber || unit?.serialNumber || "—"}</p><p>Sale price: {formatPeso(item.priceAtSale)} · Return deadline: {display("returnDeadline", item.returnDeadline)}</p></article>; })}</section>
        <section className="ad-section"><h3 className="ad-section-title">Status history</h3>{(selected.statusHistory || []).map((h, i) => <p key={i}>{h.newStatus} · {display("changedAt", h.changedAt)}</p>)}</section>
      </>; })()}
    </Drawer>}
    {selected && collection === "audit_logs" && <Drawer open onClose={() => setSelected(null)} title={`${selected.action} ${selected.targetCollection}`} subtitle={`${users.find((u) => u.userId === selected.adminId)?.fullName || "Staff"} · ${display("logCreatedAt", selected.logCreatedAt)}`}>
      <section className="ad-section"><h3 className="ad-section-title">Record</h3><p><b>Collection:</b> {selected.targetCollection}</p><p><b>Target ID:</b> {selected.targetId || "—"}</p></section>
      <section className="ad-section"><h3 className="ad-section-title">Before</h3><pre className="ad-json">{JSON.stringify(selected.changes?.before ?? null, null, 2)}</pre></section>
      <section className="ad-section"><h3 className="ad-section-title">After</h3><pre className="ad-json">{JSON.stringify(selected.changes?.after ?? null, null, 2)}</pre></section>
    </Drawer>}
  </section>;
}

function OrderStatusButtons({ order, mutate }) {
  const available = {
    pending: [["confirmed", "Confirm"], ["cancelled", "Cancel"]],
    confirmed: [["ready_for_pickup", "Ready for pickup"], ["cancelled", "Cancel"]],
    ready_for_pickup: [["picked_up", "Picked up"], ["cancelled", "Cancel"]],
  }[order.orderStatus] || [];
  return available.map(([status, label]) => <button key={status} className={`ad-btn ${status === "cancelled" ? "ad-btn-ghost" : "ad-btn-primary"} ad-btn-sm`}
    onClick={() => mutate(`/orders/${order.orderId}`, { method: "PATCH", body: { orderStatus: status } })}>{label}</button>);
}

function CreateCatalogForm({ refresh }) {
  const [kind, setKind] = useState("laptop_models");
  const [draft, setDraft] = useState({ brand: "", modelName: "", msrp: "", specs: {}, courseCode: "", courseName: "", requirements: {} }); const [error, setError] = useState("");
  const setValue = (group, key, value) => setDraft((d) => group ? { ...d, [group]: { ...d[group], [key]: value } } : { ...d, [key]: value });
  const submit = async (e) => { e.preventDefault(); setError(""); try {
    const body = kind === "courses" ? { courseCode: draft.courseCode, courseName: draft.courseName, requirements: draft.requirements } : { brand: draft.brand, modelName: draft.modelName, msrp: Number(draft.msrp || 0), specs: Object.fromEntries(Object.entries(draft.specs).map(([k,v]) => [k, v === "" ? null : v])) };
    await adminRequest(`/${kind}`, { method: "POST", body });
    setDraft({ brand: "", modelName: "", msrp: "", specs: {}, courseCode: "", courseName: "", requirements: {} }); await refresh();
  } catch (err) { setError(err.message); } };
  return <details className="ad-catalog-form"><summary className="ad-btn ad-btn-primary">Add catalog item</summary><form className="ad-form-grid" onSubmit={submit}><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="laptop_models">Laptop model</option><option value="courses">Course</option></select>
    {kind === "courses" ? <><CatalogFields group="" fields={COURSE_BASE_FIELDS} draft={draft} setValue={setValue} /><CatalogFields group="requirements" fields={COURSE_REQ_FIELDS} draft={draft} setValue={setValue} /></> : <><CatalogFields group="" fields={MODEL_BASE_FIELDS} draft={draft} setValue={setValue} /><CatalogFields group="specs" fields={MODEL_SPEC_FIELDS} draft={draft} setValue={setValue} /></>}
    <button className="ad-btn ad-btn-primary">Create</button>{error && <span className="ad-error">{error}</span>}</form></details>;
}

function CatalogEdit({ row, refresh }) {
  const [editing, setEditing] = useState(false); const [error, setError] = useState(""); const [draft, setDraft] = useState(() => ({ ...row, specs: { ...(row.specs || {}) }, requirements: { ...(row.requirements || {}) } }));
  const setValue = (group, key, value) => setDraft((d) => group ? { ...d, [group]: { ...d[group], [key]: value } } : { ...d, [key]: value });
  const save = async (e) => { e.preventDefault(); const collection = row._kind; const id = row.courseId || row.modelId;
    try { const body = collection === "courses" ? { courseCode: draft.courseCode, courseName: draft.courseName, requirements: draft.requirements } : { brand: draft.brand, modelName: draft.modelName, msrp: Number(draft.msrp || 0), specs: draft.specs };
    await adminRequest(`/${collection}/${id}`, { method: "PATCH", body });
    setEditing(false); await refresh();
    } catch (e2) { setError(e2.message); }
  };
  if (!editing) return <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setEditing(true)}>Edit</button>;
  return <details open className="ad-catalog-form"><summary>Edit details</summary><form className="ad-form-grid" onSubmit={save}>{row._kind === "courses" ? <><CatalogFields group="" fields={COURSE_BASE_FIELDS} draft={draft} setValue={setValue} /><CatalogFields group="requirements" fields={COURSE_REQ_FIELDS} draft={draft} setValue={setValue} /></> : <><CatalogFields group="" fields={MODEL_BASE_FIELDS} draft={draft} setValue={setValue} /><CatalogFields group="specs" fields={MODEL_SPEC_FIELDS} draft={draft} setValue={setValue} /></>}<button className="ad-btn ad-btn-primary ad-btn-sm">Save</button><button type="button" className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setEditing(false)}>Cancel</button>{error && <span className="ad-error">{error}</span>}</form></details>;
}

const MODEL_BASE_FIELDS = [["brand", "Brand", "text"], ["modelName", "Model name", "text"], ["msrp", "MSRP", "number"]];
const MODEL_SPEC_FIELDS = [["cpuName", "CPU name", "text"], ["cpuTier", "CPU tier", "number"], ["ramGb", "RAM (GB)", "number"], ["storageGb", "Storage (GB)", "number"], ["storageType", "Storage type", "text"], ["gpu", "GPU", "text"], ["hasDedicatedGpu", "Dedicated GPU", "text"], ["screenSizeIn", "Screen size (in)", "number"], ["weightKg", "Weight (kg)", "number"], ["os", "Operating system", "text"], ["designBatteryHrs", "Designed battery hours", "number"]];
const COURSE_BASE_FIELDS = [["courseCode", "Course code", "text"], ["courseName", "Course name", "text"]];
const COURSE_REQ_FIELDS = [["minRamGb", "Minimum RAM (GB)", "number"], ["minStorageGb", "Minimum storage (GB)", "number"], ["minCpuTier", "Minimum CPU tier", "number"], ["gpuRequired", "GPU required", "boolean"], ["minBatteryHours", "Minimum battery hours", "number"], ["reqNotes", "Requirement notes", "text"]];
function CatalogFields({ group, fields, draft, setValue }) { return fields.map(([key, label, type]) => <label key={key}>{label}{type === "boolean" ? <input type="checkbox" checked={Boolean((group ? draft[group] : draft)[key])} onChange={(e) => setValue(group, key, e.target.checked)} /> : <input required={!group && ["brand", "modelName", "courseCode", "courseName"].includes(key)} type={type} min={type === "number" ? "0" : undefined} value={(group ? draft[group] : draft)[key] ?? ""} onChange={(e) => setValue(group, key, type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />}</label>); }
