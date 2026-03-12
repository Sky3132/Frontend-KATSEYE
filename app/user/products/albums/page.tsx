"use client";

import CatalogPage from "../../components/catalog-page";
import { useLiveProducts } from "../../lib/use-live-products";

export default function AlbumsPage() {
  const products = useLiveProducts({
    filter: (item) => item.category === "album",
  });

  return (
    <CatalogPage
      eyebrow="Music Collection"
      title="Albums"
      description="Shop KATSEYE music releases, vinyl, CDs, and digital albums from the official collection."
      products={products}
    />
  );
}
