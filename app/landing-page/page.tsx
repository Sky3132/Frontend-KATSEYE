"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useState } from "react";
import ThemeToggle from "../components/theme-toggle";
import { syncSessionUser } from "../lib/auth";
import { products } from "../user/lib/products";

const featuredProducts = products.filter((product) => product.category === "cloth").slice(0, 3);
const bestSaleProducts = products.slice(0, 6);
const asCurrency = (value: number) => `$${value.toFixed(2)}`;
const THEME_EVENT = "katseye:theme";
const THEME_STORAGE_KEY = "katseye-theme";

const subscribeBrowserState = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback();
  window.addEventListener(THEME_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(THEME_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
};

const getThemeSnapshot = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
};

export default function LandingPage() {
  const router = useRouter();
  const [role, setRole] = useState<null | "customer" | "user" | "admin">(null);
  const isDarkTheme = useSyncExternalStore(subscribeBrowserState, getThemeSnapshot, () => false);

  useEffect(() => {
    let active = true;
    void syncSessionUser().then((user) => {
      if (!active) return;
      const nextRole =
        user?.role === "admin"
          ? "admin"
          : user?.role === "customer"
            ? "customer"
            : user?.role === "user"
              ? "user"
              : null;
      setRole(nextRole);
    });
    return () => {
      active = false;
    };
  }, []);

  const goToProtected = async (targetPath: string) => {
    const user = await syncSessionUser();
    if (user?.role === "admin") {
      router.push("/admin");
      return;
    }
    if (user?.role === "customer" || user?.role === "user") {
      router.push(targetPath);
      return;
    }
    router.push(`/login?redirect=${encodeURIComponent(targetPath)}`);
  };

  const isSignedIn = role !== null;

  return (
    <main className="min-h-screen bg-[#f8f8f8] text-[#121212] transition-colors dark:bg-[#090909] dark:bg-[radial-gradient(circle_at_top,rgba(112,95,25,0.14),transparent_20%),linear-gradient(180deg,#080808_0%,#0c0c0b_100%)] dark:text-[#f1d04b]">
      <header className="fixed inset-x-0 top-0 z-20 flex h-20 items-center justify-between border-b border-white/15 bg-black/25 px-6 backdrop-blur-md dark:border-[#2f2a16] dark:bg-[linear-gradient(180deg,rgba(4,4,4,0.95)_0%,rgba(13,13,12,0.88)_100%)]">
        <div className="flex items-center gap-3">
          <img
            src={isDarkTheme ? "/black logo.jpg" : "/logo.png"}
            alt="Katseye logo"
            className="h-11 w-11 rounded-full object-cover"
          />
          <span className="text-3xl font-semibold text-white">
            Katseye Klothes
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle className="border-white/20 bg-white/10 text-white hover:border-white/35 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b]" />
          {isSignedIn ? null : (
            <>
              <button
                className="rounded-xl border border-white/35 px-5 py-2 text-xl text-white dark:border-[#f1d04b]/30 dark:text-[#f1d04b]"
                type="button"
                onClick={() => router.push("/login")}
              >
                Log In
              </button>
              <button
                className="rounded-xl bg-white px-5 py-2 text-xl font-semibold text-black dark:bg-[#f1d04b] dark:text-[#090909]"
                type="button"
                onClick={() => router.push("/login/register")}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <section className="relative flex min-h-screen items-end overflow-hidden px-6 pb-16 pt-24">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        >
          <source
            src="/ssstik.io_@sooyaditxy_1772893157760.mp4"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/70" />

        <div className="relative mx-auto flex w-full max-w-[1440px] items-end justify-between gap-10">
          <div className="max-w-4xl text-white dark:text-[#f1d04b]">
            <p className="text-sm font-semibold uppercase tracking-[0.38em] text-white/75 dark:text-[#c7ba81]">
              Featured Drop
            </p>
            <h1 className="mt-4 text-6xl font-semibold tracking-tight sm:text-7xl xl:text-8xl">
              Style the Vision
            </h1>
            <p className="mt-5 max-w-3xl text-xl leading-relaxed text-neutral-100 dark:text-[#e6dba8] sm:text-2xl">
              Full-screen motion, exclusive drops, and the latest Katseye merch
              in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                className="rounded-xl bg-white px-10 py-4 text-xl font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-[#f1d04b] dark:text-[#090909] dark:hover:bg-[#f6dc6a] dark:focus-visible:ring-[#f1d04b]/60 dark:focus-visible:ring-offset-black"
                type="button"
                onClick={() => void goToProtected("/user/products")}
              >
                Shop The Collection
              </button>
              <button
                className="rounded-xl border border-white/40 px-10 py-4 text-xl font-semibold text-white dark:border-[#f1d04b]/45 dark:text-[#f1d04b]"
                type="button"
                onClick={() =>
                  document
                    .getElementById("featured-merch")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                View Featured
              </button>
            </div>
          </div>

          <div className="hidden rounded-[28px] border border-white/20 bg-white/10 p-6 text-white backdrop-blur-md dark:border-[#f1d04b]/20 dark:text-[#f1d04b] lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70 dark:text-[#c7ba81]">
              Katseye Music
            </p>
            <p className="mt-3 text-3xl font-semibold">Merches Available</p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-white/80 dark:text-[#e6dba8]">
              Scroll down for featured merch and most-sale products.
            </p>
          </div>
        </div>
      </section>

      <section
        id="featured-merch"
        className="mx-auto max-w-[1400px] px-6 py-16"
      >
        <h2 className="mb-10 text-center text-6xl font-semibold tracking-tight">
          Featured Merch
        </h2>
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {featuredProducts.map((product) => (
            <button
              key={product.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:-translate-y-1 hover:shadow-xl dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)]"
              type="button"
              onClick={() => void goToProtected(`/user/products/product-details/${product.id}`)}
            >
              <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[#f3f3f1] dark:bg-[#2b2b2b]">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="flex flex-1 flex-col space-y-2 p-6">
                <h3 className="text-4xl font-semibold">{product.name}</h3>
                <p className="text-2xl text-neutral-500 dark:text-[#c7ba81]">{product.brand}</p>
                <p className="text-4xl font-semibold">{asCurrency(product.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section id="sale-products" className="mx-auto max-w-[1400px] px-6 pb-20">
        <h2 className="mb-10 text-center text-6xl font-semibold tracking-tight">
          Most Sale Products
        </h2>
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {bestSaleProducts.map((product) => (
            <button
              key={product.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:-translate-y-1 hover:shadow-xl dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)]"
              type="button"
              onClick={() => void goToProtected(`/user/products/product-details/${product.id}`)}
            >
              <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[#f3f3f1] dark:bg-[#2b2b2b]">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="flex flex-1 flex-col space-y-2 p-6">
                <h3 className="text-4xl font-semibold">{product.name}</h3>
                <p className="text-2xl text-neutral-500 dark:text-[#c7ba81]">{product.brand}</p>
                <p className="text-4xl font-semibold">{asCurrency(product.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
