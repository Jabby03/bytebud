import { useCallback, useEffect, useState } from "react";
import AuthPage from "./userInterface/pages/AuthPage.jsx";
import HomePage from "./userInterface/pages/HomePage.jsx";
import { changeMyPassword, fetchCart, fetchHomeCatalog, fetchMe, fetchMyAccount, fileWarrantyClaim, forgotPassword, getToken, login, logout, placeOrder, register, removeCartItem, requestOrderReturn, reserveCartItem, saveMyProfile, submitStudentVerification } from "./api.js";
import AdminConsole from "./userInterface/pages/AdminConsole.jsx";
import PasswordResetPage from "./userInterface/pages/PasswordResetPage.jsx";
import LaptopDetailPage from "./userInterface/pages/LaptopDetailPage.jsx";
import CartCheckoutPage from "./userInterface/pages/CartCheckoutPage.jsx";
import MyAccountPage from "./userInterface/pages/MyAccountPage.jsx";

/**
 * Restores the session and routes buyers to the storefront and staff/admin users to /admin.
 */
export default function App() {
  const [session, setSession] = useState(null); // { user, verification }
  const [checking, setChecking] = useState(!!getToken());
  const [catalog, setCatalog] = useState({ courses: [], units: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [accountData, setAccountData] = useState({ orders: [], warranties: [], verifications: [] });
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [pathname, setPathname] = useState(window.location.pathname);
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (session && pathname.startsWith("/admin") && !["admin", "staff"].includes(session.user.role)) {
      window.history.replaceState({}, "", "/");
      setPathname("/");
    }
  }, [session, pathname]);

  const navigate = (href) => {
    window.history.pushState({}, "", href);
    setPathname(window.location.pathname);
  };

  // Restore the session after a refresh (also re-reads the student verification status).
  useEffect(() => {
    if (!getToken()) return;
    fetchMe()
      .then((restored) => {
        setSession(restored);
        if (["admin", "staff"].includes(restored.user.role) && window.location.pathname === "/") {
          window.history.replaceState({}, "", "/admin");
          setPathname("/admin");
        }
      })
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!session) {
      setCatalog({ courses: [], units: [] });
      setCartItems([]);
      setCatalogLoading(false);
      setCatalogError("");
      return undefined;
    }

    let active = true;
    setCatalogLoading(true);
    setCatalogError("");
    fetchHomeCatalog()
      .then((data) => {
        if (active) setCatalog({ courses: data.courses || [], units: data.units || [] });
      })
      .catch((error) => {
        if (active) setCatalogError(error.message || "Could not load the laptop catalog.");
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const loadAccount = useCallback(async (showLoading = false) => {
    if (showLoading) setAccountLoading(true);
    setAccountError("");
    try {
      const data = await fetchMyAccount();
      setAccountData({ orders: data.orders || [], warranties: data.warranties || [], verifications: data.verifications || [] });
      return data;
    } catch (error) {
      setAccountError(error.message || "Could not load your account.");
      throw error;
    } finally {
      if (showLoading) setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname !== "/account" || session?.user?.role !== "buyer") return undefined;
    loadAccount(true).catch(() => {});
    return undefined;
  }, [pathname, session?.user?.userId, loadAccount]);

  useEffect(() => {
    if (!session || session.user.role !== "buyer") { setCartItems([]); setCartLoading(false); return undefined; }
    let active = true;
    setCartLoading(true);
    fetchCart().then((cart) => { if (active) setCartItems(cart.cartItems || []); }).catch(() => { if (active) setCartItems([]); }).finally(() => { if (active) setCartLoading(false); });
    return () => { active = false; };
  }, [session]);

  const refreshCatalog = async () => {
    const current = await fetchHomeCatalog();
    setCatalog({ courses: current.courses || [], units: current.units || [] });
  };
  const addCartItem = async (unitId) => {
    const result = await reserveCartItem(unitId);
    setCartItems(result.cartItems || []);
    await refreshCatalog();
  };
  const deleteCartItem = async (unitId) => {
    const result = await removeCartItem(unitId);
    setCartItems(result.cartItems || []);
    await refreshCatalog();
  };
  const submitOrder = async (payload) => {
    const result = await placeOrder(payload);
    setCartItems(result.cartItems || []);
    await refreshCatalog().catch(() => {});
    return result;
  };
  const reloadAccountSilently = async () => { try { await loadAccount(false); } catch { /* Keep the successful action result visible if refresh fails. */ } };
  const handleFileClaim = async (values) => {
    const result = await fileWarrantyClaim(values);
    return { claimNo: result.claim?.claimNo };
  };
  const handleReturnRequest = async (values) => {
    return requestOrderReturn(values);
  };
  const handleSubmitProof = async (values) => {
    return submitStudentVerification(values);
  };
  const handleSaveProfile = async (values) => {
    const result = await saveMyProfile(values);
    setSession((current) => current ? { ...current, user: result.user } : current);
    setAccountData((current) => ({ ...current, user: result.user }));
    await reloadAccountSilently();
  };
  const handleChangePassword = async (values) => {
    await changeMyPassword(values);
  };

  const logoutBuyer = () => { logout(); setSession(null); navigate("/"); };

  if (resetToken) return <PasswordResetPage token={resetToken} />;

  if (checking) return null;

  if (!session) {
    return (
      <AuthPage
        showForgotPassword
        onForgotPassword={forgotPassword}
        onLogin={async (credentials) => {
          const next = await login(credentials);
          setSession(next);
          if (["admin", "staff"].includes(next.user.role)) navigate("/admin");
        }}
        onRegister={async (payload) => setSession(await register(payload))}
      />
    );
  }

  if (pathname.startsWith("/admin")) {
    if (["admin", "staff"].includes(session.user.role)) {
      return <AdminConsole admin={session.user} pathname={pathname} onNavigate={navigate} onLogout={logoutBuyer} />;
    }
  }

  if (pathname === "/checkout" && session.user.role === "buyer") return <CartCheckoutPage
    units={catalog.units} cartItems={cartItems} user={session.user}
    verifications={session.verification ? [session.verification] : []}
    loading={catalogLoading || cartLoading} onRemoveFromCart={deleteCartItem}
    onPlaceOrder={submitOrder} onNavigate={navigate} onLogout={logoutBuyer}
  />;

  if (pathname === "/account" && session.user.role === "buyer") return <MyAccountPage
    initialTab={new URLSearchParams(window.location.search).get("tab")}
    user={session.user} orders={accountData.orders} warranties={accountData.warranties}
    verifications={accountData.verifications} cartCount={cartItems.length}
    loading={accountLoading} error={accountError} onRetry={() => loadAccount(true)} onFileClaim={handleFileClaim}
    onRequestReturn={handleReturnRequest} onSubmitProof={handleSubmitProof}
    onSaveProfile={handleSaveProfile} onChangePassword={handleChangePassword}
    onTabChange={(tab) => { const url = new URL(window.location.href); url.searchParams.set("tab", tab); window.history.replaceState({}, "", url); }}
    onNavigate={navigate} onLogout={logoutBuyer}
  />;

  const laptopMatch = pathname.match(/^\/laptops\/([^/]+)\/?$/);
  if (laptopMatch && session.user.role === "buyer") return <LaptopDetailPage
    unitId={decodeURIComponent(laptopMatch[1])} units={catalog.units} courses={catalog.courses}
    user={session.user} verifications={session.verification ? [session.verification] : []} cartItems={cartItems}
    loading={catalogLoading} logoSrc={undefined} onAddToCart={addCartItem} onRemoveFromCart={deleteCartItem}
    onNavigate={navigate} onLogout={logoutBuyer}
  />;

  return (
    <HomePage
      user={session.user}
      verification={session.verification ?? null}
      courses={catalog.courses}
      units={catalog.units}
      cartCount={cartItems.length}
      loading={catalogLoading}
      error={catalogError}
      onOpenUnit={(unitId) => navigate(`/laptops/${encodeURIComponent(unitId)}`)}
      onNavigate={navigate}
      onLogout={logoutBuyer}
    />
  );
}
