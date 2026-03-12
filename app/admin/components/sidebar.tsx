"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "../../components/theme-toggle";
import { logoutUser } from "../../lib/auth";

const adminLinks = [
  { label: "Dashboard", href: "/admin" },
  { label: "Product Management", href: "/admin/product_management" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const logout = async () => {
    await logoutUser();
    window.location.assign("/login?loggedOut=1");
  };

  return (
    <aside className="flex h-full min-h-screen w-full max-w-[300px] flex-col border-r border-black/10 bg-white/80 px-5 py-6 backdrop-blur-xl dark:border-[#2b2613] dark:bg-[#070707]/95">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111827] text-sm font-semibold text-white dark:bg-[#f1d04b] dark:text-[#090909]">
          KK
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6b7280] dark:text-[#a69146]">
            Admin
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-[#111827] dark:text-[#f1d04b]">
            Katseye Panel
          </h1>
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        {adminLinks.map((link) => {
          const active = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[#111827] text-white shadow-sm dark:bg-[#f1d04b] dark:text-[#090909]"
                  : "text-[#374151] hover:bg-black/5 dark:text-[#c7ba81] dark:hover:bg-[#12110d]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-3xl border border-black/10 bg-[#f7f7fa] p-4 dark:border-[#2b2613] dark:bg-[#11110f]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280] dark:text-[#a69146]">
            Admin Theme
          </p>
          <p className="mt-2 text-sm text-[#374151] dark:text-[#d9c980]">
            Switch light and dark mode for the admin workspace.
          </p>
          <ThemeToggle className="mt-4 w-full justify-center dark:border-[#d9b92f] dark:bg-[#080808]" />
        </div>

        <Link
          href="/user/products"
          className="block rounded-2xl border border-black/10 px-4 py-3 text-center text-sm font-medium text-[#111827] transition hover:bg-black/5 dark:border-[#2b2613] dark:text-[#f1d04b] dark:hover:bg-[#12110d]"
        >
          Back To Store
        </Link>

        <button
          type="button"
          onClick={logout}
          className="block w-full rounded-2xl border border-black/10 px-4 py-3 text-center text-sm font-medium text-[#111827] transition hover:bg-black/5 dark:border-[#2b2613] dark:text-[#f1d04b] dark:hover:bg-[#12110d]"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
