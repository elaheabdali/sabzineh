"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Input, Uploader, type UploadFileItem } from "@sabzineh/ui";
import {
  VendorProductInputSchema,
  VendorProductStep1Schema,
  VendorProductStep3Schema,
  type VendorProductInput,
} from "@sabzineh/types";
import {
  createVendorProductAction,
  updateVendorProductAction,
} from "@/server/vendor/actions";
import { formatPrice } from "@/lib/format";
import { generateProductDraft } from "@/features/ai/description";
import type { Locale } from "@/i18n/routing";

/**
 * Multi-step vendor product form (Week 5).
 *
 * Step 1 basics → step 2 images (Uploader) → step 3 attributes →
 * review. Each step is validated client-side with the same Zod
 * schema the server action re-validates; the full payload is only
 * sent on save/publish. Images are read to data: URLs on submit
 * (max 4 × 1 MB — see next.config.ts serverActions bodySizeLimit).
 */

export interface ProductFormInitial {
  id: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  description: string;
  categoryId: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images?: string[];
  organic: boolean;
  glutenFree: boolean;
  local: boolean;
  tags: string[];
  originNote: string | null;
}

interface ProductFormProps {
  locale: Locale;
  categories: { id: string; label: string }[];
  initial?: ProductFormInitial;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const ERROR_KEY: Record<string, string> = {
  "invalid-input": "invalidInput",
  forbidden: "forbiddenPublish",
  "not-found": "productNotFound",
  unknown: "unknownError",
};

export function ProductForm({ locale, categories, initial }: ProductFormProps) {
  const t = useTranslations("vendor");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    initial?.compareAtPrice ? String(initial.compareAtPrice) : "",
  );
  const [stock, setStock] = useState(initial ? String(initial.stock) : "0");
  const [files, setFiles] = useState<UploadFileItem[]>(
    (initial?.images ?? []).map((url) => ({
      id: crypto.randomUUID(),
      file: new File([], "image"),
      previewUrl: url,
    })),
  );
  const [organic, setOrganic] = useState(initial?.organic ?? false);
  const [glutenFree, setGlutenFree] = useState(initial?.glutenFree ?? false);
  const [local, setLocal] = useState(initial?.local ?? false);
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join("، "));
  const [originNote, setOriginNote] = useState(initial?.originNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const step1Data = () => ({
    title,
    description,
    categoryId,
    price: Number(price),
    compareAtPrice: compareAtPrice.trim() === "" ? null : Number(compareAtPrice),
    stock: Number(stock),
  });

  const step3Data = () => ({
    organic,
    glutenFree,
    local,
    tags: tagsText
      .split(/[،,]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    originNote: originNote.trim() === "" ? undefined : originNote.trim(),
  });

  function nextFromStep1() {
    const parsed = VendorProductStep1Schema.safeParse(step1Data());
    if (!parsed.success) return setError("invalid-input");
    setError(null);
    setStep(2);
  }

  function nextFromStep2() {
    // Only count + per-file errors are checked here: the URLs are
    // validated server-side after files become data: URLs on submit
    // (a fresh upload is still a blob: preview at this point).
    if (files.length > 4 || files.some((f) => f.error)) return setError("invalid-input");
    setError(null);
    setStep(3);
  }

  function nextFromStep3() {
    const parsed = VendorProductStep3Schema.safeParse(step3Data());
    if (!parsed.success) return setError("invalid-input");
    setError(null);
    setStep(4);
  }

  async function submit(publish: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const images: { url: string; alt: string }[] = [];
      for (const item of files) {
        if (item.error) continue;
        // A real file (size > 0) is read to a data: URL; an existing
        // image (edit mode) keeps its stored URL.
        const url = item.file.size > 0 ? await fileToDataUrl(item.file) : item.previewUrl;
        images.push({ url, alt: item.file.name || title });
      }
      const input: VendorProductInput = {
        ...step1Data(),
        images,
        ...step3Data(),
      };
      const parsed = VendorProductInputSchema.safeParse(input);
      if (!parsed.success) {
        setError("invalid-input");
        return;
      }
      const result = initial
        ? await updateVendorProductAction(initial.id, parsed.data)
        : await createVendorProductAction(parsed.data, publish);
      if (!result.ok) {
        setError(result.error ?? "unknown");
        return;
      }
      router.push("/vendor/products");
    } catch {
      setError("unknown");
    } finally {
      setSubmitting(false);
    }
  }

  const categoryLabel = categories.find((c) => c.id === categoryId)?.label ?? categoryId;

  /**
   * Draft helper (Week 7): builds a description + tags from the title,
   * category and attributes with a fixed template — no AI call. The
   * vendor edits the draft before saving; nothing is auto-published.
   */
  function generateDraft() {
    if (title.trim().length < 2) return;
    const draft = generateProductDraft({
      title,
      categoryName: categoryLabel,
      organic,
      glutenFree,
      local,
      price: Number(price) || undefined,
      locale,
    });
    setDescription(draft.description);
    setTagsText(draft.tags.join("، "));
  }

  return (
    <div className="flex flex-col gap-6" data-testid="product-form" data-step={step}>
      <ol className="flex flex-wrap gap-2 text-sm font-bold" aria-label={t("newProduct")}>
        {[1, 2, 3, 4].map((n) => (
          <li
            key={n}
            className={
              step === n
                ? "rounded-full bg-leaf-700 px-4 py-2 text-white"
                : "rounded-full bg-cream-100 px-4 py-2 text-ink-900"
            }
            aria-current={step === n ? "step" : undefined}
          >
            {n === 1 ? t("stepBasics") : n === 2 ? t("stepImages") : n === 3 ? t("stepAttributes") : t("stepReview")}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" data-testid="form-error" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {t(ERROR_KEY[error] ?? "unknownError")}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4" data-testid="form-step-1">
          <Input
            label={t("title")}
            data-testid="product-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
            {t("description")}
            <textarea
              data-testid="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm outline-none focus:border-leaf-600"
            />
          </label>
          <div>
            <Button
              type="button"
              variant="secondary"
              data-testid="generate-description"
              onClick={generateDraft}
              disabled={title.trim().length < 2}
            >
              {t("generateDescription")}
            </Button>
            <p className="mt-1 text-xs text-neutral-600">{t("generateDescriptionHint")}</p>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
            {t("category")}
            <select
              data-testid="product-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm outline-none focus:border-leaf-600"
            >
              <option value="">{t("selectCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label={t("price")}
              type="number"
              min={1000}
              data-testid="product-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <Input
              label={t("compareAtPrice")}
              type="number"
              min={1000}
              data-testid="product-compare-price"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
            />
            <Input
              label={t("stock")}
              type="number"
              min={0}
              data-testid="product-stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </div>
          <Button type="button" data-testid="to-step-2" onClick={nextFromStep1}>
            {t("nextStep")}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4" data-testid="form-step-2">
          <Uploader
            files={files}
            onFilesChange={setFiles}
            maxFiles={4}
            maxSizeMB={1}
            label={t("images")}
          />
          <p className="text-xs text-neutral-600">{t("imagesHint")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" data-testid="back-to-step-1" onClick={() => setStep(1)}>
              {t("prevStep")}
            </Button>
            <Button type="button" data-testid="to-step-3" onClick={nextFromStep2}>
              {t("nextStep")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4" data-testid="form-step-3">
          <div className="flex flex-col gap-2">
            {(
              [
                ["organic", organic, setOrganic],
                ["glutenFree", glutenFree, setGlutenFree],
                ["local", local, setLocal],
              ] as const
            ).map(([key, value, setValue]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <input
                  type="checkbox"
                  data-testid={`product-${key}`}
                  checked={value}
                  onChange={(e) => setValue(e.target.checked)}
                  className="size-4 accent-leaf-700"
                />
                {t(key)}
              </label>
            ))}
          </div>
          <Input
            label={t("tags")}
            hint={t("tagsHint")}
            data-testid="product-tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
            {t("originNote")}
            <textarea
              data-testid="product-origin-note"
              value={originNote}
              onChange={(e) => setOriginNote(e.target.value)}
              rows={3}
              className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm outline-none focus:border-leaf-600"
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" data-testid="back-to-step-2" onClick={() => setStep(2)}>
              {t("prevStep")}
            </Button>
            <Button type="button" data-testid="to-review" onClick={nextFromStep3}>
              {t("nextStep")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="flex flex-col gap-4" data-testid="form-step-review">
          <h2 className="text-lg font-bold text-ink-900">{t("reviewTitle")}</h2>
          <dl className="grid gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{t("title")}</dt>
              <dd className="font-bold text-ink-900">{title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{t("category")}</dt>
              <dd className="font-bold text-ink-900">{categoryLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{t("price")}</dt>
              <dd className="font-bold text-ink-900">{formatPrice(Number(price) || 0, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{t("stock")}</dt>
              <dd className="font-bold text-ink-900">{stock}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{t("images")}</dt>
              <dd className="font-bold text-ink-900">
                {files.filter((f) => !f.error).length}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{t("tags")}</dt>
              <dd className="font-bold text-ink-900">{tagsText || "—"}</dd>
            </div>
          </dl>
          <p className="text-sm leading-7 text-neutral-600">{description}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              data-testid="back-to-step-3"
              onClick={() => setStep(3)}
              disabled={submitting}
            >
              {t("prevStep")}
            </Button>
            {initial ? (
              <Button
                type="button"
                data-testid="save-product"
                onClick={() => submit(true)}
                disabled={submitting}
              >
                {submitting ? "…" : t("save")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="save-draft"
                  onClick={() => submit(false)}
                  disabled={submitting}
                >
                  {submitting ? "…" : t("saveDraft")}
                </Button>
                <Button
                  type="button"
                  data-testid="publish-product"
                  onClick={() => submit(true)}
                  disabled={submitting}
                >
                  {submitting ? "…" : t("publish")}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
