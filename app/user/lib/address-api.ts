"use client";

import { api, asString, unwrapList, unwrapObject } from "../../lib/api";

export type Address = {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  is_default?: boolean;
  country_code?: string;
  region_id?: string;
  province_id?: string;
  city_id?: string;
  district_id?: string;
  country: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  zip_code: string;
  street: string;
};

export type CreateAddressInput = {
  full_name: string;
  email: string;
  phone?: string;
  street: string;
  zip_code: string;
  country_code: string; // ISO2
  region_id?: string;
  province_id?: string;
  city_id?: string;
  district_id?: string;
  is_default?: boolean;
};

export type UpdateAddressInput = Partial<CreateAddressInput>;

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
    phone: record.phone
      ? asString(record.phone)
      : record.phone_e164
        ? asString(record.phone_e164)
      : record.phone_number
        ? asString(record.phone_number)
        : undefined,
    is_default:
      typeof record.is_default === "boolean"
        ? record.is_default
        : typeof record.isDefault === "boolean"
          ? record.isDefault
          : undefined,
    country_code: asString(record.country_code || record.countryCode) || undefined,
    region_id: asString(record.region_id || record.regionId) || undefined,
    province_id: asString(record.province_id || record.provinceId) || undefined,
    city_id: asString(record.city_id || record.cityId) || undefined,
    district_id: asString(record.district_id || record.districtId) || undefined,
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

export async function createAddress(
  input: CreateAddressInput,
): Promise<Address | null> {
  const response = await api("/api/address", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return normalizeAddress(response);
}

export async function updateAddress(
  addressId: number,
  input: UpdateAddressInput,
): Promise<Address | null> {
  const response = await api(`/api/address/${addressId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return normalizeAddress(response);
}

export async function deleteAddress(addressId: number): Promise<void> {
  await api(`/api/address/${addressId}`, { method: "DELETE" });
}

export async function setDefaultAddress(addressId: number): Promise<void> {
  await api(`/api/address/${addressId}/default`, { method: "PATCH" });
}
