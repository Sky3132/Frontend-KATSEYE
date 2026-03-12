"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncSessionUser } from "../../lib/auth";

type UserAuthGuardProps = {
  children: React.ReactNode;
};

export default function UserAuthGuard({ children }: UserAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const user = await syncSessionUser();
      if (!active) return;
      setIsAuthorized(Boolean(user));
      setIsChecking(false);

      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
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
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
