import type { ReactNode } from "react";
import AppFooter from "./components/app-footer";
import UserAuthGuard from "./components/user-auth-guard";

type UserLayoutProps = {
  children: ReactNode;
};

export default function UserLayout({ children }: UserLayoutProps) {
  return (
    <UserAuthGuard>
      {children}
      <AppFooter />
    </UserAuthGuard>
  );
}
