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
              href="https://mail.google.com/mail/?view=cm&fs=1&to=katseyeklothes1@gmail.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-700 transition hover:text-black dark:text-[#d6c67f] dark:hover:text-[#f7db63]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5V17.5C20 18.3284 19.3284 19 18.5 19H5.5C4.67157 19 4 18.3284 4 17.5V6.5Z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M6 7.5L12 12L18 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              katseyeklothes1@gmail.com
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61582637374818"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-700 transition hover:text-black dark:text-[#d6c67f] dark:hover:text-[#f7db63]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 12.06C22 6.504 17.523 2 12 2S2 6.504 2 12.06c0 5.02 3.657 9.18 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.52 1.492-3.91 3.777-3.91 1.094 0 2.238.197 2.238.197v2.47h-1.26c-1.242 0-1.63.776-1.63 1.57v1.888h2.773l-.443 2.91h-2.33V22c4.78-.76 8.437-4.92 8.437-9.94Z" />
              </svg>
              Katseye Klothes
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
