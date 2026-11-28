import { describe, expect, it } from "vitest";
import type { CategoryDTO } from "@sabzineh/types";
import {
  categoryDepth,
  descendantCategoryIds,
  subtreeHeight,
  validateCategoryCreate,
  validateCategoryMove,
} from "./category-rules";

/** Three-level tree: root → child → grandchild. */
const TREE: CategoryDTO[] = [
  { id: "root", parentId: null, slug: "root", nameFa: "ریشه", nameEn: "Root", sortOrder: 0 },
  { id: "child", parentId: "root", slug: "child", nameFa: "فرزند", nameEn: "Child", sortOrder: 0 },
  { id: "grand", parentId: "child", slug: "grand", nameFa: "نوه", nameEn: "Grand", sortOrder: 0 },
  { id: "other", parentId: null, slug: "other", nameFa: "دیگر", nameEn: "Other", sortOrder: 1 },
];

describe("categoryDepth / descendants / height", () => {
  it("measures depth from the root (1-based)", () => {
    expect(categoryDepth(TREE, "root")).toBe(1);
    expect(categoryDepth(TREE, "child")).toBe(2);
    expect(categoryDepth(TREE, "grand")).toBe(3);
  });

  it("collects a subtree", () => {
    expect(descendantCategoryIds(TREE, "root")).toEqual(["root", "child", "grand"]);
    expect(descendantCategoryIds(TREE, "grand")).toEqual(["grand"]);
  });

  it("measures subtree height (0 = leaf)", () => {
    expect(subtreeHeight(TREE, "root")).toBe(2);
    expect(subtreeHeight(TREE, "grand")).toBe(0);
  });
});

describe("validateCategoryMove", () => {
  it("allows moving a leaf under another root", () => {
    expect(validateCategoryMove(TREE, "grand", "other")).toEqual({ ok: true });
  });

  it("allows moving to the root", () => {
    expect(validateCategoryMove(TREE, "child", null)).toEqual({ ok: true });
  });

  it("rejects moving a node under itself", () => {
    expect(validateCategoryMove(TREE, "child", "child")).toEqual({
      ok: false,
      error: "self-parent",
    });
  });

  it("rejects moving a node under its own descendant (cycle)", () => {
    expect(validateCategoryMove(TREE, "root", "grand")).toEqual({
      ok: false,
      error: "cycle",
    });
    expect(validateCategoryMove(TREE, "child", "grand")).toEqual({
      ok: false,
      error: "cycle",
    });
  });

  it("rejects a move that would exceed 3 levels", () => {
    // "child" (height 1) under "grand" is a cycle; use a fresh pair:
    // moving "other" (leaf) under "grand" (depth 3) would make it level 4.
    expect(validateCategoryMove(TREE, "other", "grand")).toEqual({
      ok: false,
      error: "too-deep",
    });
  });

  it("rejects an unknown node or parent", () => {
    expect(validateCategoryMove(TREE, "missing", null)).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(validateCategoryMove(TREE, "other", "missing")).toEqual({
      ok: false,
      error: "not-found",
    });
  });
});

describe("validateCategoryCreate", () => {
  it("allows a child under a level-2 parent", () => {
    expect(validateCategoryCreate(TREE, "child")).toEqual({ ok: true });
  });

  it("rejects a child under a level-3 parent", () => {
    expect(validateCategoryCreate(TREE, "grand")).toEqual({
      ok: false,
      error: "too-deep",
    });
  });
});
