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
    <main className="min-h-screen bg-[#f7f7f7] text-[#111] transition-colors dark:bg-[#090909] dark:bg-[radial-gradient(circle_at_top,rgba(112,95,25,0.14),transparent_20%),linear-gradient(180deg,#080808_0%,#0c0c0b_100%)] dark:text-[#f1d04b]">
      <StoreHeader cartCount={cartCount} />
      <section className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)]">
          <h1 className="text-4xl font-semibold">My Account</h1>
          <div className="mt-4 space-y-1 text-sm text-neutral-600 dark:text-[#c7ba81]">
            <p>
              Name: <span className="font-medium text-black dark:text-[#f1d04b]">{user.name ?? "N/A"}</span>
            </p>
            <p>
              Email: <span className="font-medium text-black dark:text-[#f1d04b]">{user.email ?? "N/A"}</span>
            </p>
            <p>
              Role: <span className="font-medium text-black dark:text-[#f1d04b]">{user.role ?? "user"}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)]">
          <h2 className="text-2xl font-semibold">Reset Password</h2>
          {!resetOpen ? (
            <p className="mt-2 text-sm text-neutral-600 dark:text-[#c7ba81]">Open from profile menu: Reset Password.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="New password"
                className="h-11 w-full rounded-lg border border-neutral-300 px-3 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b] dark:placeholder:text-[#8e7a28]"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm password"
                className="h-11 w-full rounded-lg border border-neutral-300 px-3 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b] dark:placeholder:text-[#8e7a28]"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button type="button" className="rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-[#f1d04b] dark:text-[#090909]" onClick={handleReset}>
                Save Password
              </button>
              {message ? <p className="text-sm text-neutral-700 dark:text-[#d6c67f]">{message}</p> : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
