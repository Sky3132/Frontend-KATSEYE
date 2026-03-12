import type { ReactNode } from "react";
import AdminAuthGuard from "./components/admin-auth-guard";
import Sidebar from "./components/sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGuard>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#edf1ff,#f6f8fc_48%,#f3f6fb)] text-[#141414] transition-colors dark:bg-[radial-gradient(circle_at_top,#1a1708,#0a0a09_45%,#070707)] dark:text-[#f1d04b]">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</div>
        </div>
      </main>
    </AdminAuthGuard>
  );
}
