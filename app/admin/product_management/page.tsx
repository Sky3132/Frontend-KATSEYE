"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, asNumber, asString, unwrapObject } from "../../lib/api";
import {
  CURRENCY_STORAGE_KEY,
  currencyOptions,
  emitStoreSettingsChange,
  useStoreSettings,
  type StoreCurrency,
} from "../../user/lib/store-settings";
import {
  fetchAdminArchivedProducts,
  fetchAdminProducts,
  type Product as ManagedProduct,
} from "../../user/lib/catalog-api";
import { normalizeCategoriesTree, type CategoryNode } from "../../user/lib/categories-api";

type ProductFormState = {
  id: string;
  name: string;
  brand: string;
  price: string;
  stock: string;
  status: ManagedProduct["status"];
  category: ManagedProduct["category"];
  mainCategoryId: string;
  subcategoryId: string;
  description: string;
  details: string;
  sizes: string;
  image: string;
  gallery: string[];
};

type ToastState = { message: string; tone: "success" | "error" } | null;
type CategoryFilter = ManagedProduct["category"] | "all";
type SubcategoryFilter = string | "all";

type ConfirmDialogState =
  | {
      action: "archive" | "hard-delete";
      productId: string;
      productName: string;
    }
  | null;

const parseCommaList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinCommaList = (items: string[]) => items.join(", ");

const resolveTopLevelCategory = (label: string): ManagedProduct["category"] => {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("album") || normalized.includes("music") || normalized.includes("vinyl") || normalized.includes("cd")) {
    return "album";
  }
  if (
    normalized.includes("access") ||
    normalized === "categories" ||
    normalized === "category"
  ) {
    return "accessories";
  }
  return "cloth";
};

const formatMainCategoryName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase();
  if (normalized === "categories" || normalized === "category") return "ACCESSORIES";
  if (normalized === "album") return "ALBUM";
  return trimmed;
};

const formatCategoryLabel = (category: ManagedProduct["category"]) => {
  if (category === "cloth") return "Apparel";
  if (category === "album") return "Album";
  return "Accessories";
};

const getStockButtonMeta = (stock: number) => {
  if (stock <= 0) {
    return {
      label: "Out of stock",
      className:
        "border-rose-200 text-rose-600 dark:border-rose-500/30 dark:text-rose-300",
      disabled: true,
    };
  }
  if (stock < 20) {
    return {
      label: "Low stock",
      className:
        "border-rose-200 text-rose-600 dark:border-rose-500/30 dark:text-rose-300",
      disabled: false,
    };
  }
  return {
    label: "Stable stock",
    className:
      "border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200",
    disabled: false,
  };
};

const normalizeGallery = (primaryImage: string, gallery: string[]) => {
  const trimmedPrimary = primaryImage.trim();
  const unique = Array.from(
    new Set(gallery.map((item) => item.trim()).filter(Boolean)),
  );

  if (!trimmedPrimary) return unique;
  return [trimmedPrimary, ...unique.filter((item) => item !== trimmedPrimary)];
};

const CLOTH_SIZE_OPTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "One Size",
] as const;
const ALBUM_VARIANT_OPTIONS = [
  "Digital",
  "CD Single",
  "CD Edition",
  "Vinyl",
  "Exclusive Vinyl",
  "Standard Vinyl",
  '7" Vinyl',
  "Default",
] as const;
const ACCESSORY_VARIANT_OPTIONS = ["One Size", "Set of 2", "Default"] as const;

const sanitizeSizesForCategory = (
  category: ManagedProduct["category"],
  sizes: string,
) => {
  const current = parseCommaList(sizes);

  if (category === "cloth") {
    const valid = new Set(CLOTH_SIZE_OPTIONS);
    const ordered = CLOTH_SIZE_OPTIONS.filter(
      (option) => valid.has(option) && current.includes(option),
    );
    return joinCommaList(ordered);
  }

  const options =
    category === "album" ? ALBUM_VARIANT_OPTIONS : ACCESSORY_VARIANT_OPTIONS;
  const optionSet = new Set(options);
  const firstValid = current.find((item) =>
    optionSet.has(item as (typeof options)[number]),
  );
  return firstValid ?? "Default";
};

const emptyForm = (): ProductFormState => ({
  id: "",
  name: "",
  brand: "KATSEYE Merch",
  price: "",
  stock: "",
  status: "available",
  category: "cloth",
  mainCategoryId: "",
  subcategoryId: "",
  description: "",
  details: "",
  sizes: "",
  image: "",
  gallery: [],
});

const toFormState = (product: ManagedProduct): ProductFormState => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  price: String(product.price),
  stock: String(product.stock),
  status: product.status,
  category: product.category,
  mainCategoryId: product.mainCategoryId ?? "",
  subcategoryId: product.subcategoryId ?? "",
  description: product.description,
  details: product.details.join("\n"),
  sizes: sanitizeSizesForCategory(product.category, product.sizes.join(", ")),
  image: product.image,
  gallery: normalizeGallery(product.image, product.gallery),
});

const normalizeCategoryOptions = (value: unknown): { id: string; name: string }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null))
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.category_name ?? row.categoryName ?? row.name ?? ""),
    }))
    .filter((row) => Boolean(row.id) && Boolean(row.name));
};

