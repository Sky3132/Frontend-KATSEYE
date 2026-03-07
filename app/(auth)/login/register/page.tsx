"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AuthShell from "../auth-shell";
import { AuthField } from "../auth-fields";

const USERS_API_URL =
  "https://69a9318232e2d46caf457de9.mockapi.io/api/users/users";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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

    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim();
    const pass = password.trim();
    const confirm = confirmPassword.trim();

    if (!first || !last || !mail || !pass || !confirm) {
      setErrorMessage("Please complete all fields.");
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
      const response = await fetch(USERS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${first} ${last}`,
          email: mail,
          password: pass,
          role: "user",
          createdAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create account.");
      }

      setSuccessMessage(
        "Account created successfully. Redirecting to sign in...",
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch {
      setErrorMessage("Unable to register right now. Please try again.");
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
        <AuthField
          id="firstName"
          name="firstName"
          label="First Name"
          placeholder="First name"
          type="text"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <AuthField
          id="lastName"
          name="lastName"
          label="Last Name"
          placeholder="Last name"
          type="text"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
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
