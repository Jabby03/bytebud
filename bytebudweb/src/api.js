// Talks to the local ByteBud API. Set VITE_API_URL in .env if it uses another URL.
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

export const forgotPassword = (payload) => request("/api/auth/forgot-password", { method: "POST", body: payload });
export const resetPassword = (payload) => request("/api/auth/reset-password", { method: "POST", body: payload });

export const fetchMe = () => request("/api/auth/me");
export const fetchHomeCatalog = () => request("/api/catalog/home");
export const fetchCart = () => request("/api/cart");
export const reserveCartItem = (unitId) => request("/api/cart/items", { method: "POST", body: { unitId } });
export const removeCartItem = (unitId) => request(`/api/cart/items/${encodeURIComponent(unitId)}`, { method: "DELETE" });
export const placeOrder = (payload) => request("/api/orders", { method: "POST", body: payload });
export const fetchMyAccount = () => request("/api/account");
export const saveMyProfile = (payload) => request("/api/account/profile", { method: "PATCH", body: payload });
export const changeMyPassword = (payload) => request("/api/account/password", { method: "PATCH", body: payload });
export const fileWarrantyClaim = (payload) => request("/api/account/claims", { method: "POST", body: payload });
export const requestOrderReturn = (payload) => request("/api/account/returns", { method: "POST", body: payload });
const fileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("Could not read the selected proof file."));
  reader.readAsDataURL(file);
});
export const submitStudentVerification = async ({ schoolEmail, file }) => request("/api/account/verifications", {
  method: "POST", body: { schoolEmail, proofDataUrl: await fileAsDataUrl(file) },
});
export const adminRequest = (path, options) => request(`/api/admin${path}`, options);
