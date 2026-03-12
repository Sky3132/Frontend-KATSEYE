"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readStoredUser, syncSessionUser } from "../../lib/auth";

type AdminAuthGuardProps = {
  children: React.ReactNode;
};

const isAdminRole = (role: string | undefined | null) => {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "admin";
};

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(() => {
    const stored = readStoredUser();
    return Boolean(stored) && isAdminRole(stored?.role);
  });

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const stored = readStoredUser();
      if (stored && isAdminRole(stored.role) && active) {
        setIsAuthorized(true);
      }

      const user = await syncSessionUser();
      if (!active) return;

      if (!user) {
        setIsAuthorized(false);
        setIsChecking(false);
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const nextIsAdmin = isAdminRole(user.role);
      setIsAuthorized(nextIsAdmin);
      setIsChecking(false);

      if (!nextIsAdmin) {
        router.replace("/");
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (isChecking || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] text-sm font-medium text-black/55">
        Checking access...
      </div>
    );
  }

  return <>{children}</>;
}
