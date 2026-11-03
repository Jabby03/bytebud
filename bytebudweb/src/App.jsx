import { useEffect, useState } from "react";
import AuthPage from "./userInterface/pages/AuthPage.jsx";
import HomePage from "./userInterface/pages/HomePage.jsx";
import { fetchHomeCatalog, fetchMe, getToken, login, logout, register } from "./api.js";

/**
 * Demo wiring: not logged in -> AuthPage, logged in -> HomePage.
 * (Replace with React Router + a route guard later.)
 */
export default function App() {
  const [session, setSession] = useState(null); // { user, verification }
  const [checking, setChecking] = useState(!!getToken());
  const [catalog, setCatalog] = useState({ courses: [], units: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  // Restore the session after a refresh (also re-reads the student verification status).
  useEffect(() => {
    if (!getToken()) return;
    fetchMe()
      .then(setSession)
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
        onLogin={async (credentials) => setSession(await login(credentials))}
        onRegister={async (payload) => setSession(await register(payload))}
      />
    );
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
