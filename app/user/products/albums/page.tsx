"use client";

import CatalogPage from "../../components/catalog-page";
import { getProductsByCategory } from "../../lib/products";

export default function AlbumsPage() {
  return (
    <CatalogPage
      eyebrow="Music Collection"
      title="Albums"
      description="Shop KATSEYE music releases, vinyl, CDs, and digital albums from the official collection."
      products={getProductsByCategory("album")}
    />
  );
}
