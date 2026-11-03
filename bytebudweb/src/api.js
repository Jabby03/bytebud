// Talks to the ByteBud API. Set VITE_API_URL in .env if the server is not on localhost:5000.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TOKEN_KEY = "bytebud_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const logout = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the API running?");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

// Each returns { user, verification } and stores the login token.
export async function register(payload) {
  const data = await request("/api/auth/register", { method: "POST", body: payload });
  localStorage.setItem(TOKEN_KEY, data.token);
  return { user: data.user, verification: data.verification };
}

export async function login(credentials) {
  const data = await request("/api/auth/login", { method: "POST", body: credentials });
  localStorage.setItem(TOKEN_KEY, data.token);
  return { user: data.user, verification: data.verification };
}

export const fetchMe = () => request("/api/auth/me");