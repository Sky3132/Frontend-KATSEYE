import { api, asString, unwrapObject } from "./api";

export const USER_STORAGE_KEY = "katseye_user";
const AUTH_EVENT = "katseye:auth";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
};

const defaultUser: StoredUser = {
  id: "",
  name: "User",
  email: "",
  role: "customer",
};

export const readStoredUser = (): StoredUser | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

export const hasStoredAuth = () => Boolean(readStoredUser());

export const writeStoredUser = (user: Partial<StoredUser>) => {
  if (typeof window === "undefined") return;

  const current = readStoredUser();
  const nextEmail = asString(user.email ?? current?.email);
  const incomingName = asString(user.name ?? current?.name, "User");
  const currentName = asString(current?.name, "User");
  const emailLocalPart = nextEmail.split("@")[0]?.toLowerCase() ?? "";
  const incomingLooksLikeEmailHandle =
    Boolean(emailLocalPart) &&
    incomingName.toLowerCase() === emailLocalPart &&
    !incomingName.includes(" ");
  const shouldPreserveCurrentName =
    incomingLooksLikeEmailHandle &&
    currentName !== "User" &&
    currentName.trim().length > 0 &&
    currentName.toLowerCase() !== emailLocalPart;

  const nextUser: StoredUser = {
    ...defaultUser,
    ...current,
    ...user,
    id: asString(user.id ?? current?.id),
    name: shouldPreserveCurrentName ? currentName : incomingName,
    email: nextEmail,
    role: asString(user.role ?? current?.role, "customer").toLowerCase(),
    avatar: asString(user.avatar ?? current?.avatar),
  };

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearStoredAuth = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event(AUTH_EVENT));
};

const normalizeSessionUser = (value: unknown): StoredUser | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const userRecord = unwrapObject(record.user) ?? record;
  const id = asString(userRecord.id);
  const email = asString(userRecord.email);
  if (!id && !email) return null;

  return {
    id,
    name: asString(userRecord.name || userRecord.username, "User"),
    email,
    role: asString(userRecord.role, "customer").toLowerCase(),
    avatar: asString(userRecord.avatar),
  };
};

export async function getSessionUser(): Promise<StoredUser | null> {
  try {
    const response = await api("/api/users/me");
    return normalizeSessionUser(response);
  } catch {
    return null;
  }
}

export async function syncSessionUser(): Promise<StoredUser | null> {
  const user = await getSessionUser();
  if (user) {
    writeStoredUser(user);
  } else {
    clearStoredAuth();
  }
  return user;
}

export async function logoutUser() {
  try {
    await api("/api/users/logout", { method: "POST" });
  } catch {
    // local cleanup still applies
  } finally {
    clearStoredAuth();
  }
}
