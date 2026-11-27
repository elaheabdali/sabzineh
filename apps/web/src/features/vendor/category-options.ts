import type { CategoryNode } from "@/data/seed";

/** Flattens the 3-level category tree into select options (indented). */
export function flattenCategoryOptions(
  nodes: CategoryNode[],
  locale: "fa" | "en",
  depth = 0,
): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      label: `${"— ".repeat(depth)}${locale === "fa" ? node.nameFa : node.nameEn}`,
    },
    ...flattenCategoryOptions(node.children, locale, depth + 1),
  ]);
}
