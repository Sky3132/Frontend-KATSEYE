"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "./auth-shell";
import { AuthField } from "./auth-fields";
import {
  REFRESH_TOKEN_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from "../../lib/auth";

type LoginResponse = {
  id?: string | number;
  name?: string;
  email?: string;
  role?: string;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  tokens?: {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  user?: {
    id?: string | number;
    name?: string;
    email?: string;
    role?: string;
  };
  message?: string;
};

const LOGIN_API_URL = "http://localhost:3002/auth/users/login";
const getAccessToken = (data: LoginResponse | null) =>
  data?.accessToken ?? data?.token ?? data?.tokens?.accessToken ?? data?.tokens?.token ?? null;

const getRefreshToken = (data: LoginResponse | null) =>
  data?.refreshToken ?? data?.tokens?.refreshToken ?? null;

export default function LoginPage() {
  const router = useRouter();
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
      const response = await fetch(LOGIN_API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailValue,
          password: passwordValue,
        }),
      });

      let data: LoginResponse | null = null;
      try {
        data = (await response.json()) as LoginResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        setErrorMessage(data?.message ?? "Invalid credentials.");
        return;
      }

      const userPayload = data?.user ?? data ?? {};
      const accessToken = getAccessToken(data);
      const refreshToken = getRefreshToken(data);

      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({
          id: String(userPayload.id ?? ""),
          name: userPayload.name ?? "User",
          role: (userPayload.role ?? "user").toLowerCase(),
          email: userPayload.email ?? emailValue,
        })
      );
      if (accessToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }

      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      }

      router.push("/user/products");
    } catch {
      setErrorMessage("Unable to reach login service.");
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
