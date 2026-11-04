import { useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { UNIT_STATUSES, formatPeso, timeAgo } from "./AdminShared";
import "./AdminDashboard.css";

/**
 * ByteBud admin: B1. Dashboard (/admin)
 *
 * <AdminDashboard
 *   admin={{ fullName, role }}
 *   users={[...]}            // Users (to show the admin's name on activity)
 *   verifications={[...]}    // Student_Verifications
 *   units={[...]}            // Units (with costBasis and repairs[])
 *   orders={[...]}           // Orders (with orderItems[])
 *   warranties={[...]}       // Warranties (with claims[])
 *   auditLogs={[...]}        // Audit_Logs
 *   onNavigate={(href) => navigate(href)}
 * />
 *
 * Counts and charts are computed from the live admin API data passed by AdminConsole.
 */

// Assumed enum values for the current model.
const TO_PREPARE = ["pending", "confirmed"]; // Orders.orderStatus counted as "to prepare"
const OPEN_CLAIM = ["filed", "in_review"]; // warranty claims.claimStatus counted as open
const STOCK_STATUSES = UNIT_STATUSES.filter((s) => s.value !== "sold"); // sold units are not stock

const COLLECTION_LABEL = {
  units: "a unit",
  orders: "an order",
  suppliers: "a supplier",
  acquisitions: "an acquisition",
  warranties: "a warranty",
  student_verifications: "a verification",
  users: "a user",
  courses: "a course",
  laptop_models: "a laptop model",
};
const ACTION_VERB = { create: "created", update: "updated", delete: "deleted" };

const unitCost = (u) =>
  (u.costBasis || 0) + (u.repairs || []).reduce((sum, r) => sum + (r.partCost || 0) + (r.laborCost || 0), 0);

const sameMonth = (iso, y, m) => {
  const d = new Date(iso);
  return d.getFullYear() === y && d.getMonth() === m;
};

const s = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const TaskIcon = ({ name }) => {
  const paths = {
    verify: <><circle cx="12" cy="9" r="4" {...s} /><path d="M5 20c.8-3.5 3.5-5.5 7-5.5 1.3 0 2.5.3 3.5.8M16 17.5l2 2 3.5-4" {...s} /></>,
    inspect: <><rect x="4" y="4" width="16" height="16" rx="3" {...s} /><path d="M8.5 12.3l2.5 2.5 4.5-5" {...s} /></>,
    repair: <path d="M14.5 6.5a4 4 0 0 0-5 5L4.5 16.5a1.8 1.8 0 0 0 2.5 2.5l5-5a4 4 0 0 0 5-5l-2.5 2.5-2-.5-.5-2 2.5-2.5Z" {...s} />,
    order: <><path d="M5 8h14l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5L5 8Z" {...s} /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" {...s} /></>,
    claim: <path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V5.8L12 3ZM12 8.5v4M12 15.5v.01" {...s} />,
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

export default function AdminDashboard({
  admin,
  users = [],
  verifications = [],
  units = [],
  orders = [],
  warranties = [],
  auditLogs = [],
  onNavigate,
  onLogout,
  loading = false,
  error = "",
  onRetry,
}) {
  const [search, setSearch] = useState("");

  const data = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const live = orders.filter((o) => o.orderStatus !== "cancelled");
    const unitById = new Map(units.map((u) => [u.unitId, u]));

    /* Task cards */
    const pendingVerifications = verifications.filter((v) => v.verifStatus === "pending").length;
    const awaitingInspection = units.filter((u) => u.unitStatus === "awaiting_inspection").length;
    const inRepair = units.filter((u) => u.unitStatus === "in_repair").length;
    const toPrepare = orders.filter((o) => TO_PREPARE.includes(o.orderStatus)).length;
    const openClaims = warranties.flatMap((w) => w.claims || []).filter((c) => OPEN_CLAIM.includes(c.claimStatus)).length;

    /* Sales this month (Orders.total by orderCreatedAt) */
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daily = Array(daysInMonth).fill(0);
    let salesThisMonth = 0;
    let ordersThisMonth = 0;
    let salesLastMonth = 0;
    const last = new Date(y, m - 1, 1);
    for (const o of live) {
      if (sameMonth(o.orderCreatedAt, y, m)) {
        salesThisMonth += o.total || 0;
        ordersThisMonth += 1;
        daily[new Date(o.orderCreatedAt).getDate() - 1] += o.total || 0;
      } else if (sameMonth(o.orderCreatedAt, last.getFullYear(), last.getMonth())) {
        salesLastMonth += o.total || 0;
      }
    }

    /* Stock by status (Units grouped by unitStatus, sold excluded) */
    const stock = STOCK_STATUSES.map((st) => ({ ...st, count: units.filter((u) => u.unitStatus === st.value).length }));
    const stockTotal = stock.reduce((sum, s2) => sum + s2.count, 0);

    /* Cost vs. sales, last 6 months: net sales (priceAtSale - discountAmount) vs unit cost (costBasis + repairs) */
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - (5 - i), 1);
      return { y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString("en", { month: "short" }), sales: 0, cost: 0 };
    });
    for (const o of live) {
      const bucket = months.find((b) => sameMonth(o.orderCreatedAt, b.y, b.m));
      if (!bucket) continue;
      for (const item of o.orderItems || []) {
        bucket.sales += (item.priceAtSale || 0) - (item.discountAmount || 0);
        const u = unitById.get(item.unitId);
        if (u) bucket.cost += unitCost(u);
      }
    }
    const totalSales = months.reduce((sum, b) => sum + b.sales, 0);
    const totalCost = months.reduce((sum, b) => sum + b.cost, 0);

    return {
      pendingVerifications, awaitingInspection, inRepair, toPrepare, openClaims,
      daily, daysInMonth, today: now.getDate(), salesThisMonth, ordersThisMonth, salesLastMonth,
      stock, stockTotal, months, totalSales, totalCost,
    };
  }, [verifications, units, orders, warranties]);

  const nameOf = (id) => users.find((u) => u.userId === id)?.fullName || "An admin";
  const recent = useMemo(
    () => [...auditLogs].sort((a, b) => new Date(b.logCreatedAt) - new Date(a.logCreatedAt)).slice(0, 8),
    [auditLogs]
  );

  const go = (event, href) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(href);
    }
  };

  const tasks = [
    { key: "verify", label: "Pending verifications", hint: "Student requests to review", count: data.pendingVerifications, href: "/admin/verifications" },
    { key: "inspect", label: "Awaiting inspection", hint: "Units to inspect", count: data.awaitingInspection, href: "/admin/inventory?status=awaiting_inspection" },
    { key: "repair", label: "In repair", hint: "Units being repaired", count: data.inRepair, href: "/admin/inventory?status=in_repair" },
    { key: "order", label: "Orders to prepare", hint: "Pending or confirmed", count: data.toPrepare, href: "/admin/orders" },
    { key: "claim", label: "Open warranty claims", hint: "Filed or in review", count: data.openClaims, href: "/admin/orders?tab=claims" },
  ];

  const delta = data.salesLastMonth > 0 ? ((data.salesThisMonth - data.salesLastMonth) / data.salesLastMonth) * 100 : null;
  const maxDaily = Math.max(...data.daily, 1);
  const maxMonth = Math.max(...data.months.flatMap((b) => [b.sales, b.cost]), 1);
  const profit = data.totalSales - data.totalCost;
  const margin = data.totalSales > 0 ? (profit / data.totalSales) * 100 : 0;
  const monthName = new Date().toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <AdminLayout
      active="dashboard"
      admin={admin}
      badges={{ verifications: data.pendingVerifications }}
      searchValue={search}
      onSearchChange={setSearch}
      onSearchSubmit={(q) => q.trim() && onNavigate?.(`/admin/inventory?search=${encodeURIComponent(q.trim())}`)}
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="db-head">
        <div>
          <h1>Dashboard</h1>
          <p>What needs your attention today, and how the shop is doing.</p>
        </div>
      </div>
      {loading && <p className="ad-hint">Loading current admin data…</p>}
      {error && <div className="ad-note is-warn" role="alert">{error} <button type="button" className="ad-btn ad-btn-ghost" onClick={onRetry}>Retry</button></div>}

      {/* ---------- Task cards ---------- */}
      <section className="db-tasks" aria-label="Tasks">
        {tasks.map((t) => (
          <a key={t.key} href={t.href} className={`db-task ${t.count > 0 ? "has-items" : ""}`} onClick={(e) => go(e, t.href)}>
            <span className="db-task-icon">
              <TaskIcon name={t.key} />
            </span>
            <span className="db-task-count">{t.count}</span>
            <span className="db-task-label">{t.label}</span>
            <span className="db-task-hint">{t.hint}</span>
          </a>
        ))}
      </section>

      <div className="db-grid">
        {admin?.role === "admin" && <>
        {/* ---------- Sales this month ---------- */}
        <section className="db-card db-sales">
          <header className="db-card-head">
            <div>
              <h2>Sales this month</h2>
              <p>{monthName}</p>
            </div>
            {delta != null && (
              <span className={`db-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(0)}% vs last month
              </span>
            )}
          </header>
          <p className="db-big">{formatPeso(data.salesThisMonth)}</p>
          <p className="db-sub">
            {data.ordersThisMonth} {data.ordersThisMonth === 1 ? "order" : "orders"} this month
          </p>

          <div className="db-bars" role="img" aria-label={`Daily sales for ${monthName}`}>
            {data.daily.map((value, i) => {
              const future = i + 1 > data.today;
              return (
                <div key={i} className={`db-bar-col ${future ? "is-future" : ""}`} title={`${monthName.split(" ")[0]} ${i + 1}: ${formatPeso(value)}`}>
                  <span className="db-bar" style={{ height: `${value ? Math.max((value / maxDaily) * 100, 4) : 0}%` }} />
                </div>
              );
            })}
          </div>
          <div className="db-axis">
            <span>1</span>
            <span>{Math.round(data.daysInMonth / 2)}</span>
            <span>{data.daysInMonth}</span>
          </div>
        </section>
        </>}

        {/* ---------- Stock by status ---------- */}
        <section className="db-card db-stock">
          <header className="db-card-head">
            <div>
              <h2>Stock by status</h2>
              <p>{data.stockTotal} units in stock (sold units not counted)</p>
            </div>
          </header>

          <div className="db-segments" role="img" aria-label="Stock by status">
            {data.stock.map((st) =>
              st.count ? <span key={st.value} className={`db-seg tone-${st.tone}`} style={{ flexGrow: st.count }} title={`${st.label}: ${st.count}`} /> : null
            )}
          </div>

          <ul className="db-legend">
            {data.stock.map((st) => (
              <li key={st.value}>
                <span className={`db-dot tone-${st.tone}`} />
                <span className="db-legend-label">{st.label}</span>
                <strong>{st.count}</strong>
                <small>{data.stockTotal ? Math.round((st.count / data.stockTotal) * 100) : 0}%</small>
              </li>
            ))}
          </ul>
        </section>

        {admin?.role === "admin" && <>
        {/* ---------- Cost vs. sales ---------- */}
        <section className="db-card db-cost">
          <header className="db-card-head">
            <div>
              <h2>Cost vs. sales</h2>
              <p>Last 6 months, sold units (net of discounts)</p>
            </div>
            <div className="db-key">
              <span><i className="k-sales" /> Sales</span>
              <span><i className="k-cost" /> Cost</span>
            </div>
          </header>

          <div className="db-groups">
            {data.months.map((b) => (
              <div key={`${b.y}-${b.m}`} className="db-group" title={`${b.label}: sales ${formatPeso(b.sales)}, cost ${formatPeso(b.cost)}`}>
                <div className="db-group-bars">
                  <span className="db-gbar k-sales" style={{ height: `${b.sales ? Math.max((b.sales / maxMonth) * 100, 3) : 0}%` }} />
                  <span className="db-gbar k-cost" style={{ height: `${b.cost ? Math.max((b.cost / maxMonth) * 100, 3) : 0}%` }} />
                </div>
                <span className="db-group-label">{b.label}</span>
              </div>
            ))}
          </div>

          <dl className="db-summary">
            <div><dt>Sales</dt><dd>{formatPeso(data.totalSales)}</dd></div>
            <div><dt>Cost</dt><dd>{formatPeso(data.totalCost)}</dd></div>
            <div><dt>Gross profit</dt><dd className={profit >= 0 ? "is-good" : "is-bad"}>{formatPeso(profit)}</dd></div>
            <div><dt>Margin</dt><dd>{margin.toFixed(0)}%</dd></div>
          </dl>
        </section>
        {/* ---------- Recent activity ---------- */}
        <section className="db-card db-activity">
          <header className="db-card-head">
            <div>
              <h2>Recent activity</h2>
              <p>Latest changes made in the admin panel</p>
            </div>
            <a className="db-link" href="/admin/audit" onClick={(e) => go(e, "/admin/audit")}>
              View audit log
            </a>
          </header>

          {recent.length === 0 ? (
            <p className="db-empty">No activity yet.</p>
          ) : (
            <ul className="db-feed">
              {recent.map((log) => {
                const name = nameOf(log.adminId);
                return (
                  <li key={log.logId}>
                    <span className="db-feed-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                    <span className="db-feed-text">
                      <strong>{name}</strong> {ACTION_VERB[log.action] || log.action} {COLLECTION_LABEL[log.targetCollection] || log.targetCollection}
                    </span>
                    <time dateTime={log.logCreatedAt}>{timeAgo(log.logCreatedAt)}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </>}
      </div>
    </AdminLayout>
  );
}
