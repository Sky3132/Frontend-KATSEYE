import CatalogPage from "../../../components/catalog-page";
import { getProductsBySubcategory } from "../../../lib/products";

const categoryMeta = {
  hoodies: {
    eyebrow: "Merch Category",
    title: "Hoodies",
    description: "Official KATSEYE hoodie merch, including Internet Girl and Beautiful Chaos releases.",
  },
  "t-shirts": {
    eyebrow: "Merch Category",
    title: "T-Shirts",
    description: "Official KATSEYE T-shirts and baby tees from the merch collection.",
  },
  caps: {
    eyebrow: "Merch Category",
    title: "Caps",
    description: "Official KATSEYE caps, hats, and beanie products.",
  },
  keychain: {
    eyebrow: "Accessories Collection",
    title: "Keychain",
    description: "Official KATSEYE keychain and keyring products.",
  },
  "photo-strip": {
    eyebrow: "Accessories Collection",
    title: "Photo Strip",
    description: "Official KATSEYE photo strip products and collectible photo packages.",
  },
  "wrapping-paper": {
    eyebrow: "Accessories Collection",
    title: "Wrapping Paper",
    description: "Official KATSEYE wrapping paper products.",
  },
  "slogan-muffler": {
    eyebrow: "Accessories Collection",
    title: "Slogan Muffler",
    description: "Official KATSEYE slogan muffler and scarf products.",
  },
  accessories: {
    eyebrow: "Accessories Collection",
    title: "Accessories",
    description: "Official KATSEYE accessories including keychains, photo strips, wrapping paper, and slogan mufflers.",
  },
} as const;

type ProductCategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductCategoryPage({ params }: ProductCategoryPageProps) {
  const { slug } = await params;
  const key = slug as keyof typeof categoryMeta;
  const meta = categoryMeta[key];

  if (!meta) {
    return (
      <CatalogPage
        eyebrow="Merch Category"
        title="Category Not Found"
        description="This category is not available in the current catalog."
        products={[]}
      />
    );
  }

  return (
    <CatalogPage
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      products={slug === "accessories" ? getProductsByCategory("accessories") : getProductsBySubcategory(slug)}
    />
  );
}
