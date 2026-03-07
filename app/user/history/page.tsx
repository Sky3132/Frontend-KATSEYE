"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  readCart,
  subscribeCart,
} from "../lib/cart";

type HistoryStatus = "active" | "upcoming" | "cancelled" | "received";

type TrackingEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  done: boolean;
};

type HistoryOrder = {
  id: string;
  status: HistoryStatus;
  trackingNo: string;
  courier: string;
  summary: string;
  deliveryDate: string;
  customerName: string;
  contact: string;
  address: string;
  seller: string;
  support: string;
  title: string;
  timeline: TrackingEvent[];
};

const statusTabs: { id: HistoryStatus; label: string }[] = [
  { id: "active", label: "Active Orders" },
  { id: "upcoming", label: "Upcoming" },
  { id: "cancelled", label: "Cancelled" },
  { id: "received", label: "Received" },
];

const orders: HistoryOrder[] = [
  {
    id: "ord-active-1",
    status: "active",
    trackingNo: "#34918713810",
    courier: "BLUE DART",
    summary: "Out for delivery",
    deliveryDate: "Expected on March 10, 2026",
    customerName: "Prashant Patil",
    contact: "+91 99987-87122",
    address: "306 North Plaza, South Motera, Ahmedabad - 380005",
    seller: "Katseye Klothes",
    support: "katseye@umgstores.com",
    title: "BEAUTIFUL CHAOS Hoodie",
    timeline: [
      { id: "1", date: "March 8, 2026", time: "8:30 AM", title: "Out For Delivery", location: "Ahmedabad, GJ", done: true },
      { id: "2", date: "March 7, 2026", time: "4:10 PM", title: "In Transit", location: "Mumbai, MH to Ahmedabad, GJ", done: true },
      { id: "3", date: "March 6, 2026", time: "11:00 AM", title: "Order Picked Up", location: "Mumbai, MH", done: true },
      { id: "4", date: "March 5, 2026", time: "5:20 PM", title: "Order Received", location: "Katseye Warehouse", done: true },
    ],
  },
  {
    id: "ord-upcoming-1",
    status: "upcoming",
    trackingNo: "#67292010388",
    courier: "DHL",
    summary: "Preparing shipment",
    deliveryDate: "Ships on March 14, 2026",
    customerName: "Amara Chen",
    contact: "+1 415-222-1988",
    address: "295 Sunset Drive, Los Angeles, CA 90012",
    seller: "Katseye Klothes",
    support: "katseye@umgstores.com",
    title: "Gabriela Rose Die-Cut 7\" Vinyl",
    timeline: [
      { id: "1", date: "March 8, 2026", time: "9:00 AM", title: "Payment Confirmed", location: "Online", done: true },
      { id: "2", date: "March 8, 2026", time: "9:05 AM", title: "Queued for Packing", location: "Katseye Warehouse", done: true },
      { id: "3", date: "March 14, 2026", time: "TBD", title: "Estimated Shipment", location: "Warehouse Dispatch", done: false },
    ],
  },
  {
    id: "ord-cancelled-1",
    status: "cancelled",
    trackingNo: "#10923388112",
    courier: "UPS",
    summary: "Cancelled",
    deliveryDate: "Cancelled on February 28, 2026",
    customerName: "Jules Rivera",
    contact: "+1 646-555-1900",
    address: "11 Bedford Ave, Brooklyn, NY 11222",
    seller: "Katseye Klothes",
    support: "katseye@umgstores.com",
    title: "Internet Girl Keypad Keyring",
    timeline: [
      { id: "1", date: "February 27, 2026", time: "6:20 PM", title: "Order Received", location: "Online", done: true },
      { id: "2", date: "February 28, 2026", time: "8:00 AM", title: "Cancelled", location: "Customer Request", done: true },
    ],
  },
  {
    id: "ord-received-1",
    status: "received",
    trackingNo: "#24011877190",
    courier: "FEDEX",
    summary: "Delivered",
    deliveryDate: "Delivered on March 1, 2026",
    customerName: "Irakli Lolashvili",
    contact: "+995 599 882244",
    address: "14 Liberty Street, Tbilisi 0114",
    seller: "Katseye Klothes",
    support: "katseye@umgstores.com",
    title: "KATSEYE Logo Beanie",
    timeline: [
      { id: "1", date: "March 1, 2026", time: "2:30 PM", title: "Delivered", location: "Tbilisi, GE", done: true },
      { id: "2", date: "March 1, 2026", time: "11:30 AM", title: "Out For Delivery", location: "Tbilisi, GE", done: true },
      { id: "3", date: "February 27, 2026", time: "4:45 PM", title: "In Transit", location: "Istanbul, TR", done: true },
      { id: "4", date: "February 26, 2026", time: "10:10 AM", title: "Order Picked Up", location: "Warehouse", done: true },
    ],
  },
];

