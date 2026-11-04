import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./AdminShared";
import "./AdminLayout.css";

/**
 * ByteBud admin shell: left sidebar, top bar (search + admin profile), main content.
 *
 * <AdminLayout
 *   active="inventory"                       // dashboard | inventory | orders | verifications | catalog | audit
 *   admin={{ fullName, role }}               // Users.fullName, Users.role
 *   badges={{ verifications: 3 }}            // optional counts shown on sidebar items
 *   searchValue / onSearchChange / onSearchSubmit / searchPlaceholder
 *   onNavigate={(href) => navigate(href)}    // optional; plain links are used otherwise
 *   onLogout={() => {}}
 * >
 *   ...page content...
 * </AdminLayout>
 */

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "/admin", icon: "grid" },
  { key: "inventory", label: "Inventory", href: "/admin/inventory", icon: "box" },
  { key: "orders", label: "Orders & After-Sales", href: "/admin/orders", icon: "bag" },
  { key: "verifications", label: "Verifications", href: "/admin/verifications", icon: "badge" },
  { key: "catalog", label: "Catalog", href: "/admin/catalog", icon: "book" },
  { key: "users", label: "Users", href: "/admin/users", icon: "badge", adminOnly: true },
  { key: "audit", label: "Audit Log", href: "/admin/audit", icon: "clock" },
];

const s = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function NavIcon({ name }) {
  const paths = {
    grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" {...s} /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" {...s} /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" {...s} /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" {...s} /></>,
    box: <><path d="M4 8l8-4 8 4v8l-8 4-8-4V8Z" {...s} /><path d="M4 8l8 4 8-4M12 12v8" {...s} /></>,
    bag: <><path d="M5 8h14l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5L5 8Z" {...s} /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" {...s} /></>,
    badge: <><circle cx="12" cy="9" r="4" {...s} /><path d="M5 20c.8-3.5 3.5-5.5 7-5.5s6.2 2 7 5.5" {...s} /></>,
    book: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5v-14Z" {...s} /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" {...s} /></>,
    clock: <><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5V12l3 2" {...s} /></>,
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function AdminLayout({
  active,
  admin,
  badges = {},
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = "Search serial number, order no, or email",
  onNavigate,
  onLogout,
  logoSrc,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false); // mobile sidebar
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const name = admin?.fullName?.trim() || "Admin";
  const roleLabel = admin?.role === "staff" ? "Staff" : "Admin";

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e) => !profileRef.current?.contains(e.target) && setProfileOpen(false);
    const onKey = (e) => e.key === "Escape" && setProfileOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const go = (event, href) => {
    setMenuOpen(false);
    if (onNavigate) {
      event.preventDefault();
      onNavigate(href);
    }
  };

  return (
    <div className="al-shell">
      <aside className={`al-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Admin navigation">
        <a className="al-brand" href="/admin" onClick={(e) => go(e, "/admin")}>
          {logoSrc ? (
            <img className="al-logo" src={logoSrc} alt="" />
          ) : (
            // LOGO PLACEHOLDER: pass logoSrc or replace this block with your <img />.
            <span className="al-logo-placeholder" aria-hidden="true">LOGO</span>
          )}
          <span className="al-brand-text">
            ByteBud <small>Admin</small>
          </span>
        </a>

        <nav className="al-nav">
          {NAV.filter((item) => !item.adminOnly || admin?.role === "admin").filter((item) => item.key !== "audit" || admin?.role === "admin").map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={`al-nav-item ${active === item.key ? "is-active" : ""}`}
              aria-current={active === item.key ? "page" : undefined}
              onClick={(e) => go(e, item.href)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {badges[item.key] > 0 && <span className="al-nav-badge">{badges[item.key]}</span>}
            </a>
          ))}
        </nav>

        <a className="al-store-link" href="/" onClick={(e) => go(e, "/")}>
          View store
        </a>
      </aside>

      {menuOpen && <div className="al-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="al-main">
        <header className="al-topbar">
          <button type="button" className="al-hamburger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <form
            className="al-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit?.(searchValue);
            }}
          >
            <SearchIcon />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search"
            />
          </form>

          <div className="al-profile" ref={profileRef}>
            <button type="button" className="al-profile-btn" onClick={() => setProfileOpen((o) => !o)} aria-haspopup="menu" aria-expanded={profileOpen}>
              <span className="al-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
              <span className="al-profile-text">
                <strong>{name}</strong>
                <small>{roleLabel}</small>
              </span>
            </button>
            {profileOpen && (
              <div className="al-menu" role="menu">
                <a role="menuitem" href="/" onClick={(e) => go(e, "/")}>View store</a>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout?.();
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="al-content">{children}</main>
      </div>
    </div>
  );
}
