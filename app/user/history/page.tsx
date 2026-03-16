"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  readCart,
  subscribeCart,
} from "../lib/cart";
import { fetchMyAddresses, type Address } from "../lib/address-api";
import { fetchOrders } from "../lib/orders-api";
import { useStoreSettings } from "../lib/store-settings";
import type { AccountOrder, AccountOrderStatus } from "../lib/account-content";
import { api, asString, unwrapObject } from "../../lib/api";

type MeProfile = {
  id?: string;
  role?: string;
  name?: string;
  email?: string;
  full_name?: string;
  phone_e164?: string;
};

export default function OrderHistoryPage() {
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const { t } = useStoreSettings();
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [activeTab, setActiveTab] = useState<AccountOrderStatus>("active");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const statusTabs = [
    { id: "active" as const, label: t("activeOrders") },
    { id: "upcoming" as const, label: t("upcoming") },
    { id: "cancelled" as const, label: t("cancelled") },
    { id: "received" as const, label: t("received") },
  ];

  useEffect(() => {
    void fetchOrders()
      .then((items) => {
        setOrders(items);
        setSelectedOrderId(items[0]?.id ?? "");
      })
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const items = await fetchMyAddresses();
        if (!cancelled) setAddresses(items);
      } catch {
        if (!cancelled) setAddresses([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = (await api("/api/users/me")) as unknown;
        const record = unwrapObject(response) ?? {};
        const meRecord = (unwrapObject(record.user) ?? record) as MeProfile;
        if (!cancelled) setMe(meRecord);
      } catch {
        if (!cancelled) setMe(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === activeTab),
    [activeTab, orders],
  );

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;

  const selectedOrderAddress = useMemo(() => {
    if (!selectedOrder?.addressId) return null;
    return addresses.find((addr) => addr.id === selectedOrder.addressId) ?? null;
  }, [addresses, selectedOrder]);

  const selectedOrderAddressLabel = useMemo(() => {
    if (!selectedOrderAddress) return "";
    return [
      selectedOrderAddress.street,
      selectedOrderAddress.barangay,
      selectedOrderAddress.city,
      selectedOrderAddress.province,
      selectedOrderAddress.region,
      selectedOrderAddress.country,
      selectedOrderAddress.zip_code,
    ]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }, [selectedOrderAddress]);

  const selectedOrderCustomerName = useMemo(() => {
    if (!selectedOrder) return "Customer";
    return (
      asString(selectedOrderAddress?.full_name) ||
      asString(selectedOrder.addressRecord?.full_name) ||
      asString(me?.full_name) ||
      asString(me?.name) ||
      "Customer"
    );
  }, [me?.full_name, me?.name, selectedOrder, selectedOrderAddress?.full_name]);

  const selectedOrderCustomerContact = useMemo(() => {
    if (!selectedOrder) return "";
    return (
      asString(selectedOrderAddress?.phone) ||
      asString(selectedOrder.addressRecord?.phone_e164) ||
      asString(me?.phone_e164) ||
      asString(selectedOrderAddress?.email) ||
      asString(selectedOrder.addressRecord?.email) ||
      asString(me?.email) ||
      ""
    );
  }, [
    me?.email,
    me?.phone_e164,
    selectedOrder,
    selectedOrderAddress?.email,
    selectedOrderAddress?.phone,
  ]);

  const selectedOrderCustomerEmail = useMemo(() => {
    if (!selectedOrder) return "";
    return (
      asString(selectedOrderAddress?.email) ||
      asString(selectedOrder.addressRecord?.email) ||
      asString(me?.email) ||
      ""
    );
  }, [me?.email, selectedOrder, selectedOrderAddress?.email]);

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
            <h2 className="text-xl font-semibold">{t("ordersLabel")}</h2>
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
                        {t("customerName")}
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrderCustomerName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        {t("customerContact")}
                      </p>
                      {selectedOrderCustomerContact ? (
                        <p className="mt-2 break-all text-base font-medium">
                          {selectedOrderCustomerContact}
                        </p>
                      ) : null}
                      {selectedOrderCustomerEmail &&
                      selectedOrderCustomerEmail !== selectedOrderCustomerContact ? (
                        <p className="mt-1 break-all text-sm font-medium text-neutral-500 dark:text-[#cfbd78]">
                          {selectedOrderCustomerEmail}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        {t("deliveryAddress")}
                      </p>
                      <p className="mt-2 leading-7 text-neutral-600 dark:text-[#cfbd78]">
                        {selectedOrderAddressLabel || selectedOrder.address}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        {t("seller")}
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrder.seller}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-[#8e7727]">
                        {t("sellerSupport")}
                      </p>
                      <p className="mt-2 text-base font-medium">{selectedOrder.support}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-[#2c2817]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-[#8e7727]">
                        {t("trackingNo")}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{selectedOrder.trackingNo}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-[#f0d34f]">
                      {selectedOrder.courier}
                    </p>
                  </div>

                  <div className="mt-6">
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">{t("yourOrderIs")}</p>
                      <h1 className="mt-2 text-5xl font-semibold">
                        {selectedOrder.summary}
                      </h1>
                      <p className="mt-2 text-xl font-medium">{selectedOrder.deliveryDate}</p>
                      <p className="mt-4 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        {t("latestTrackingUpdate")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-[#2c2817]">
                    <h2 className="text-2xl font-semibold">{t("trackingHistory")}</h2>
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
                <p className="text-lg font-semibold">{t("noOrdersYet")}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
