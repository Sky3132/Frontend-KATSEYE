"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AuthShell from "../auth-shell";
import { AuthField } from "../auth-fields";
import { api } from "../../../lib/api";

type RegisterRole = "user" | "admin";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RegisterRole>("user");
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const shouldShowConfirmPassword =
    isPasswordFocused ||
    password.trim().length > 0 ||
    confirmPassword.trim().length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const mail = email.trim();
    const nextRole = role;
    const code = adminCode.trim();
    const pass = password.trim();
    const confirm = confirmPassword.trim();

    if (!mail || !pass || !confirm) {
      setErrorMessage("Please complete all fields.");
      return;
    }

    if (nextRole === "admin" && !code) {
      setErrorMessage("Admin accounts require an admin code.");
      return;
    }

    if (pass.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (pass !== confirm) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api("/api/users/register", {
        method: "POST",
        body: JSON.stringify({
          email: mail,
          password: pass,
          role: nextRole,
          adminCode: nextRole === "admin" ? code : undefined,
        }),
      });

      setSuccessMessage(
        "Account created successfully. Redirecting to sign in...",
      );
      setEmail("");
      setRole("user");
      setAdminCode("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to register right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      activeTab="register"
      title="Create Your Account"
      description="Join Katseye Klothes to save favorites, check out faster, and access exclusive drops."
      submitLabel={isSubmitting ? "Creating Account..." : "Sign Up"}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      successMessage={successMessage}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="role"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-black/55 dark:text-[#b59b39]"
          >
            Account Type
          </label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as RegisterRole)}
            className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-medium text-black outline-none transition focus:border-black/25 dark:border-[#2f2a16] dark:bg-[#11110f] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
          >
            <option value="user">Customer</option>
            <option value="admin">Admin</option>
          </select>
          <p className="text-xs text-black/45 dark:text-[#9f9156]">
            Admin access is enforced by the backend role from{" "}
            <span className="font-mono">/users/me</span>.
          </p>
        </div>

        <div
          className={`space-y-2 transition-all duration-200 ${
            role === "admin"
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0"
          }`}
        >
          <AuthField
            id="adminCode"
            name="adminCode"
            label="Admin Code"
            placeholder="Admin code"
            type="password"
            value={adminCode}
            onChange={(event) => setAdminCode(event.target.value)}
            hint="Required for admin accounts (backend enforced)"
          />
        </div>
      </div>

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
        placeholder="Create a password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onFocus={() => setIsPasswordFocused(true)}
        onBlur={() => setIsPasswordFocused(false)}
        hint="Minimum 6 characters"
        icon={<span aria-hidden="true">*</span>}
      />

      <div className="min-h-[92px]">
        <div
          className={`transition-all duration-200 ${
            shouldShowConfirmPassword
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0"
          }`}
        >
          <AuthField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Repeat your password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            icon={<span aria-hidden="true">*</span>}
          />
        </div>
      </div>
    </AuthShell>
  );
}
