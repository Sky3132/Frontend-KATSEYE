"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { USER_STORAGE_KEY } from "../../lib/auth";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  readCart,
  subscribeCart,
} from "../lib/cart";

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

const EMPTY_USER: StoredUser = {};
let cachedUserRaw: string | null = null;
let cachedUserSnapshot: StoredUser = EMPTY_USER;

const readStoredUser = (): StoredUser => {
  if (typeof window === "undefined") return EMPTY_USER;

  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw === cachedUserRaw) return cachedUserSnapshot;
    if (!raw) {
      cachedUserRaw = null;
      cachedUserSnapshot = EMPTY_USER;
      return cachedUserSnapshot;
    }

    cachedUserRaw = raw;
    cachedUserSnapshot = JSON.parse(raw) as StoredUser;
    return cachedUserSnapshot;
  } catch {
    cachedUserRaw = null;
    cachedUserSnapshot = EMPTY_USER;
    return cachedUserSnapshot;
  }
};

const subscribeUser = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);

  return () => window.removeEventListener("storage", handleChange);
};

export default function AccountPage() {
  const searchParams = useSearchParams();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const user = useSyncExternalStore(subscribeUser, readStoredUser, () => EMPTY_USER);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const resetOpen = searchParams.get("tab") === "reset";

  const handleReset = () => {
    setMessage("");
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setMessage("Password reset request saved (sample flow).");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111]">
      <StoreHeader cartCount={cartCount} onCartClick={() => {}} />
      <section className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h1 className="text-4xl font-semibold">My Account</h1>
          <div className="mt-4 space-y-1 text-sm text-neutral-600">
            <p>
              Name: <span className="font-medium text-black">{user.name ?? "N/A"}</span>
            </p>
            <p>
              Email: <span className="font-medium text-black">{user.email ?? "N/A"}</span>
            </p>
            <p>
              Role: <span className="font-medium text-black">{user.role ?? "user"}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-2xl font-semibold">Reset Password</h2>
          {!resetOpen ? (
            <p className="mt-2 text-sm text-neutral-600">Open from profile menu: Reset Password.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="New password"
                className="h-11 w-full rounded-lg border border-neutral-300 px-3"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm password"
                className="h-11 w-full rounded-lg border border-neutral-300 px-3"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button type="button" className="rounded-lg bg-black px-4 py-2 text-sm text-white" onClick={handleReset}>
                Save Password
              </button>
              {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
