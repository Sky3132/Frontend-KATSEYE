import type { ReactNode } from "react";
import UserAuthGuard from "./components/user-auth-guard";

type UserLayoutProps = {
  children: ReactNode;
};

export default function UserLayout({ children }: UserLayoutProps) {
  return <UserAuthGuard>{children}</UserAuthGuard>;
}