export default function OrderHistoryPage() {
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const [activeTab, setActiveTab] = useState<HistoryStatus>("active");
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");

  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === activeTab),
    [activeTab],
  );

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#111] transition-colors dark:bg-[#060606] dark:bg-[radial-gradient(circle_at_top,rgba(118,100,26,0.16),transparent_16%),linear-gradient(180deg,#050505_0%,#090909_38%,#0b0b0a_100%)] dark:text-[#f0d34f]">
      <StoreHeader cartCount={cartCount} />

      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-3">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                const nextOrder = orders.find((order) => order.status === tab.id);
                setSelectedOrderId(nextOrder?.id ?? "");
              }}
              className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                  : "border border-neutral-300 bg-white text-neutral-700 dark:border-[#2c2817] dark:bg-[#090909] dark:text-[#cfbd78]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            <h2 className="text-xl font-semibold">Orders</h2>
            <div className="mt-4 space-y-3">
              {filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    selectedOrder?.id === order.id
                      ? "border-[#111827] bg-neutral-50 dark:border-[#f0d34f] dark:bg-[#11110f]"
                      : "border-neutral-200 dark:border-[#2c2817] dark:bg-[#0d0d0c]"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                    {order.courier}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{order.title}</p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">{order.summary}</p>
                  <p className="mt-2 text-xs text-neutral-400 dark:text-[#8e7727]">{order.trackingNo}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            {selectedOrder ? (
              <div className="grid gap-8 xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-6 border-b border-neutral-200 pb-6 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-6 dark:border-[#2c2817]">
                  <div className="rounded-[20px] bg-[#111827] px-4 py-3 text-white dark:bg-[#090909] dark:text-[#f0d34f]">
                    <p className="text-xs uppercase tracking-[0.18em]">Katseye Klothes</p>
                  </div>
                  <div className="space-y-5 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        Customer Name
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrder.customerName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        Customer Contact
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrder.contact}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        Delivery Address
                      </p>
                      <p className="mt-2 leading-7 text-neutral-600 dark:text-[#cfbd78]">{selectedOrder.address}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        Seller
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrder.seller}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        Seller Support
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrder.support}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-[#2c2817]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-[#8e7727]">
                        Tracking No.
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{selectedOrder.trackingNo}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-[#f0d34f]">
                      {selectedOrder.courier}
                    </p>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">Your order is</p>
                      <h1 className="mt-2 text-5xl font-semibold">
                        {selectedOrder.summary}
                      </h1>
                      <p className="mt-2 text-xl font-medium">{selectedOrder.deliveryDate}</p>
                      <p className="mt-4 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        Latest update shown below in the tracking history.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                      <button type="button" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-left text-sm dark:border-[#d6b736]">
                        Return Order
                      </button>
                      <button type="button" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-left text-sm dark:border-[#d6b736]">
                        Exchange Item
                      </button>
                      <div className="pt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        <p>For delivery queries</p>
                        <p className="mt-1 text-[#5647ff] dark:text-[#f0d34f]">Contact Us</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-[#2c2817]">
                    <h2 className="text-2xl font-semibold">Tracking History</h2>
                    <div className="mt-6 space-y-6">
                      {selectedOrder.timeline.map((event, index) => (
                        <div key={event.id} className="grid gap-4 md:grid-cols-[160px_24px_minmax(0,1fr)]">
                          <div className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                            <p>{event.date}</p>
                            <p>{event.time}</p>
                          </div>
                          <div className="relative flex justify-center">
                            <span
                              className={`relative z-10 mt-1 h-4 w-4 rounded-full border-4 ${
                                event.done
                                  ? "border-emerald-400 bg-emerald-500 dark:border-[#f0d34f] dark:bg-[#f0d34f]"
                                  : "border-neutral-300 bg-white dark:border-[#5d4f19] dark:bg-[#090909]"
                              }`}
                            />
                            {index < selectedOrder.timeline.length - 1 ? (
                              <span className="absolute top-5 h-[calc(100%+20px)] w-px bg-neutral-300 dark:bg-[#2c2817]" />
                            ) : null}
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{event.title}</p>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">{event.location}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-[#d6b736]/35">
                <p className="text-lg font-semibold">No orders in this section yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
