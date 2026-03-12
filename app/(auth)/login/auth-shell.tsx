"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import ThemeToggle from "../../components/theme-toggle";
import { products } from "../../user/lib/products";

type Slide = {
  title: string;
  eyebrow: string;
  price: string;
  description: string;
  image: string;
};

type SlideOptions = {
  eyebrow: string;
  title?: string;
  description?: string;
  image?: string;
};

const formatProductSlide = (productId: string, options: SlideOptions): Slide | null => {
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return null;
  }

  return {
    title: options.title ?? product.name,
    eyebrow: options.eyebrow,
    price: `$${product.price.toFixed(2)}`,
    description: options.description ?? product.description,
    image: options.image ?? product.image,
  };
};

const catalogSlides = [
  formatProductSlide("merch-001", {
    eyebrow: "Featured Hoodie",
    image:
      "https://shop.katseye.world/cdn/shop/files/Revised_Hoodie_Front.png?v=1767914137&width=1600",
  }),
  formatProductSlide("merch-006", {
    eyebrow: "T-Shirt Pick",
    title: "Internet Girl Baby Tee",
    image:
      "https://shop.katseye.world/cdn/shop/files/Revised_Baby_S_S_Shirt_Front.png?v=1767914253&width=1600",
  }),
  formatProductSlide("music-002", {
    eyebrow: "Album Release",
    image:
      "https://shop.katseye.world/cdn/shop/files/1000x1000_CD_Packshot-03_5784a25f-16dd-4ddd-bfe9-b5803c9ed33e.png?v=1746124525&width=1600",
  }),
].filter((slide): slide is Slide => slide !== null);

const slides: Slide[] = [
  {
    title: "Gap Collaboration Drop",
    eyebrow: "Featured Release",
    price: "$84.99",
    description:
      "Limited-edition Katseye outerwear with bold silhouettes, clean layers, and a stadium-ready finish.",
    image:
      "https://d1ef7ke0x2i9g8.cloudfront.net/hong-kong/_large700/5695725/KATSEYE-x-Gap.webp",
  },
  ...catalogSlides,
];

type AuthShellProps = {
  activeTab: "login" | "register";
  title: string;
  description: string;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage?: string;
  successMessage?: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
};

