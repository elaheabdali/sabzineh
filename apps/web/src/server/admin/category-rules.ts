import type { CategoryDTO } from "@sabzineh/types";

/**
 * Category-tree rules (Week 6) — pure functions over a flat list,
 * unit-testable without a database.
 *
 * The tree is at most 3 levels deep (root → child → grandchild).
 * A move is rejected when it would create a cycle (parent = self or
 * one of the node's descendants) or push any node past level 3.
 */

export const MAX_CATEGORY_DEPTH = 3;

export type CategoryRuleError = "not-found" | "self-parent" | "cycle" | "too-deep";

/** Depth of a node: roots are level 1. */
export function categoryDepth(categories: CategoryDTO[], id: string): number {
  let depth = 0;
  let current: CategoryDTO | undefined = categories.find((c) => c.id === id);
  while (current) {
    depth += 1;
    if (!current.parentId) break;
    current = categories.find((c) => c.id === current?.parentId);
  }
  return depth;
}

/** Ids of a node and all its descendants. */
export function descendantCategoryIds(categories: CategoryDTO[], id: string): string[] {
  const out: string[] = [id];
  const walk = (parentId: string): void => {
    for (const child of categories.filter((c) => c.parentId === parentId)) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

/** Height of the subtree rooted at id (0 = leaf). */
export function subtreeHeight(categories: CategoryDTO[], id: string): number {
  const children = categories.filter((c) => c.parentId === id);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((c) => subtreeHeight(categories, c.id)));
}

export type CategoryMoveResult = { ok: true } | { ok: false; error: CategoryRuleError };

/** Can `id` move under `newParentId` (null = root)? */
export function validateCategoryMove(
  categories: CategoryDTO[],
  id: string,
  newParentId: string | null,
): CategoryMoveResult {
  const node = categories.find((c) => c.id === id);
  if (!node) return { ok: false, error: "not-found" };
  if (newParentId === id) return { ok: false, error: "self-parent" };
  if (newParentId) {
    const parent = categories.find((c) => c.id === newParentId);
    if (!parent) return { ok: false, error: "not-found" };
    // A parent inside the moved subtree would create a cycle.
    if (descendantCategoryIds(categories, id).includes(newParentId)) {
      return { ok: false, error: "cycle" };
    }
    const newDepth = categoryDepth(categories, newParentId) + 1 + subtreeHeight(categories, id);
    if (newDepth > MAX_CATEGORY_DEPTH) return { ok: false, error: "too-deep" };
  } else if (1 + subtreeHeight(categories, id) > MAX_CATEGORY_DEPTH) {
    return { ok: false, error: "too-deep" };
  }
  return { ok: true };
}

/** Can a new category be created under `parentId` (null = root)? */
export function validateCategoryCreate(
  categories: CategoryDTO[],
  parentId: string | null,
): CategoryMoveResult {
  if (!parentId) return { ok: true };
  const parent = categories.find((c) => c.id === parentId);
  if (!parent) return { ok: false, error: "not-found" };
  if (categoryDepth(categories, parentId) + 1 > MAX_CATEGORY_DEPTH) {
    return { ok: false, error: "too-deep" };
  }
  return { ok: true };
}
