export const USER_STORAGE_KEY = "katseye_user";
export const TOKEN_STORAGE_KEY = "katseye_token";
export const REFRESH_TOKEN_STORAGE_KEY = "katseye_refresh_token";

export const getStoredAccessToken = () => {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const getStoredRefreshToken = () => {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const hasStoredAuth = () => {
  if (typeof window === "undefined") return false;

  try {
    return Boolean(localStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY));
  } catch {
    return false;
  }
};

export const clearStoredAuth = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
};

export const createAuthHeaders = (headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);
  const token = getStoredAccessToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
};

export const authenticatedFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  return fetch(input, {
    ...init,
    credentials: init.credentials ?? "include",
    headers: createAuthHeaders(init.headers),
  });
};
