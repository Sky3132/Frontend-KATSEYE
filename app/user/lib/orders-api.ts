"use client";

import { api, asNumber, asString, unwrapList, unwrapObject } from "../../lib/api";
import type {
  AccountOrder,
  AccountOrderAddress,
  AccountOrderStatus,
  AccountTrackingEvent,
} from "./account-content";

const isLikelyPhoneNumber = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 7;
};

const pickPhoneNumber = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = asString(value, "").trim();
    if (text && isLikelyPhoneNumber(text)) return text;
  }
  return "";
};

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

  const street = asString(address.street || address.address || address.line1);
  const barangay = asString(address.barangay);
  const city = asString(address.city);
  const province = asString(address.province);
  const region = asString(address.region);
  const zipCode = asString(address.zip_code || address.zipCode || address.postal_code || address.postalCode);
  const country = asString(address.country);

  return [
    street,
    barangay,
    city,
    province,
    region,
    country,
    zipCode,
  ]
    .filter(Boolean)
    .join(", ");
};

const normalizeAddressRecord = (
  address: Record<string, unknown> | null,
): AccountOrderAddress | null => {
  if (!address) return null;
  const full_name = asString(address.full_name || address.fullName || address.name);
  const phone_e164 = asString(address.phone_e164 || address.phoneE164 || address.phone);
  const email = asString(address.email);
  const street = asString(address.street || address.address || address.line1);
  const barangay = asString(address.barangay);
  const city = asString(address.city);
  const province = asString(address.province);
  const region = asString(address.region);
  const zip_code = asString(
    address.zip_code || address.zipCode || address.postal_code || address.postalCode,
  );
  const country = asString(address.country);

  const hasAny =
    Boolean(full_name || phone_e164 || email || street || barangay || city || province || region || zip_code || country);
  if (!hasAny) return null;

  return {
    full_name,
    phone_e164,
    email,
    street,
    barangay,
    city,
    province,
    region,
    zip_code,
    country,
  };
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
  const addressRecord = normalizeAddressRecord(address);
  const addressIdRaw =
    record.address_id ?? record.addressId ?? address?.id ?? address?.address_id;
  const addressIdValue = asNumber(addressIdRaw, Number.NaN);
  const addressId =
    Number.isFinite(addressIdValue) && addressIdValue > 0
      ? addressIdValue
      : undefined;
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
    addressId,
    addressRecord,
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
    customerName: asString(addressRecord?.full_name || record.customer_name || record.name, "Customer"),
    contact: asString(addressRecord?.email || record.customer_email || record.email, ""),
    phone: pickPhoneNumber(
      addressRecord?.phone_e164,
      record.customer_phone,
      record.customerPhone,
      record.customer_contact_number,
      record.customerContactNumber,
      record.contact_number,
      record.contactNumber,
      record.phone,
      record.phone_number,
      record.phoneNumber,
      record.mobile,
      record.mobile_number,
      record.mobileNumber,
      address?.phone_e164,
      address?.phone,
      address?.phone_number,
      address?.phoneNumber,
      address?.mobile,
      address?.mobile_number,
      address?.mobileNumber,
      address?.contact_number,
      address?.contactNumber,
    ),
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
