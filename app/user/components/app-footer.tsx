"use client";

import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-[#f3f3f0] px-4 py-10 text-[#111] transition-colors dark:border-[#2f2a16] dark:bg-[#090909] dark:text-[#f1d04b] sm:px-6 xl:px-10">
      <div className="grid gap-8 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm transition-colors dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)] md:grid-cols-[1.2fr_0.8fr_0.8fr] md:p-8">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo_Black-Photoroom.png"
              alt="Katseye logo"
              className="h-12 w-12 rounded-full object-cover dark:hidden"
            />
            <img
              src="/black logo.jpg"
              alt="Katseye logo"
              className="hidden h-12 w-12 rounded-full object-cover dark:block"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-[#b59b39]">
                KATSEYE
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">Katseye Klothes</h2>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-600 dark:text-[#c7ba81]">
            Shop official-inspired music releases, merch, and curated drops with a cleaner in-app
            catalog experience.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-[#b59b39]">
            Explore
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-700 dark:text-[#d6c67f]">
            <Link href="/user/products" className="transition hover:text-black dark:hover:text-[#f7db63]">
              Shop
            </Link>
            <Link href="/user/products/albums" className="transition hover:text-black dark:hover:text-[#f7db63]">
              Albums
            </Link>
            <Link href="/user/history" className="transition hover:text-black dark:hover:text-[#f7db63]">
              History
            </Link>
            <Link href="/user/account" className="transition hover:text-black dark:hover:text-[#f7db63]">
              Account
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-[#b59b39]">
            Contact
          </p>
          <div className="mt-4 space-y-3">
            <a
              href="mailto:katseye@umgstores.com"
              className="block text-sm text-neutral-700 transition hover:text-black dark:text-[#d6c67f] dark:hover:text-[#f7db63]"
            >
              katseye@umgstores.com
            </a>
            <a
              href="https://shop.katseye.world/pages/contact-us"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-[#f1d04b] dark:text-[#090909] dark:hover:bg-[#f7db63]"
            >
              Send Message
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
