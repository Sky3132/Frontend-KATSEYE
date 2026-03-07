"use client";

import CatalogPage from "../components/catalog-page";
import { products } from "../lib/products";

export default function ProductsPage() {
  return (
    <CatalogPage
      eyebrow="Curated Catalog"
      title="All Products"
      description="Browse the latest KATSEYE products across the current catalog."
      products={products}
    />
  );
}
