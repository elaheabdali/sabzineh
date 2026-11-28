"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { moveCategoryAction } from "@/server/admin/actions";

/**
 * Drag-and-drop wrapper for the admin category list (Phase 4).
 * Each row gets a drag handle; dropping a row onto another row
 * reparents it under that category, and the root zone at the top
 * moves it back to the top level. The server action re-validates
 * the move (max depth, no cycles) — an invalid drop simply does
 * not apply. The select-based move in each row's form remains as
 * the accessible alternative.
 */
export function CategoryRootDropZone({ label }: { label: string }) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    const draggedId = event.dataTransfer.getData("text/sabzineh-category");
    if (!draggedId) return;
    const result = await moveCategoryAction(draggedId, null);
    if (result.ok) router.refresh();
  };
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      data-testid="category-root-drop"
      className={`rounded-2xl border-2 border-dashed px-4 py-3 text-center text-sm text-neutral-600 ${
        over ? "border-leaf-600 bg-leaf-50" : "border-cream-200"
      }`}
    >
      {label}
    </div>
  );
}

export function CategoryDragItem({
  id,
  depth,
  children,
}: {
  id: string;
  depth: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const onDrop = async (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    setOver(false);
    const draggedId = event.dataTransfer.getData("text/sabzineh-category");
    if (!draggedId || draggedId === id) return;
    const result = await moveCategoryAction(draggedId, id);
    if (result.ok) router.refresh();
  };
  return (
    <li
      className={`rounded-2xl border bg-white p-4 ${over ? "border-leaf-600 bg-leaf-50" : "border-cream-200"}`}
      style={{ marginInlineStart: depth * 24 }}
      data-testid="admin-category-row"
      data-category-id={id}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/sabzineh-category", id);
            event.dataTransfer.effectAllowed = "move";
          }}
          aria-label={`Drag category ${id}`}
          data-testid={`category-drag-${id}`}
          className="cursor-grab rounded-lg bg-cream-100 px-2 py-1 text-xs text-neutral-600 active:cursor-grabbing"
        >
          ⠿
        </button>
      </div>
      {children}
    </li>
  );
}
