import { useEffect, useState } from "react";
import AuthPage from "./userInterface/pages/AuthPage.jsx";
import HomePage from "./userInterface/pages/HomePage.jsx";
import { fetchMe, getToken, login, logout, register } from "./api.js";

/**
 * Demo wiring: not logged in -> AuthPage, logged in -> HomePage.
 * (Replace with React Router + a route guard later.)
 */
export default function App() {
  const [session, setSession] = useState(null); // { user, verification }
  const [checking, setChecking] = useState(!!getToken());

  // Restore the session after a refresh (also re-reads the student verification status).
  useEffect(() => {
    if (!getToken()) return;
    fetchMe()
      .then(setSession)
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []);

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
      onLogout={() => {
        logout();
        setSession(null);
      }}
    />
  );
}