const normalizeCreatedCategory = (
  value: unknown,
): { id: string; name: string } | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const id = asString(record.id);
  const name = asString(record.category_name ?? record.categoryName ?? record.name);
  if (!id || !name) return null;

  return { id, name };
};

export default function ProductManagementPage() {
  const { currency, formatCurrency } = useStoreSettings();
  const [view, setView] = useState<"active" | "archived">("active");
  const [items, setItems] = useState<ManagedProduct[]>([]);
  const [archivedItems, setArchivedItems] = useState<ManagedProduct[]>([]);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [subcategoryFilter, setSubcategoryFilter] =
    useState<SubcategoryFilter>("all");
  const [mainCategories, setMainCategories] = useState<CategoryNode[]>([]);
  const [mainCategoriesLoading, setMainCategoriesLoading] = useState(true);
  const [mainCategoriesError, setMainCategoriesError] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [mainCategoryDraft, setMainCategoryDraft] = useState("");
  const [mainCategoryCreating, setMainCategoryCreating] = useState(false);
  const [subcategoryDraft, setSubcategoryDraft] = useState("");
  const [subcategoryCreating, setSubcategoryCreating] = useState(false);
  const [saveMessage, setSaveMessage] = useState(
    "Manage product catalog with CRUD.",
  );
  const [galleryUrlDraft, setGalleryUrlDraft] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subcategoryRequestRef = useRef(0);
  const isClothCategory = form.category === "cloth";
  const selectedMainCategory = useMemo(
    () =>
      mainCategories.find((category) => category.id === form.mainCategoryId) ??
      null,
    [mainCategories, form.mainCategoryId],
  );
  const isAlbumMainCategoryName =
    selectedMainCategory?.name.trim().toLowerCase() === "album";
  const isAlbumMainCategorySelected = isAlbumMainCategoryName;

  const setField = <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const showToast = (
    message: string,
    tone: NonNullable<ToastState>["tone"] = "success",
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const reloadMainCategories = async () => {
    setMainCategoriesLoading(true);
    setMainCategoriesError(null);

    try {
      const response = await api("/api/admin/categories/tree");
      const nodes = normalizeCategoriesTree(response);
      setMainCategories(nodes);
      return nodes;
    } catch (error) {
      setMainCategories([]);
      const message =
        error instanceof Error ? error.message : "Failed to load categories.";
      setMainCategoriesError(message);
      showToast("Failed to load categories.", "error");
      return [];
    } finally {
      setMainCategoriesLoading(false);
    }
  };

  const refetchActiveProducts = async () => {
    try {
      const next = await fetchAdminProducts();
      setItems(next);
      return next;
    } catch {
      setItems([]);
      return [];
    }
  };

  const refetchArchivedProducts = async () => {
    try {
      const next = await fetchAdminArchivedProducts();
      setArchivedItems(next);
      return next;
    } catch {
      setArchivedItems([]);
      return [];
    }
  };

  const refetchAllProducts = async () => {
    await Promise.all([refetchActiveProducts(), refetchArchivedProducts()]);
  };

  useEffect(() => {
    void refetchActiveProducts();
  }, []);

  useEffect(() => {
    void reloadMainCategories();
  }, []);

  useEffect(() => {
    if (view !== "archived") return;
    void refetchArchivedProducts();
  }, [view]);

  useEffect(() => {
    if (view !== "archived") return;
    if (editingId) setEditingId(null);
    if (isFormModalOpen) setIsFormModalOpen(false);
    setForm(emptyForm());
  }, [editingId, isFormModalOpen, view]);

  const mainCategoryOptions = useMemo(() => {
    if (mainCategories.length === 0) return [];
    const sorted = [...mainCategories].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return sorted.map((item) => ({ ...item, disabled: false }));
  }, [mainCategories]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const isAnyModalOpen = isFormModalOpen || Boolean(confirmDialog);
    if (!isAnyModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmDialog) {
        setConfirmDialog(null);
        setConfirmBusy(false);
        return;
      }
      setIsFormModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmDialog, isFormModalOpen]);

  const listItems = view === "archived" ? archivedItems : items;

  const searchedResolvedItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return listItems;

    return listItems.filter((item) => {
      const haystack = [
        item.name,
        item.brand,
        item.category,
        item.subcategoryName,
        item.subcategory,
        item.mainCategoryName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [listItems, search]);

  const visibleItems = useMemo(() => {
    if (categoryFilter === "all") return searchedResolvedItems;
    return searchedResolvedItems.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, searchedResolvedItems]);

  const availableSubcategories = useMemo(() => {
    const pool = categoryFilter === "all" ? searchedResolvedItems : visibleItems;
    return Array.from(
      new Set(
        pool
          .map((item) => item.subcategoryName?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [categoryFilter, searchedResolvedItems, visibleItems]);

  const subcategoryItems = useMemo(() => {
    if (subcategoryFilter === "all") return visibleItems;
    return visibleItems.filter(
      (item) => item.subcategoryName === subcategoryFilter,
    );
  }, [subcategoryFilter, visibleItems]);

  const categoryLabel = useMemo(() => {
    if (categoryFilter === "all") return "All categories";
    if (categoryFilter === "cloth") return "Apparel";
    if (categoryFilter === "album") return "Album";
    return "Accessories";
  }, [categoryFilter]);

  const toggleClothSize = (size: (typeof CLOTH_SIZE_OPTIONS)[number]) => {
    const next = new Set(parseCommaList(form.sizes));
    if (next.has(size)) next.delete(size);
    else next.add(size);
    // Preserve a stable order so "XS, S, M..." doesn't jump around as you toggle.
    const ordered = CLOTH_SIZE_OPTIONS.filter((option) => next.has(option));
    setField("sizes", joinCommaList(ordered));
  };

  const loadSubcategoriesForMain = async (
    mainCategoryId: string,
    preferredSubcategoryId: string,
  ) => {
    const requestId = ++subcategoryRequestRef.current;

    if (!mainCategoryId) {
      setSubcategories([]);
      setSubcategoriesLoading(false);
      setForm((prev) => (prev.subcategoryId ? { ...prev, subcategoryId: "" } : prev));
      return;
    }

    setSubcategoriesLoading(true);

    try {
      const response = await api(
        `/api/admin/categories/${mainCategoryId}/subcategories`,
      );
      if (requestId !== subcategoryRequestRef.current) return;
      const options = normalizeCategoryOptions(response);
      setSubcategories(options);
      setForm((prev) => {
        if (options.length === 0) {
          return prev.subcategoryId ? { ...prev, subcategoryId: "" } : prev;
        }
        if (
          preferredSubcategoryId &&
          options.some((item) => item.id === preferredSubcategoryId)
        ) {
          return { ...prev, subcategoryId: preferredSubcategoryId };
        }
        const selected = prev.subcategoryId;
        if (selected && options.some((item) => item.id === selected)) return prev;
        return { ...prev, subcategoryId: options[0]?.id ?? "" };
      });
    } catch {
      if (requestId !== subcategoryRequestRef.current) return;
      setSubcategories([]);
      setForm((prev) => (prev.subcategoryId ? { ...prev, subcategoryId: "" } : prev));
    } finally {
      if (requestId !== subcategoryRequestRef.current) return;
      setSubcategoriesLoading(false);
    }
  };

  const applyMainCategorySelection = (
    nextMainCategoryId: string,
    nextMainCategoryName?: string,
  ) => {
    subcategoryRequestRef.current += 1;
    setSubcategories([]);
    setSubcategoriesLoading(false);

    const selected =
      mainCategories.find((item) => item.id === nextMainCategoryId) ?? null;
    const resolvedLabel = nextMainCategoryName ?? selected?.name ?? "";
    const nextCategory = resolvedLabel
      ? resolveTopLevelCategory(resolvedLabel)
      : form.category;

    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      mainCategoryId: nextMainCategoryId,
      subcategoryId: "",
      sizes: sanitizeSizesForCategory(nextCategory, prev.sizes),
    }));

    void loadSubcategoriesForMain(nextMainCategoryId, "");
  };

  const handleMainCategoryChange = (nextMainCategoryId: string) => {
    applyMainCategorySelection(nextMainCategoryId);
  };

  const createMainCategory = async () => {
    const name = mainCategoryDraft.trim();
    if (!name) {
      showToast("Enter a category name.", "error");
      return;
    }

    setMainCategoryCreating(true);
    try {
      const response = await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ category_name: name, parent_category_id: null }),
      });
      const created = normalizeCreatedCategory(response);
      const nodes = await reloadMainCategories();
      const selected =
        (created?.id
          ? nodes.find((node) => node.id === created.id) ?? null
          : null) ??
        nodes.find(
          (node) => node.name.trim().toLowerCase() === name.toLowerCase(),
        ) ??
        null;

      if (selected) {
        applyMainCategorySelection(selected.id, selected.name);
      }
      setMainCategoryDraft("");
      showToast("Category created.");
    } catch {
      showToast("Failed to create category.", "error");
    } finally {
      setMainCategoryCreating(false);
    }
  };

  const createSubcategory = async () => {
    const name = subcategoryDraft.trim();
    if (!name) {
      showToast("Enter a subcategory name.", "error");
      return;
    }

    if (!form.mainCategoryId) {
      showToast("Select a main category first.", "error");
      return;
    }

    if (isAlbumMainCategoryName) {
      showToast("Album does not support subcategories.", "error");
      return;
    }

    const parentCategoryId = asNumber(form.mainCategoryId, Number.NaN);
    if (!Number.isFinite(parentCategoryId)) {
      showToast("Invalid main category id.", "error");
      return;
    }

    setSubcategoryCreating(true);
    try {
      const response = await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          category_name: name,
          parent_category_id: parentCategoryId,
        }),
      });
      const created = normalizeCreatedCategory(response);
      setSubcategoryDraft("");
      void loadSubcategoriesForMain(form.mainCategoryId, created?.id ?? "");
      showToast("Subcategory created.");
    } catch {
      showToast("Failed to create subcategory.", "error");
    } finally {
      setSubcategoryCreating(false);
    }
  };

  const nonClothVariantOptions =
    form.category === "album"
      ? ALBUM_VARIANT_OPTIONS
      : ACCESSORY_VARIANT_OPTIONS;
  const nonClothSelectedVariant = parseCommaList(form.sizes)[0] ?? "Default";

  const saveItems = (nextItems: ManagedProduct[], message: string) => {
    setItems(nextItems);
    setSaveMessage(message);
  };

  const handleSubmit = async () => {
    const stockNumber = Number(form.stock);
    if (!Number.isFinite(stockNumber) || stockNumber < 0) {
      setSaveMessage("Stock must be a number greater than or equal to 0.");
      showToast("Invalid stock value.", "error");
      return;
    }

    if (editingId) {
      // Edit mode currently supports stock updates only.
      if (!Number.isInteger(stockNumber)) {
        setSaveMessage("Stock must be a whole number.");
        showToast("Invalid stock value.", "error");
        return;
      }
    } else {
      const name = form.name.trim();
      const description = form.description.trim();
      const image = form.image.trim();
      const priceNumber = Number(form.price);

      if (!name) {
        setSaveMessage("Product name is required.");
        showToast("Product name is required.", "error");
        return;
      }
      if (!description) {
        setSaveMessage("Description is required.");
        showToast("Description is required.", "error");
        return;
      }
      if (!image) {
        setSaveMessage("At least one image is required.");
        showToast("Image is required.", "error");
        return;
      }
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        setSaveMessage("Price must be a number greater than 0.");
        showToast("Invalid price value.", "error");
        return;
      }
      if (
        form.category === "cloth" &&
        parseCommaList(form.sizes).length === 0
      ) {
        setSaveMessage("Select at least one size for cloth products.");
        showToast("Select at least one size.", "error");
        return;
      }
    }

    try {
      if (editingId) {
        const selectedMainCategoryId = Number(form.mainCategoryId);
        if (
          Number.isFinite(selectedMainCategoryId) &&
          selectedMainCategoryId > 0
        ) {
          if (subcategoriesLoading) {
            setSaveMessage("Please wait for subcategories to load.");
            showToast("Subcategories are still loading.", "error");
            return;
          }

          const shouldSendSubcategory = subcategories.length > 0;
          const selectedSubcategory =
            shouldSendSubcategory && form.subcategoryId
              ? subcategories.find((item) => item.id === form.subcategoryId) ?? null
              : null;

          if (shouldSendSubcategory && !selectedSubcategory) {
            setSaveMessage("Select a valid subcategory for the chosen main category.");
            showToast("Select a valid subcategory.", "error");
            return;
          }

          await api(`/api/admin/products/${editingId}`, {
            method: "PUT",
            body: JSON.stringify({
              main_category_id: selectedMainCategoryId,
              subcategory_id: shouldSendSubcategory
                ? Number(form.subcategoryId)
                : null,
            }),
          });
        }

        await api(`/api/admin/products/${editingId}/stock`, {
          method: "PATCH",
          body: JSON.stringify({
            stock: stockNumber,
          }),
        });
      } else {
        const primaryImage = form.image.trim();
        const images = normalizeGallery(primaryImage, form.gallery);
        const selectedMainCategoryId = Number(form.mainCategoryId);
        if (
          !Number.isFinite(selectedMainCategoryId) ||
          selectedMainCategoryId <= 0
        ) {
          setSaveMessage("Select a main category before creating the product.");
          showToast("Select a main category.", "error");
          return;
        }

        if (subcategoriesLoading) {
          setSaveMessage("Please wait for subcategories to load.");
          showToast("Subcategories are still loading.", "error");
          return;
        }

        const shouldSendSubcategory = subcategories.length > 0;
        const selectedSubcategory =
          shouldSendSubcategory && form.subcategoryId
            ? subcategories.find((item) => item.id === form.subcategoryId) ?? null
            : null;

        if (shouldSendSubcategory && !selectedSubcategory) {
          setSaveMessage("Select a subcategory before creating the product.");
          showToast("Select a subcategory.", "error");
          return;
        }

        await api("/api/admin/products", {
          method: "POST",
          body: JSON.stringify({
            title: form.name.trim(),
            description: form.description.trim(),
            price: Number(form.price),
            stock: stockNumber,
            main_category_id: selectedMainCategoryId,
            subcategory_id: shouldSendSubcategory
              ? Number(form.subcategoryId)
              : null,
            image_url: primaryImage,
            images,
            variants: form.sizes
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .map((name, index) => ({
                name,
                sku: `${name.replace(/\s+/g, "-").toUpperCase()}-${index + 1}`,
                price: Number(form.price),
                stock: stockNumber,
              })),
          }),
        });
      }
      const nextItems = await fetchAdminProducts();
      saveItems(nextItems, editingId ? "Stock updated." : "Product created.");
      showToast(
        editingId
          ? "Stock updated successfully."
          : "Product added successfully.",
        "success",
      );
      setEditingId(null);
      setIsFormModalOpen(false);
      setForm(emptyForm());
      subcategoryRequestRef.current += 1;
      setSubcategories([]);
      setSubcategoriesLoading(false);
      setGalleryUrlDraft("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save product.";
      setSaveMessage(message);
      showToast(message, "error");
    }
  };

  const archiveProduct = async (productId: string) => {
    try {
      await api(`/api/admin/products/${productId}`, { method: "DELETE" });
      await refetchAllProducts();
      setSaveMessage("Product archived.");
      showToast("Product moved to archive.");
      if (editingId === productId) setEditingId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to archive product.";
      setSaveMessage(message);
      showToast(message, "error");
    }
  };

  const handleResell = async (productId: string) => {
    try {
      await api(`/api/admin/products/${productId}/resell`, { method: "PATCH" });
      await refetchAllProducts();
      setSaveMessage("Product restored.");
      showToast("Product returned to active catalog.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to restore product.";
      setSaveMessage(message);
      showToast(message, "error");
    }
  };

  const hardDeleteProduct = async (productId: string) => {
    try {
      await api(`/api/admin/products/${productId}/hard`, { method: "DELETE" });
      await refetchAllProducts();
      setSaveMessage("Product deleted.");
      showToast("Product permanently deleted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete product.";
      setSaveMessage(message);
      showToast(message, "error");
    }
  };

  const openConfirmArchive = (product: ManagedProduct) => {
    setConfirmBusy(false);
    setConfirmDialog({
      action: "archive",
      productId: product.id,
      productName: product.name,
    });
  };

  const openConfirmHardDelete = (product: ManagedProduct) => {
    setConfirmBusy(false);
    setConfirmDialog({
      action: "hard-delete",
      productId: product.id,
      productName: product.name,
    });
  };

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    if (confirmBusy) return;

    setConfirmBusy(true);
    try {
      if (confirmDialog.action === "archive") {
        await archiveProduct(confirmDialog.productId);
      } else {
        await hardDeleteProduct(confirmDialog.productId);
      }
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleEdit = (product: ManagedProduct) => {
    setEditingId(product.id);
    setForm(() => toFormState(product));
    void loadSubcategoriesForMain(
      product.mainCategoryId ?? "",
      product.subcategoryId ?? "",
    );
    setGalleryUrlDraft("");
    setSaveMessage(`Editing ${product.name}.`);
    setIsFormModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    subcategoryRequestRef.current += 1;
    setSubcategories([]);
    setSubcategoriesLoading(false);
    setGalleryUrlDraft("");
    setSaveMessage("Creating a new product.");
    setIsFormModalOpen(true);
  };

  const setPrimaryImage = (value: string) => {
    const trimmed = value.trim();
    setForm((prev) => {
      const nextGallery = normalizeGallery(trimmed, prev.gallery);
      return {
        ...prev,
        image: trimmed,
        gallery: nextGallery,
      };
    });
  };

  const addGalleryImage = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setForm((prev) => {
      if (!prev.image) {
        return {
          ...prev,
          image: trimmed,
          gallery: normalizeGallery(trimmed, [...prev.gallery, trimmed]),
        };
      }

      if (prev.gallery.includes(trimmed)) return prev;
      return {
        ...prev,
        gallery: normalizeGallery(prev.image, [...prev.gallery, trimmed]),
      };
    });
  };

  const removeGalleryImage = (value: string) => {
    setForm((prev) => {
      const nextGallery = prev.gallery.filter((item) => item !== value);
      if (prev.image === value) {
        const nextPrimary = nextGallery[0] ?? "";
        return {
          ...prev,
          image: nextPrimary,
          gallery: normalizeGallery(nextPrimary, nextGallery),
        };
      }

      return {
        ...prev,
        gallery: normalizeGallery(prev.image, nextGallery),
      };
    });
  };

  return (
    <section className="space-y-6">
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))]">
          <div
            aria-live="polite"
            className={`rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (confirmBusy) return;
            setConfirmDialog(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={
            confirmDialog.action === "archive"
              ? "Archive product"
              : "Delete product"
          }
        >
          <aside
            className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/10 dark:bg-[#090909] dark:ring-[#2f2a16]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 dark:border-[#2f2a16]">
              <div className="flex items-start gap-3">
                <div
                  className={`grid h-11 w-11 place-items-center rounded-2xl ring-1 ring-inset ${
                    confirmDialog.action === "archive"
                      ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/20 dark:text-amber-200 dark:ring-amber-500/30"
                      : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/20 dark:text-rose-200 dark:ring-rose-500/30"
                  }`}
                  aria-hidden="true"
                >
                  {confirmDialog.action === "archive" ? (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M21 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3 7h18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10 12v6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 12v6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M4 7h16"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-[#c7ba81]">
                    {confirmDialog.action === "archive"
                      ? "Archive product"
                      : "Permanently delete"}
                  </p>
                  <h2 className="mt-0.5 text-xl font-semibold tracking-tight">
                    {confirmDialog.action === "archive"
                      ? "Move this product to archive?"
                      : "Delete this product?"}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirmBusy) return;
                  setConfirmDialog(null);
                }}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-300 text-lg leading-none transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2f2a16] dark:hover:bg-[#0b0b0a]"
                aria-label="Close"
                title="Close"
                disabled={confirmBusy}
              >
                ×
              </button>
            </div>

            <div className="px-5 pb-5 pt-4">
              <p className="text-sm text-neutral-600 dark:text-[#c7ba81]">
                {confirmDialog.action === "archive" ? (
                  <>
                    This will hide{" "}
                    <span className="font-semibold text-neutral-900 dark:text-[#f1d04b]">
                      {confirmDialog.productName}
                    </span>{" "}
                    from the active catalog. You can restore it from the Archive
                    tab anytime.
                  </>
                ) : (
                  <>
                    This will permanently remove{" "}
                    <span className="font-semibold text-neutral-900 dark:text-[#f1d04b]">
                      {confirmDialog.productName}
                    </span>
                    . This action cannot be undone.
                  </>
                )}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmBusy) return;
                    setConfirmDialog(null);
                  }}
                  className="h-11 flex-1 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:hover:bg-[#0b0b0a]"
                  disabled={confirmBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  className={`h-11 flex-1 rounded-2xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    confirmDialog.action === "archive"
                      ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:text-[#090909] dark:hover:bg-amber-400"
                      : "bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400"
                  }`}
                  disabled={confirmBusy}
                >
                  {confirmBusy
                    ? "Working…"
                    : confirmDialog.action === "archive"
                      ? "Archive"
                      : "Delete"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#4f5ae0] dark:text-[#b59b39]">
            Admin Product Management
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Product Management
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
            {saveMessage}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border border-neutral-300 bg-white p-1 dark:border-[#2f2a16] dark:bg-[#080808]">
            <button
              type="button"
              onClick={() => setView("active")}
              className={`h-10 rounded-2xl px-4 text-sm font-medium transition ${
                view === "active"
                  ? "bg-[#111827] text-white dark:bg-[#f1d04b] dark:text-[#090909]"
                  : "text-neutral-600 hover:bg-neutral-50 dark:text-[#c7ba81] dark:hover:bg-[#0b0b0a]"
              }`}
              aria-pressed={view === "active"}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setView("archived")}
              className={`h-10 rounded-2xl px-4 text-sm font-medium transition ${
                view === "archived"
                  ? "bg-[#111827] text-white dark:bg-[#f1d04b] dark:text-[#090909]"
                  : "text-neutral-600 hover:bg-neutral-50 dark:text-[#c7ba81] dark:hover:bg-[#0b0b0a]"
              }`}
              aria-pressed={view === "archived"}
            >
              Archive
            </button>
          </div>
          <button
            type="button"
            disabled={view === "archived"}
            onClick={handleCreateNew}
            className="rounded-2xl bg-[#111827] px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#f1d04b] dark:text-[#090909] dark:disabled:bg-[#665a33]"
          >
            Add New Product
          </button>
        </div>
      </header>

      <div className="grid gap-6">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">
                {view === "archived" ? "Archive" : "Catalog"}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-[#c7ba81]">
                {subcategoryItems.length} product
                {subcategoryItems.length === 1 ? "" : "s"} shown -{" "}
                {view === "archived" ? "Archived" : "Active"} - {categoryLabel}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as CategoryFilter);
                  setSubcategoryFilter("all");
                }}
                className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f] sm:w-[180px]"
              >
                <option value="all">All categories</option>
                <option value="cloth">Apparel</option>
                <option value="album">Album</option>
                <option value="accessories">Accessories</option>
              </select>
              <select
                value={subcategoryFilter}
                disabled={categoryFilter === "album" || availableSubcategories.length === 0}
                onChange={(event) => setSubcategoryFilter(event.target.value)}
                className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f] sm:w-[220px]"
              >
                <option value="all">
                  {categoryFilter === "album" ? "No subcategories" : "All subcategories"}
                </option>
                {availableSubcategories.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
              <select
                value={currency}
                onChange={(event) => {
                  const next = event.target.value as StoreCurrency;
                  window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
                  emitStoreSettingsChange();
                }}
                className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f] sm:w-[220px]"
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product"
                className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f] sm:w-[280px]"
              />
            </div>
          </div>

          <div className="space-y-3">
            {subcategoryItems.map((item) => {
              const stockButton = getStockButtonMeta(item.stock);

              return (
                <article
                  key={item.id}
                  className={`grid gap-4 rounded-[24px] border p-4 transition md:grid-cols-[92px_minmax(0,1fr)_auto] ${
                    editingId === item.id
                      ? "border-[#111827] bg-[#f8f8fb] dark:border-[#d9b92f] dark:bg-[#12110d]"
                      : "border-neutral-200 bg-white dark:border-[#2f2a16] dark:bg-[#0d0d0c]"
                  }`}
                >
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-24 w-24 rounded-2xl border border-black/5 object-cover dark:border-[#2f2a16]"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600 dark:bg-[#171711] dark:text-[#c7ba81]">
                      {formatMainCategoryName(item.mainCategoryName) ||
                        formatCategoryLabel(item.category)}
                    </span>
                    {item.subcategoryId &&
                    item.subcategoryName &&
                    formatMainCategoryName(item.subcategoryName) !==
                      formatMainCategoryName(item.mainCategoryName) ? (
                      <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600 dark:bg-[#171711] dark:text-[#c7ba81]">
                        {item.subcategoryName}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
                    {item.brand}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-[#d9c980]">
                    {item.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-[#bda962]">
                    <span>Stock: {item.stock}</span>
                    <span>Price: {formatCurrency(item.price)}</span>
                    <span>Sizes: {item.sizes.join(", ") || "None"}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {view === "active" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-[#2f2a16]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(editingId) || item.stock <= 0}
                        onClick={async () => {
                          await api(`/api/admin/products/${item.id}/stock`, {
                            method: "PATCH",
                            body: JSON.stringify({ stock: 0 }),
                          });
                          const nextItems = await fetchAdminProducts();
                          saveItems(nextItems, "Stock updated.");
                        }}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${stockButton.className}`}
                        aria-label={`${stockButton.label} (click to set stock to 0)`}
                        title={`${stockButton.label} — click to set stock to 0`}
                      >
                        {stockButton.label}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(editingId)}
                        onClick={() => openConfirmArchive(item)}
                        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-rose-600 transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2f2a16] dark:text-rose-300"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleResell(item.id)}
                        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-[#2f2a16] dark:text-emerald-200 dark:hover:bg-emerald-950/20"
                      >
                        Resell
                      </button>
                      <button
                        type="button"
                        onClick={() => openConfirmHardDelete(item)}
                        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-[#2f2a16] dark:text-rose-300 dark:hover:bg-rose-950/20"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                </article>
              );
            })}
          </div>
        </div>

        {isFormModalOpen ? (
          <div
            className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setIsFormModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Edit product" : "Create product"}
          >
            <aside
              className="max-h-[min(86vh,980px)] w-full max-w-[560px] overflow-y-auto rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#4f5ae0] dark:text-[#b59b39]">
                    {editingId ? "Edit Product" : "Create Product"}
                  </p>
                  <h2 className="text-2xl font-semibold">
                    {editingId ? form.name || "Selected Product" : "New Product"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-300 text-lg leading-none transition hover:bg-neutral-50 dark:border-[#2f2a16] dark:hover:bg-[#0b0b0a]"
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Product name"
                className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
              />
              <input
                value={form.brand}
                onChange={(event) => setField("brand", event.target.value)}
                placeholder="Brand"
                className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setField("price", event.target.value)}
                placeholder="Price"
                className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
              />
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) => setField("stock", event.target.value)}
                placeholder="Stock"
                className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {mainCategoriesError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-200">
                  <p className="font-medium">Failed to load categories.</p>
                  <p className="mt-1 text-xs opacity-80">{mainCategoriesError}</p>
                  <button
                    type="button"
                    onClick={() => void reloadMainCategories()}
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-700 dark:hover:bg-rose-600"
                  >
                    Retry
                  </button>
                </div>
              ) : mainCategoriesLoading ? (
                <select
                  value=""
                  disabled
                  className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b]"
                >
                  <option>Loading categories…</option>
                </select>
              ) : mainCategories.length === 0 ? (
                <div className="rounded-2xl border border-neutral-300 bg-white p-3 dark:border-[#2f2a16] dark:bg-[#080808]">
                  <p className="text-xs font-medium text-neutral-600 dark:text-[#c7ba81]">
                    No main categories yet
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={mainCategoryDraft}
                      onChange={(event) => setMainCategoryDraft(event.target.value)}
                      placeholder="New main category (e.g. APPAREL)"
                      className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
                    />
                    <button
                      type="button"
                      onClick={() => void createMainCategory()}
                      disabled={mainCategoryCreating}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d9b92f] dark:text-black dark:hover:bg-[#f1d04b]"
                      aria-label="Add main category"
                      title="Add"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-neutral-300 bg-white p-3 dark:border-[#2f2a16] dark:bg-[#080808]">
                  <select
                    value={form.mainCategoryId}
                    onChange={(event) => handleMainCategoryChange(event.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
                  >
                    <option value="" disabled hidden>
                      Select main category
                    </option>
                    {mainCategoryOptions.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                        disabled={category.disabled}
                      >
                        {formatMainCategoryName(category.name)}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 flex gap-2">
                    <input
                      value={mainCategoryDraft}
                      onChange={(event) => setMainCategoryDraft(event.target.value)}
                      placeholder="Add main category"
                      className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
                    />
                    <button
                      type="button"
                      onClick={() => void createMainCategory()}
                      disabled={mainCategoryCreating}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d9b92f] dark:text-black dark:hover:bg-[#f1d04b]"
                      aria-label="Add main category"
                      title="Add"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              <select
                value={form.status}
                onChange={(event) =>
                  setField(
                    "status",
                    event.target.value as ManagedProduct["status"],
                  )
                }
                className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
              >
                <option value="available">Available</option>
                <option value="pre-order">Pre-order</option>
                <option value="sold-out">Sold out</option>
              </select>
            </div>

            <select
              value={form.subcategoryId}
              disabled={
                !form.mainCategoryId ||
                isAlbumMainCategorySelected ||
                subcategoriesLoading ||
                subcategories.length === 0
              }
              onChange={(event) => setField("subcategoryId", event.target.value)}
              className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
            >
              <option value="" disabled hidden>
                {subcategoriesLoading
                  ? "Loading categories…"
                  : "Select subcategory"}
              </option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
            {Boolean(form.mainCategoryId) && !isAlbumMainCategoryName ? (
              <div className="rounded-2xl border border-neutral-300 bg-white p-3 dark:border-[#2f2a16] dark:bg-[#080808]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-neutral-600 dark:text-[#c7ba81]">
                    Add subcategory
                  </p>
                  {!subcategoriesLoading && subcategories.length === 0 ? (
                    <span className="text-[11px] text-neutral-500 dark:text-[#8e7727]">
                      None yet
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={subcategoryDraft}
                    onChange={(event) => setSubcategoryDraft(event.target.value)}
                    placeholder="New subcategory (e.g. T-Shirts)"
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
                  />
                  <button
                    type="button"
                    onClick={() => void createSubcategory()}
                    disabled={subcategoryCreating || subcategoriesLoading}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d9b92f] dark:text-black dark:hover:bg-[#f1d04b]"
                    aria-label="Add subcategory"
                    title="Add"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}
            {false ? (
              <p className="text-xs text-rose-600 dark:text-rose-300">
                Album backend category is missing. Please add a top-level “Album” category in the backend first.
              </p>
            ) : null}

            <textarea
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Description"
              rows={4}
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
            />

            <textarea
              value={form.details}
              onChange={(event) => setField("details", event.target.value)}
              placeholder="Details, one per line"
              rows={4}
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
            />

            <div className="grid gap-4">
              {isClothCategory ? (
                <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-[#2f2a16] dark:bg-[#080808]">
                  <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-[#c7ba81]">
                    Sizes
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {CLOTH_SIZE_OPTIONS.map((size) => {
                      const checked = parseCommaList(form.sizes).includes(size);
                      return (
                        <label
                          key={size}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-300 dark:border-[#2f2a16] dark:text-[#f1d04b] dark:hover:border-[#5d4c14]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleClothSize(size)}
                            className="h-4 w-4 accent-[#111827] dark:accent-[#f1d04b]"
                          />
                          {size}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <select
                  value={nonClothSelectedVariant}
                  onChange={(event) => setField("sizes", event.target.value)}
                  className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
                >
                  {nonClothVariantOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-300 p-3 dark:border-[#2f2a16] dark:bg-[#080808]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-neutral-600 dark:text-[#c7ba81]">
                  Primary image
                </p>
                {editingId ? (
                  <span className="text-[11px] text-neutral-500 dark:text-[#8e7727]">
                    Editing is stock-only
                  </span>
                ) : null}
              </div>

              <p className="mb-3 text-[11px] text-neutral-500 dark:text-[#8e7727]">
                URL only (uploads disabled)
              </p>

              <input
                value={form.image}
                disabled={Boolean(editingId)}
                onChange={(event) => setPrimaryImage(event.target.value)}
                placeholder="Primary image URL"
                className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f] dark:disabled:bg-[#0b0b0a] dark:disabled:text-[#76683d]"
              />
            </div>

            <div className="rounded-[24px] border border-neutral-200 bg-[#fafafa] p-4 dark:border-[#2f2a16] dark:bg-[#0d0d0c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Primary preview</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-[#c7ba81]">
                    This image shows first on product details.
                  </p>
                </div>
                {form.image ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPrimaryImage("");
                      setSaveMessage("Primary image cleared.");
                    }}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium dark:border-[#2f2a16]"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="mt-4 overflow-hidden rounded-[20px] border border-neutral-200 bg-white dark:border-[#2f2a16] dark:bg-[#080808]">
                {form.image ? (
                  <img
                    src={form.image}
                    alt="Selected product preview"
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-neutral-400 dark:text-[#8e7727]">
                    No image selected
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-neutral-200 bg-[#fafafa] p-4 dark:border-[#2f2a16] dark:bg-[#0d0d0c]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    Gallery images (optional)
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-[#c7ba81]">
                    Add extra images for the product gallery.
                  </p>
                </div>
                {form.gallery.length > 0 ? (
                  <button
                    type="button"
                    disabled={Boolean(editingId)}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, image: "", gallery: [] }));
                      setGalleryUrlDraft("");
                      setSaveMessage("All images cleared.");
                    }}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2f2a16]"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <div className="mt-4 rounded-[20px] border border-neutral-200 bg-white p-4 dark:border-[#2f2a16] dark:bg-[#080808]">
                <p className="text-[11px] text-neutral-500 dark:text-[#8e7727]">
                  URL only (uploads disabled)
                </p>

                <div className="mt-3">
                  <div className="flex gap-2">
                    <input
                      value={galleryUrlDraft}
                      disabled={Boolean(editingId)}
                      onChange={(event) =>
                        setGalleryUrlDraft(event.target.value)
                      }
                      placeholder="Add image URL"
                      className="h-11 flex-1 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-[#2f2a16] dark:bg-[#0b0b0a] dark:text-[#f1d04b] dark:focus:border-[#d9b92f] dark:disabled:bg-[#0b0b0a] dark:disabled:text-[#76683d]"
                    />
                    <button
                      type="button"
                      disabled={Boolean(editingId) || !galleryUrlDraft.trim()}
                      onClick={() => {
                        addGalleryImage(galleryUrlDraft);
                        setGalleryUrlDraft("");
                      }}
                      className="h-11 rounded-2xl bg-[#111827] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300 dark:bg-[#f1d04b] dark:text-[#090909] dark:disabled:bg-[#665a33]"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {form.gallery.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {form.gallery.map((image) => {
                      const isPrimary = image === form.image;
                      return (
                        <div
                          key={image}
                          className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white dark:border-[#2f2a16] dark:bg-[#0b0b0a]"
                        >
                          <div className="relative">
                            <img
                              src={image}
                              alt={
                                isPrimary ? "Primary image" : "Gallery image"
                              }
                              className="h-32 w-full object-cover"
                            />
                            <button
                              type="button"
                              disabled={Boolean(editingId)}
                              onClick={() => removeGalleryImage(image)}
                              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400"
                              aria-label="Remove image"
                              title="Remove image"
                            >
                              ×
                            </button>
                            {isPrimary ? (
                              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white dark:bg-[#f1d04b] dark:text-[#090909]">
                                Primary
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-2 p-3">
                            <button
                              type="button"
                              disabled={Boolean(editingId) || isPrimary}
                              onClick={() => setPrimaryImage(image)}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2f2a16]"
                            >
                              Set primary
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(editingId)}
                              onClick={() => removeGalleryImage(image)}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2f2a16] dark:text-rose-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-neutral-400 dark:text-[#8e7727]">
                    No gallery images yet.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-medium text-white dark:bg-[#f1d04b] dark:text-[#090909]"
              >
                {editingId ? "Update Product" : "Create Product"}
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-medium dark:border-[#2f2a16]"
              >
                Reset
              </button>
            </div>
          </div>
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
}
