"use client";

import { api, asNumber, asString, unwrapList, unwrapObject } from "../../lib/api";
import type { AccountOrder, AccountOrderStatus, AccountTrackingEvent } from "./account-content";

const getStatus = (value: unknown): AccountOrderStatus => {
  const normalized = asString(value, "active").toLowerCase();
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("deliver") || normalized.includes("receive") || normalized.includes("complete")) return "received";
  if (normalized.includes("ship") || normalized.includes("transit") || normalized.includes("out_for_delivery")) {
    return "upcoming";
  }
  // "pending"/"processing"/"paid" are still being prepared -> Active Orders.
  if (
    normalized.includes("pending") ||
    normalized.includes("process") ||
    normalized.includes("prepar") ||
    normalized.includes("paid")
  ) {
    return "active";
  }
  return "active";
};

const buildAddress = (address: Record<string, unknown> | null) => {
  if (!address) return "No address provided";
  return [
    asString(address.street),
    asString(address.barangay),
    asString(address.city),
    asString(address.province),
    asString(address.zip_code),
    asString(address.country),
  ]
    .filter(Boolean)
    .join(", ");
};

const buildTimeline = (record: Record<string, unknown>): AccountTrackingEvent[] => {
  const createdAt = asString(record.created_at || record.createdAt);
  if (!createdAt) {
    return [
      {
        id: `${asString(record.id)}-received`,
        date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        title: "Order Received",
        location: "Online",
        done: true,
      },
    ];
  }

  const date = new Date(createdAt);
  return [
    {
      id: `${asString(record.id)}-received`,
      date: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      title: "Order Received",
      location: "Online",
      done: true,
    },
  ];
};

const normalizeOrder = (value: unknown): AccountOrder | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const address = unwrapObject(record.address);
  const shipment = unwrapObject(record.shipment);
  const items = Array.isArray(record.order_items) ? record.order_items : Array.isArray(record.items) ? record.items : [];
  const firstItem = unwrapObject(items[0]);
  const firstItemProduct = unwrapObject(firstItem?.product);
  const title = asString(firstItem?.product_title || firstItem?.title || firstItem?.name, "KATSEYE Order");
  const rawStatus = asString(record.status || "");
  const shipmentStatus = asString(shipment?.status || "");
  const status = getStatus([rawStatus, shipmentStatus].filter(Boolean).join(" "));
  const image = asString(
    firstItemProduct?.imgsrc ||
      firstItemProduct?.imgSrc ||
      firstItemProduct?.image_url ||
      firstItemProduct?.imageUrl ||
      firstItem?.imgsrc ||
      firstItem?.imgSrc ||
      firstItem?.image_url ||
      firstItem?.imageUrl,
    "",
  );

  return {
    id: asString(record.id),
    status,
    rawStatus,
    shipmentStatus,
    trackingNo: asString(shipment?.tracking_number || record.tracking_no, `#${asString(record.id)}`),
    courier: asString(shipment?.courier || record.courier, "Shipment Pending"),
    summary:
      status === "received"
        ? "Delivered"
        : status === "cancelled"
          ? "Cancelled"
          : status === "upcoming"
            ? "Shipped"
            : rawStatus.toLowerCase().includes("paid")
              ? "Paid"
              : "Preparing shipment",
    deliveryDate:
      status === "received"
        ? "Delivered"
        : status === "cancelled"
          ? "Cancelled"
          : status === "upcoming"
            ? "In transit"
            : "Processing shipment",
    customerName: asString(record.customer_name || record.name, "Customer"),
    contact: asString(record.customer_email || record.email, ""),
    address: buildAddress(address),
    seller: "Katseye Klothes",
    support: "katseye@umgstores.com",
    title,
    image,
    paymentMethod: asString(record.payment_method, "Cash on Delivery"),
    total: asNumber(record.total_amount, asNumber(record.total)),
    timeline: buildTimeline(record),
  };
};

export async function fetchOrders(): Promise<AccountOrder[]> {
  const response = await api("/api/orders");
  return unwrapList(response).map(normalizeOrder).filter((item): item is AccountOrder => item !== null);
}

export async function cancelOrder(orderId: string): Promise<void> {
  const payload = { status: "cancelled" };

  try {
    await api(`/api/orders/${orderId}/cancel`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Fallback for backends that expose status updates on a generic route.
    if (message !== "HTTP_404" && message !== "HTTP_405") throw error;
  }

  await api(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
