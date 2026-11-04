import { useCallback, useEffect, useMemo, useState } from "react";
import { adminRequest } from "../../api";
import AdminDashboard from "./AdminDashboard";
import AdminLayout from "./AdminLayout";
import UnitsTab from "../components/UnitsTab";
import AcquisitionsTab from "../components/AcquisitionsTab";
import SuppliersTab from "../components/SuppliersTab";
import { formatDateTime, formatPeso } from "./AdminShared";

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
  verifStatus: "Status", schoolEmail: "School email", companyName: "Supplier", sourceType: "Source",
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
    try { setData({ ...emptyData, ...await adminRequest("/data") }); }
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
    if (page === "verifications") return <RecordsTable title={titles.verifications} collection="student_verifications" rows={data.student_verifications}
      admin={admin} query={search} refresh={refresh} />;
    if (page === "orders") return <RecordsTable title={titles.orders} collection="orders" rows={data.orders} warranties={data.warranties} admin={admin} query={search} refresh={refresh} />;
    if (page === "users" && isAdmin) return <RecordsTable title={titles.users} collection="users" rows={data.users} admin={admin} query={search} refresh={refresh} />;
    if (page === "audit" && isAdmin) return <RecordsTable title={titles.audit} collection="audit_logs" rows={data.audit_logs} admin={admin} query={search} refresh={refresh} />;
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

function RecordsTable({ title, collection, rows, warranties = [], admin, query, refresh }) {
  const [staffForm, setStaffForm] = useState(false);
  const [staff, setStaff] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [message, setMessage] = useState("");
  const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase()));
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
  const fields = collection === "student_verifications" ? ["schoolEmail", "userId", "verifStatus", "submittedAt", "remarks"]
    : collection === "orders" ? ["orderNo", "userId", "total", "orderStatus", "pickupDate", "returns"]
      : collection === "users" ? ["fullName", "email", "phone", "role", "isActive", "userCreatedAt"]
        : collection === "audit_logs" ? ["adminId", "action", "targetCollection", "targetId", "changes", "logCreatedAt"]
          : ["_kind", "brand", "modelName", "msrp", "specs", "courseCode", "courseName", "requirements"];
  return <section className="ad-panel">
    <h2 className="ad-section-title">{title}</h2>
    <div className="iv-toolbar"><strong>{filtered.length} records</strong>
      {collection === "users" && admin.role === "admin" && <button className="ad-btn ad-btn-primary" onClick={() => setStaffForm((v) => !v)}>Add staff user</button>}
      {collection === "catalog" && admin.role === "admin" && <CreateCatalogForm refresh={refresh} />}
    </div>
    {message && <p className="ad-error" role="alert">{message}</p>}
    {staffForm && <form className="ad-form-grid" onSubmit={createStaff}>
      <label>Full name<input required value={staff.fullName} onChange={(e) => setStaff({ ...staff, fullName: e.target.value })} /></label>
      <label>Email<input required type="email" value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} /></label>
      <label>Phone<input value={staff.phone} onChange={(e) => setStaff({ ...staff, phone: e.target.value })} /></label>
      <label>Temporary password<input required minLength="8" type="password" value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} /></label>
      <button className="ad-btn ad-btn-primary">Create staff account</button>
    </form>}
    <div className="ad-table-wrap"><table className="ad-table"><thead><tr>{fields.map((f) => <th key={f}>{labels[f] || f}</th>)}{collection !== "audit_logs" && <th>Actions</th>}</tr></thead>
      <tbody>{filtered.map((row) => <tr key={row.userId || row.orderId || row.verificationId || row.logId || row.courseId || row.modelId}>
        {fields.map((f) => <td key={f}>{display(f, row[f])}</td>)}
        {collection !== "audit_logs" && <td>
          {collection === "student_verifications" && row.verifStatus === "pending" && <>
            <button className="ad-btn ad-btn-primary ad-btn-sm" onClick={() => mutate(`/student_verifications/${row.verificationId}`, { method: "PATCH", body: { verifStatus: "approved" } })}>Approve</button>{" "}
            <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => mutate(`/student_verifications/${row.verificationId}`, { method: "PATCH", body: { verifStatus: "rejected" } })}>Reject</button>
          </>}
          {collection === "orders" && <OrderStatusButtons order={row} mutate={mutate} />}
          {collection === "users" && row.role !== "admin" && <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => mutate(`/users/${row.userId}/active`, { method: "PATCH", body: { isActive: !row.isActive } })}>{row.isActive ? "Deactivate" : "Activate"}</button>}
          {collection === "catalog" && admin.role === "admin" && <CatalogEdit row={row} refresh={refresh} />}
        </td>}
      </tr>)}</tbody></table></div>
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
  const [one, setOne] = useState(""); const [two, setTwo] = useState(""); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); setError(""); try {
    await adminRequest(`/${kind}`, { method: "POST", body: kind === "courses" ? { courseCode: one, courseName: two } : { brand: one, modelName: two } });
    setOne(""); setTwo(""); await refresh();
  } catch (err) { setError(err.message); } };
  return <form className="ad-inline-form" onSubmit={submit}><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="laptop_models">Laptop model</option><option value="courses">Course</option></select>
    <input required placeholder={kind === "courses" ? "Course code" : "Brand"} value={one} onChange={(e) => setOne(e.target.value)} />
    <input required placeholder={kind === "courses" ? "Course name" : "Model name"} value={two} onChange={(e) => setTwo(e.target.value)} />
    <button className="ad-btn ad-btn-primary">Add</button>{error && <span className="ad-error">{error}</span>}</form>;
}

function CatalogEdit({ row, refresh }) {
  const [editing, setEditing] = useState(false); const [one, setOne] = useState(row._kind === "courses" ? row.courseCode : row.brand); const [two, setTwo] = useState(row._kind === "courses" ? row.courseName : row.modelName);
  const save = async () => { const collection = row._kind; const id = row.courseId || row.modelId;
    await adminRequest(`/${collection}/${id}`, { method: "PATCH", body: collection === "courses" ? { courseCode: one, courseName: two } : { brand: one, modelName: two } });
    setEditing(false); await refresh();
  };
  if (!editing) return <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setEditing(true)}>Edit</button>;
  return <span><input value={one} onChange={(e) => setOne(e.target.value)} /><input value={two} onChange={(e) => setTwo(e.target.value)} /><button className="ad-btn ad-btn-primary ad-btn-sm" onClick={save}>Save</button></span>;
}
