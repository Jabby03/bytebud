import { useEffect, useRef, useState } from "react";
import "./NavbarHome.css";

/**
 * ByteBud: top navbar for the buyer site
 *
 * <Navbar
 *   user={{ fullName, role }}      // Users.fullName, Users.role
 *   cartCount={cart.cartItems.length}   // Carts.cartItems[] length
 *   logoSrc="/logo.svg"            // optional: placeholder shown when missing
 *   onLogout={() => { ... }}
 * />
 *
 * Links are plain <a href> so they work with any router. Swap them for <Link> if you prefer.
 */

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="19" r="1.4" fill="currentColor" />
      <circle cx="16.5" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Navbar({
  user,
  cartCount = 0,
  logoSrc,
  homeHref = "/",
  cartHref = "/checkout",
  accountHref = "/account",
  adminHref = "/admin",
  onLogout,
  onNavigate,
  activePage = "home",
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const name = user?.fullName?.trim() || "Account";
  const initial = name.charAt(0).toUpperCase();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const handleNavigate = (event, href) => {
    setMenuOpen(false);
    if (onNavigate) { event.preventDefault(); onNavigate(href); }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="bb-nav">
      <div className="bb-nav-inner">
        <a className="bb-nav-brand" href={homeHref} aria-label="ByteBud home" onClick={(e) => handleNavigate(e, homeHref)}>
          {logoSrc ? (
            <img className="bb-nav-logo" src={logoSrc} alt="" />
          ) : (
            // LOGO PLACEHOLDER: pass logoSrc or replace this block with your <img />.
            <span className="bb-nav-logo-placeholder" aria-hidden="true">
              LOGO
            </span>
          )}
          <span className="bb-nav-name">ByteBud</span>
        </a>

        <nav className="bb-nav-links" aria-label="Main">
          <a className={`bb-nav-link ${activePage === "home" ? "is-active" : ""}`} href={homeHref} aria-current={activePage === "home" ? "page" : undefined} onClick={(e) => handleNavigate(e, homeHref)}>
            Find a Laptop
          </a>
        </nav>

        <div className="bb-nav-actions">
          <a className="bb-nav-cart" href={cartHref} onClick={(e) => handleNavigate(e, cartHref)} aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
            <CartIcon />
            {cartCount > 0 && <span className="bb-nav-badge">{cartCount > 99 ? "99+" : cartCount}</span>}
          </a>

          <div className="bb-nav-account" ref={menuRef}>
            <button
              type="button"
              className="bb-nav-account-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="bb-nav-avatar" aria-hidden="true">
                {initial}
              </span>
              <span className="bb-nav-account-name">{name}</span>
              <ChevronIcon />
            </button>

            {menuOpen && (
              <div className="bb-nav-menu" role="menu">
                <div className="bb-nav-menu-head">{name}</div>
                <a className="bb-nav-menu-item bb-nav-menu-mobile" role="menuitem" href={homeHref} onClick={(e) => handleNavigate(e, homeHref)}>
                  Find a Laptop
                </a>
                <a className="bb-nav-menu-item" role="menuitem" href={accountHref} onClick={(e) => handleNavigate(e, accountHref)}>
                  My account
                </a>
                {isStaff && (
                  <a className="bb-nav-menu-item" role="menuitem" href={adminHref} onClick={(e) => handleNavigate(e, adminHref)}>
                    Dashboard
                  </a>
                )}
                <button
                  type="button"
                  className="bb-nav-menu-item is-danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout?.();
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
