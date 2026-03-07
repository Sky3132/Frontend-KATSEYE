"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { hasStoredAuth } from "../../lib/auth";

type UserAuthGuardProps = {
  children: React.ReactNode;
};

export default function UserAuthGuard({ children }: UserAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthorized = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};

      const handleChange = () => callback();
      window.addEventListener("storage", handleChange);
      return () => window.removeEventListener("storage", handleChange);
    },
    hasStoredAuth,
    () => false,
  );

  useEffect(() => {
    if (!isAuthorized) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthorized, pathname, router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] text-sm font-medium text-black/55">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
