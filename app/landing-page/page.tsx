"use client";

import { useRouter } from "next/navigation";

const products = [
  {
    id: 1,
    name: "Eclipse Logo Tee",
    brand: "Eclipse",
    price: "$28.99",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    name: 'Nova "Galaxy" Tour Hoodie',
    brand: "Nova",
    price: "$84.99",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    name: "Starlight Signature Cap",
    brand: "Starlight",
    price: "$22.99",
    image:
      "https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=900&q=80",
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f8f8f8] text-[#121212]">
      <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
            KK
          </span>
          <span className="text-3xl font-semibold">Katseye Klothes</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-xl border border-neutral-300 px-5 py-2 text-xl"
            type="button"
            onClick={() => router.push("/login")}
          >
            Log In
          </button>
          <button
            className="rounded-xl bg-black px-5 py-2 text-xl text-white"
            type="button"
            onClick={() => router.push("/login/register")}
          >
            Sign Up
          </button>
          <span className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em]">
            Cart
          </span>
        </div>
      </header>

      <section
        className="relative flex h-[560px] items-center justify-center bg-no-repeat px-6"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42)), url('https://d1ef7ke0x2i9g8.cloudfront.net/hong-kong/_large700/5695725/KATSEYE-x-Gap.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      >
        <div className="max-w-4xl text-center text-white">
          <h1 className="text-7xl font-semibold tracking-tight">Style the Vision</h1>
          <p className="mt-5 text-3xl leading-relaxed text-neutral-100">
            Discover the exclusive collection of Katseye apparel, accessories, and more.
            Wear the moment.
          </p>
          <button
            className="mt-8 rounded-xl bg-black px-10 py-4 text-2xl font-semibold text-white"
            type="button"
            onClick={() => router.push("/login")}
          >
            Shop The Collection
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 py-14">
        <h2 className="mb-10 text-center text-7xl font-semibold tracking-tight">You might also like</h2>
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:-translate-y-1 hover:shadow-xl"
              type="button"
              onClick={() => router.push("/login")}
            >
              <div
                className="h-[430px] w-full bg-cover bg-center"
                style={{ backgroundImage: `url('${product.image}')` }}
              />
              <div className="space-y-2 p-6">
                <h3 className="text-4xl font-semibold">{product.name}</h3>
                <p className="text-2xl text-neutral-500">{product.brand}</p>
                <p className="text-4xl font-semibold">{product.price}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