const socialProviders = [
  {
    id: "gmail",
    label: "Gmail",
    content: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3.75 6.75L12 13.5L20.25 6.75" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.5 7.5V18H8.25V11.25L12 14.25L15.75 11.25V18H19.5V7.5" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.5 18V7.5L8.25 10.5V18" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19.5 18V7.5L15.75 10.5V18" stroke="#FBBC05" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  { id: "apple", label: "Apple", content: "A" },
  { id: "facebook", label: "Facebook", content: "F" },
  { id: "x", label: "X", content: "X" },
] as const;

export default function AuthShell({
  activeTab,
  title,
  description,
  submitLabel,
  isSubmitting,
  errorMessage,
  successMessage,
  onSubmit,
  children,
}: AuthShellProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[#f3f3f1] px-4 py-4 text-[#121212] transition-colors dark:bg-[#090909] dark:bg-[radial-gradient(circle_at_top,rgba(112,95,25,0.14),transparent_20%),linear-gradient(180deg,#080808_0%,#0c0c0b_100%)] dark:text-[#f1d04b] sm:px-6 lg:px-8">
      <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-[1560px] rounded-[32px] border border-black/10 bg-[#efefeb] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.08)] transition-colors dark:border-[#2f2a16] dark:bg-[#0b0b0a]">
        <section className="flex w-full flex-col overflow-y-auto rounded-[28px] border border-black/10 bg-[#f8f8f5] px-6 py-6 transition-colors dark:border-[#2f2a16] dark:bg-[#090909] sm:px-10 lg:w-[48%] lg:px-12 lg:py-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold tracking-[0.28em] text-white dark:bg-[#f1d04b] dark:text-[#090909]">
              KK
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-black/55 dark:text-[#b59b39]">
                Katseye
              </p>
              <h1 className="text-xl font-semibold tracking-[-0.02em]">Katseye Klothes</h1>
            </div>
            </div>
            <ThemeToggle />
          </div>

          <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-8">
            <div className="text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.03em] text-black dark:text-[#f1d04b] sm:text-5xl">
                {title}
              </h2>
              <p className="mt-4 text-base leading-7 text-black/55 dark:text-[#c7ba81] sm:text-lg">{description}</p>
            </div>

            <div className="mt-8 grid grid-cols-2 rounded-2xl border border-black/10 bg-white p-1 text-sm font-medium dark:border-[#2f2a16] dark:bg-[#141412]">
              <Link
                href="/login"
                className={`rounded-[14px] px-4 py-3 text-center transition ${
                  activeTab === "login" ? "bg-[#121212] text-white dark:bg-[#f1d04b] dark:text-[#090909]" : "text-black/55 dark:text-[#c7ba81]"
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/login/register"
                className={`rounded-[14px] px-4 py-3 text-center transition ${
                  activeTab === "register" ? "bg-[#121212] text-white dark:bg-[#f1d04b] dark:text-[#090909]" : "text-black/55 dark:text-[#c7ba81]"
                }`}
              >
                Sign Up
              </Link>
            </div>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              {children}

              <button
                className="mt-2 h-14 w-full rounded-2xl bg-[#121212] text-base font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#f1d04b] dark:text-[#090909] dark:hover:bg-[#f7db63]"
                type="submit"
                disabled={isSubmitting}
              >
                {submitLabel}
              </button>
            </form>

            {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
            {successMessage ? <p className="mt-4 text-sm text-green-700">{successMessage}</p> : null}

            <div className="mt-8">
              <div className="flex items-center gap-3 text-sm text-black/40 dark:text-[#9f9156]">
                <span className="h-px flex-1 bg-black/10 dark:bg-[#f1d04b]/15" />
                <span>Continue with</span>
                <span className="h-px flex-1 bg-black/10 dark:bg-[#f1d04b]/15" />
              </div>

              <div className="mt-5 flex items-center justify-center gap-4">
                {socialProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    aria-label={`Continue with ${provider.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white text-sm font-semibold text-black transition hover:border-black/25 dark:border-[#2f2a16] dark:bg-[#11110f] dark:text-[#f1d04b]"
                  >
                    {provider.content}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-black/45 dark:text-[#9f9156]">
              <span>Copyright 2026 Katseye. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span>Terms &amp; Conditions</span>
                <span>Privacy Policy</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="relative hidden h-full overflow-hidden rounded-[28px] border border-white/10 lg:flex lg:w-[52%]">
          {slides.map((slide, index) => (
            <div
              key={slide.title}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
                index === activeSlide ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage: `linear-gradient(rgba(8, 8, 8, 0.58), rgba(8, 8, 8, 0.76)), url('${slide.image}')`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:72px_72px]" />

          <div className="relative flex min-h-full w-full flex-col justify-between p-10 xl:p-14">
            <div />

            <div className="mx-auto max-w-[560px] rounded-[28px] border border-white/12 bg-black/28 px-8 py-10 text-center text-white shadow-2xl backdrop-blur-md">
              <div className="relative min-h-[380px] pb-6">
                {slides.map((slide, index) => (
                  <div
                    key={slide.title}
                    className={`absolute inset-x-0 top-0 flex flex-col transition-opacity duration-700 ${
                      index === activeSlide ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/80">
                      {slide.eyebrow}
                    </p>
                    <h3 className="mx-auto mt-4 max-w-[12ch] text-balance text-3xl font-semibold leading-[0.95] tracking-[-0.04em] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)] sm:text-4xl xl:text-[3.25rem]">
                      {slide.title}
                    </h3>
                    <p className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-white/85">
                      {slide.price}
                    </p>
                    <p className="mt-5 px-2 text-base leading-7 text-white/88 xl:text-lg">
                      {slide.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex justify-center gap-3">
                {slides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    aria-label={`Show ${slide.title}`}
                    className={`h-1.5 rounded-full transition-all ${
                      index === activeSlide ? "w-24 bg-white" : "w-12 bg-white/35 hover:bg-white/55"
                    }`}
                    onClick={() => setActiveSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
