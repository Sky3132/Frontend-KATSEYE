"use client";

import { api, asString, unwrapList, unwrapObject } from "../../lib/api";

export type Address = {
  id: number;
  full_name: string;
  email: string;
  country: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  zip_code: string;
  street: string;
};

export type CreateAddressInput = Omit<Address, "id">;

const normalizeAddress = (value: unknown): Address | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const idRaw = record.id ?? record.address_id;
  const id = Number(asString(idRaw));
  if (!Number.isFinite(id) || id <= 0) return null;

  return {
    id,
    full_name: asString(record.full_name || record.fullName || record.name),
    email: asString(record.email),
    country: asString(record.country),
    region: asString(record.region),
    province: asString(record.province),
    city: asString(record.city),
    barangay: asString(record.barangay),
    zip_code: asString(record.zip_code || record.zipCode || record.postal_code),
    street: asString(record.street || record.address || record.line1),
  };
};

export async function fetchMyAddresses(): Promise<Address[]> {
  const response = await api("/api/address");
  return unwrapList(response)
    .map(normalizeAddress)
    .filter((item): item is Address => item !== null);
}

export async function createAddress(input: CreateAddressInput): Promise<Address | null> {
  const response = await api("/api/address", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return normalizeAddress(response);
}

