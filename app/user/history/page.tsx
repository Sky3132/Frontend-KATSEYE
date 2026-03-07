"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  readCart,
  subscribeCart,
} from "../lib/cart";

type OrderStatus = "orders" | "not-shipped" | "cancelled";

type OrderItem = {
  id: string;
  title: string;
  subtitle: string;
  deliveryLabel: string;
  returnLabel: string;
  image: string;
};

type OrderCard = {
  id: string;
  placedDate: string;
  total: string;
  shipTo: string;
  orderNumber: string;
  status: OrderStatus;
  timeframe: "3m" | "2026" | "2025";
  alert?: string;
  summary: string;
  note: string;
  items: OrderItem[];
};

const statusTabs: { id: OrderStatus; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "not-shipped", label: "Not Yet Shipped" },
  { id: "cancelled", label: "Cancelled Orders" },
];

const orders: OrderCard[] = [
  {
    id: "ord-1001",
    placedDate: "June 2, 2026",
    total: "$157.99",
    shipTo: "Irakli Lolashvili",
    orderNumber: "112-0822160-5390023",
    status: "orders",
    timeframe: "3m",
    alert: "Please rate your experience with the seller",
    summary: "Delivered June 5",
    note: "Your package was delivered safely at the front door.",
    items: [
      {
        id: "ord-1001-item-1",
        title: "Nova Galaxy Tour Hoodie",
        subtitle: "Heavyweight fleece hoodie with oversized tour graphic.",
        deliveryLabel: "Delivered",
        returnLabel: "Return or replace items: Eligible through July 5, 2026",
        image:
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "ord-1001-item-2",
        title: "Orbit Track Pants",
        subtitle: "Slim tapered track pants with side stripe detail.",
        deliveryLabel: "Delivered",
        returnLabel: "Return or replace items: Eligible through July 5, 2026",
        image:
          "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "ord-1002",
    placedDate: "May 21, 2026",
    total: "$94.50",
    shipTo: "Amara Chen",
    orderNumber: "112-1945630-1204418",
    status: "not-shipped",
    timeframe: "3m",
    summary: "Estimated delivery June 12",
    note: "We are preparing your shipment and will email tracking once it leaves the warehouse.",
    items: [
      {
        id: "ord-1002-item-1",
        title: "Moonrise Zip Jacket",
        subtitle: "Water-resistant zip jacket with mesh-lined pockets.",
        deliveryLabel: "Preparing shipment",
        returnLabel: "Track updates will appear here once the carrier scans the parcel.",
        image:
          "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "ord-1003",
    placedDate: "December 18, 2025",
    total: "$36.50",
    shipTo: "Amara Chen",
    orderNumber: "112-4439087-0182204",
    status: "cancelled",
    timeframe: "2025",
    summary: "Cancelled December 19",
    note: "This order was cancelled before shipment and no payment was captured.",
    items: [
      {
        id: "ord-1003-item-1",
        title: "Pulse Cargo Shorts",
        subtitle: "Quick-dry cargo shorts with adjustable hem tabs.",
        deliveryLabel: "Cancelled",
        returnLabel: "If you still want this item, place a new order from the products page.",
        image:
          "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
];

export default function OrderHistoryPage() {
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<OrderStatus>("orders");
  const [periodFilter, setPeriodFilter] = useState("3m");

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesTab = activeTab === "orders" ? order.status === "orders" : order.status === activeTab;
      const matchesPeriod = periodFilter === "all" ? true : order.timeframe === periodFilter;
      const matchesQuery =
        !query ||
        [
          order.orderNumber,
          order.shipTo,
          order.summary,
          ...order.items.flatMap((item) => [item.title, item.subtitle]),
        ].some((value) => value.toLowerCase().includes(query));

      return matchesTab && matchesPeriod && matchesQuery;
    });
  }, [activeTab, periodFilter, searchQuery]);

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#111]">
      <StoreHeader cartCount={cartCount} onCartClick={() => {}} />

      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-4xl font-semibold tracking-tight">Your Orders</h1>
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-600">
                        {filteredOrders.length}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      Review recent purchases, cancelled orders, and pending shipments.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <span className="mr-3 text-sm text-neutral-400">Search</span>
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search orders"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                      />
                    </label>
                    <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                      <select
                        value={periodFilter}
                        onChange={(event) => setPeriodFilter(event.target.value)}
                        className="w-full bg-transparent outline-none"
                      >
                        <option value="3m">Past 3 Months</option>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="all">All Time</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-1">
                  {statusTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-xl px-5 py-3 text-sm font-medium transition ${
                        activeTab === tab.id
                          ? "bg-white text-black shadow-sm"
                          : "text-neutral-500 hover:text-black"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 space-y-6">
                {filteredOrders.map((order) => (
                  <article key={order.id} className="overflow-hidden rounded-[28px] border border-neutral-200">
                    <div className="grid gap-4 bg-neutral-50 px-6 py-5 text-sm text-neutral-600 md:grid-cols-[160px_120px_1fr_auto]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Order placed
                        </p>
                        <p className="mt-1 text-lg font-semibold text-black">{order.placedDate}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Total
                        </p>
                        <p className="mt-1 text-lg font-semibold text-black">{order.total}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Ship to
                        </p>
                        <p className="mt-1 text-lg font-semibold text-black">{order.shipTo}</p>
                      </div>
                      <div className="md:text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                          Order #
                        </p>
                        <p className="mt-1 text-base font-semibold text-black">{order.orderNumber}</p>
                        <div className="mt-2 flex gap-4 text-sm text-emerald-700 md:justify-end">
                          <button type="button" className="hover:text-emerald-900">
                            View order details
                          </button>
                          <button type="button" className="hover:text-emerald-900">
                            View invoice
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white px-6 py-6">
                      {order.alert ? (
                        <div className="mb-5 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <span>{order.alert}</span>
                          <button type="button" className="text-base leading-none">
                            ×
                          </button>
                        </div>
                      ) : null}

                      <h2 className="text-3xl font-semibold tracking-tight text-black">{order.summary}</h2>
                      <p className="mt-2 text-sm text-neutral-500">{order.note}</p>

                      <div className="mt-6 space-y-6">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="grid gap-5 border-t border-neutral-200 pt-6 md:grid-cols-[110px_minmax(0,1fr)]"
                          >
                            <div
                              className="h-[110px] rounded-2xl border border-neutral-200 bg-cover bg-center"
                              style={{ backgroundImage: `url('${item.image}')` }}
                            />
                            <div>
                              <h3 className="text-2xl font-semibold leading-tight text-black">
                                {item.title}
                              </h3>
                              <p className="mt-2 max-w-2xl text-sm text-neutral-500">{item.subtitle}</p>
                              <p className="mt-3 text-sm font-medium text-neutral-700">{item.deliveryLabel}</p>
                              <p className="mt-1 text-sm text-neutral-500">{item.returnLabel}</p>
                              <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                                >
                                  Buy it again
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-black"
                                >
                                  View your item
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-black"
                                >
                                  Track package
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}

                {filteredOrders.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
                    <p className="text-lg font-semibold text-black">No orders match your filters.</p>
                    <p className="mt-2 text-sm text-neutral-500">
                      Change the search text, timeframe, or order status to see more history.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-semibold text-emerald-700">
              CS
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-black">
              Send us a message
            </h2>
            <p className="mt-3 text-sm leading-7 text-neutral-500">
              If you cannot find a recent order or need help with a shipment, contact support and
              we will reply with the next steps.
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
            >
              Send us a message
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
