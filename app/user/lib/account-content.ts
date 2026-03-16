"use client";

import { USER_STORAGE_KEY } from "../../lib/auth";

export type AccountSection = "profile" | "password" | "addresses" | "orders" | "notifications";

export type AccountAddress = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city?: string;
  country?: string;
  region?: string;
  province?: string;
  barangay?: string;
  postalCode?: string;
  isDefault: boolean;
};

export type AccountOrderStatus = "active" | "upcoming" | "cancelled" | "received";

export type AccountTrackingEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  done: boolean;
};

export type AccountOrderAddress = {
  full_name?: string;
  phone_e164?: string;
  email?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  region?: string;
  zip_code?: string;
  country?: string;
};

export type AccountOrder = {
  id: string;
  status: AccountOrderStatus;
  rawStatus?: string;
  shipmentStatus?: string;
  addressId?: number;
  addressRecord?: AccountOrderAddress | null;
  trackingNo: string;
  courier: string;
  summary: string;
  deliveryDate: string;
  customerName: string;
  contact: string;
  phone?: string;
  address: string;
  seller: string;
  support: string;
  title: string;
  image?: string;
  paymentMethod: string;
  total: number;
  timeline: AccountTrackingEvent[];
};

export const ADDRESS_STORAGE_KEY = "katseye_addresses";
export const ORDERS_STORAGE_KEY = "katseye_orders";

export const accountOrders: AccountOrder[] = [
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
    paymentMethod: "Credit / Debit Card",
    total: 90,
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
    paymentMethod: "PayPal",
    total: 22.98,
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
    paymentMethod: "GCash",
    total: 28,
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
    paymentMethod: "Cash on Delivery",
    total: 24.99,
    timeline: [
      { id: "1", date: "March 1, 2026", time: "2:30 PM", title: "Delivered", location: "Tbilisi, GE", done: true },
      { id: "2", date: "March 1, 2026", time: "11:30 AM", title: "Out For Delivery", location: "Tbilisi, GE", done: true },
      { id: "3", date: "February 27, 2026", time: "4:45 PM", title: "In Transit", location: "Istanbul, TR", done: true },
      { id: "4", date: "February 26, 2026", time: "10:10 AM", title: "Order Picked Up", location: "Warehouse", done: true },
    ],
  },
];

export const notificationImages = [
  "https://shop.katseye.world/cdn/shop/files/GabrielaVinyl_Packshot-02.png?v=1762829862&width=1000",
  "https://shop.katseye.world/cdn/shop/files/Beautiful_Official_Store_KATSEYE_CD_Thumbnail.png?v=1749663626&width=1000",
  "https://shop.katseye.world/cdn/shop/files/Revised_Hoodie_Front.png?v=1767914137&width=1200",
  "https://shop.katseye.world/cdn/shop/files/Katseye_Folder_Front.png?v=1767914832&width=1200",
  "https://shop.katseye.world/cdn/shop/files/Katseye_BallCap_Front.png?v=1767914670&width=1200",
];

const getScopedStorageKey = (baseKey: string) => {
  if (typeof window === "undefined") return baseKey;

  try {
    const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return `${baseKey}:guest`;

    const parsed = JSON.parse(rawUser) as { id?: string; email?: string; name?: string };
    const scope = parsed.id ?? parsed.email ?? parsed.name;
    return scope ? `${baseKey}:${scope}` : `${baseKey}:guest`;
  } catch {
    return `${baseKey}:guest`;
  }
};

export const readStoredAddresses = (): AccountAddress[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(ADDRESS_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountAddress[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeStoredAddresses = (addresses: AccountAddress[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getScopedStorageKey(ADDRESS_STORAGE_KEY), JSON.stringify(addresses));
  window.dispatchEvent(new Event("storage"));
};

export const readStoredOrders = (): AccountOrder[] => {
  if (typeof window === "undefined") return accountOrders;

  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return accountOrders;
    const parsed = JSON.parse(raw) as AccountOrder[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : accountOrders;
  } catch {
    return accountOrders;
  }
};

export const writeStoredOrders = (orders: AccountOrder[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("storage"));
};
