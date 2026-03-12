"use client";

import CatalogPage from "../components/catalog-page";
import { useLiveProducts } from "../lib/use-live-products";

export default function ProductsPage() {
  const products = useLiveProducts();

  return (
    <CatalogPage
      eyebrow="Curated Catalog"
      title="All Products"
      description="Browse the latest KATSEYE products across the current catalog."
      products={products}
    />
  );
}
