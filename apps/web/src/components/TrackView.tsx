"use client";

import { useEffect } from "react";
import { VIEWED_STORAGE_KEY } from "./RecommendationsSection";

/**
 * Records a product view in localStorage (max 20, most recent first).
 * The recommendations API reads these ids as the "viewed" signal;
 * nothing is sent to the server until the recommendations section
 * fetches. No UI.
 */
export function TrackView({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(VIEWED_STORAGE_KEY) ?? "[]") as string[];
      const next = [productId, ...stored.filter((id) => id !== productId)].slice(0, 20);
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode): recommendations fall back.
    }
  }, [productId]);
  return null;
}
