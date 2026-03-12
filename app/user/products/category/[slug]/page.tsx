"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CatalogPage from "../../../components/catalog-page";
import { type Product } from "../../../lib/catalog-api";
import { fetchCategoriesTree, type CategoryNode } from "../../../lib/categories-api";
import { useLiveProducts } from "../../../lib/use-live-products";
import { useStoreSettings } from "../../../lib/store-settings";

const findNodeBySlug = (nodes: CategoryNode[], slug: string): CategoryNode | null => {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findNodeBySlug(node.children, slug);
    if (child) return child;
  }
  return null;
};

export default function ProductCategoryPage() {
  const { translateCategoryText } = useStoreSettings();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchCategoriesTree()
      .then((items) => {
        if (cancelled) return;
        setCategories(items);
      })
      .catch(() => {
        if (cancelled) return;
        setCategories([]);
      })
      .finally(() => {
        if (cancelled) return;
        setCategoriesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const node = useMemo(() => findNodeBySlug(categories, slug), [categories, slug]);
  const categoryIds = useMemo(() => {
    if (!node) return new Set<string>();
    if (node.children.length === 0) return new Set([node.id]);
    return new Set(node.children.map((child) => child.id));
  }, [node]);

  const filter = useMemo(() => {
    return (item: Product) => {
      if (categoryIds.size > 0) return categoryIds.has(item.categoryId);
      // Fallback for backends that haven't shipped category ids to products yet.
      return item.subcategory === slug;
    };
  }, [categoryIds, slug]);

  const products = useLiveProducts({ filter, deps: [slug] });

  if (categoriesLoaded && !node) {
    return (
      <CatalogPage
        eyebrow="Our Product"
        title="Category Not Found"
        description="This category is not available in the current catalog."
        products={[]}
      />
    );
  }

  return (
    <CatalogPage
      eyebrow={node?.children.length ? node.name : "Our Product"}
      title={node ? translateCategoryText(node.name) : "Loading…"}
      description={
        node
          ? `Browse products in ${translateCategoryText(node.name)}.`
          : "Loading category…"
      }
      products={products}
    />
  );
}
