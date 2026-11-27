"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { placeholderImage } from "@/data/seed";

/**
 * Product gallery: one large image + thumbnails.
 * Images are deterministic SVG placeholders (no CDN) until the real
 * uploader lands in Week 5; the gallery interaction is already real.
 */
export function ProductGallery({ title }: { title: string }) {
  const t = useTranslations("product");
  const [selected, setSelected] = useState(0);
  const images = [0, 1, 2].map((variant) => placeholderImage(title, variant));
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={t("gallery")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[selected]}
        alt={title}
        width={800}
        height={800}
        data-testid="gallery-main"
        className="aspect-square w-full rounded-3xl border border-cream-200 object-cover"
      />
      <div className="flex gap-2" role="tablist" aria-label={t("gallery")}>
        {images.map((src, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={selected === index}
            aria-label={`${t("gallery")} ${index + 1}`}
            data-testid="gallery-thumb"
            onClick={() => setSelected(index)}
            className={
              selected === index
                ? "cursor-pointer overflow-hidden rounded-xl border-2 border-leaf-700"
                : "cursor-pointer overflow-hidden rounded-xl border-2 border-transparent hover:border-cream-200"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width={96} height={96} className="size-24 object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
