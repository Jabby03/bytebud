import { useEffect, useState } from "react";
import AuthPage from "./userInterface/pages/AuthPage.jsx";
import HomePage from "./userInterface/pages/HomePage.jsx";
import { fetchHomeCatalog, fetchMe, getToken, login, logout, register } from "./api.js";
import AdminConsole from "./userInterface/pages/AdminConsole.jsx";

/**
 * Restores the session and routes buyers to the storefront and staff/admin users to /admin.
 */
export default function App() {
  const [session, setSession] = useState(null); // { user, verification }
  const [checking, setChecking] = useState(!!getToken());
  const [catalog, setCatalog] = useState({ courses: [], units: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [pathname, setPathname] = useState(window.location.pathname);

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

  if (checking) return null;

  if (!session) {
    return (
      <AuthPage
        showForgotPassword={false}
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
      return <AdminConsole admin={session.user} pathname={pathname} onNavigate={navigate} onLogout={() => { logout(); setSession(null); navigate("/"); }} />;
    }
  }

  return (
    <HomePage
      user={session.user}
      verification={session.verification ?? null}
      courses={catalog.courses}
      units={catalog.units}
      loading={catalogLoading}
      error={catalogError}
      onLogout={() => {
        logout();
        setSession(null);
      }}
    />
  );
}
