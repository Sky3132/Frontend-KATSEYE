"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "./auth-shell";
import { AuthField } from "./auth-fields";
import { api } from "../../lib/api";
import { syncSessionUser } from "../../lib/auth";

const isAdminRole = (role: string | undefined | null) => {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "admin";
};

const getPostLoginRedirect = (role: string | undefined | null, redirectParam: string | null) => {
  const admin = isAdminRole(role);
  const defaultTarget = admin ? "/admin" : "/user/products";

  const candidate = (redirectParam ?? "").trim();
  if (!candidate) return defaultTarget;
  if (!candidate.startsWith("/")) return defaultTarget;

  if (candidate.startsWith("/admin")) {
    return admin ? candidate : "/user/products";
  }

  // Keep admins in the admin area by default.
  return admin ? "/admin" : candidate.startsWith("/user") ? candidate : "/user/products";
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const emailValue = email.trim();
    const passwordValue = password.trim();

    if (!emailValue || !passwordValue) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api("/api/users/login", {
        method: "POST",
        body: JSON.stringify({
          email: emailValue,
          password: passwordValue,
        }),
      });
      const user = await syncSessionUser();
      const target = getPostLoginRedirect(user?.role, searchParams.get("redirect"));
      router.replace(target);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reach login service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      activeTab="login"
      title="Welcome Back"
      description="Sign in to continue shopping the latest Katseye drops and saved picks."
      submitLabel={isSubmitting ? "Signing In..." : "Sign In"}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onSubmit={handleSubmit}
    >
      <AuthField
        id="email"
        name="email"
        label="Email Address"
        placeholder="you@example.com"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        icon={<span aria-hidden="true">@</span>}
      />

      <AuthField
        id="password"
        name="password"
        label="Password"
        placeholder="Enter your password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        icon={<span aria-hidden="true">*</span>}
      />
    </AuthShell>
  );
}
