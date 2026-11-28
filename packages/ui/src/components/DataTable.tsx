import type { ReactNode } from "react";
import { cn } from "../cn";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  emptyMessage?: string;
  /** Phase 3: server-side sorting. When provided, sortable column
   * headers become buttons that report the requested sort; the
   * caller re-fetches (the table itself never sorts). */
  sort?: { key: string; dir: "asc" | "desc" };
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
}

/**
 * Server-paginated data table (admin panel). Filtering and bulk
 * actions are wired by the caller; pagination and row selection are
 * built in, and sortable headers report sort requests through
 * onSortChange when the caller opts into server-side sorting.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  page,
  pageSize,
  total,
  onPageChange,
  selected = [],
  onSelectionChange,
  emptyMessage = "No rows found.",
  sort,
  onSortChange,
}: DataTableProps<T>) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(rowKey(row)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(
      allSelected ? selected.filter((id) => !rows.some((row) => rowKey(row) === id)) : [...new Set([...selected, ...rows.map(rowKey)])],
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-cream-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cream-200 bg-cream-50 text-start">
            {onSelectionChange ? (
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
            ) : null}
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className="px-3 py-3 text-start font-semibold text-ink-900"
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange(column.key, isSorted && sort.dir === "asc" ? "desc" : "asc")
                      }
                      className="cursor-pointer font-semibold hover:text-leaf-700"
                      aria-label={`Sort by ${column.header}`}
                    >
                      {column.header}
                      {isSorted ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="px-3 py-8 text-center text-neutral-600">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-cream-100 last:border-0 hover:bg-cream-50">
                {onSelectionChange ? (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${rowKey(row)}`}
                      checked={selected.includes(rowKey(row))}
                      onChange={() => {
                        const id = rowKey(row);
                        onSelectionChange(
                          selected.includes(id)
                            ? selected.filter((s) => s !== id)
                            : [...selected, id],
                        );
                      }}
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-ink-900">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-cream-200 px-3 py-3">
        <p className="text-xs text-neutral-600" aria-live="polite">
          Page {page} of {pageCount} — {total} rows
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={cn(
              "cursor-pointer rounded-lg border border-cream-200 px-3 py-1 text-xs",
              page <= 1 && "cursor-not-allowed opacity-50",
            )}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className={cn(
              "cursor-pointer rounded-lg border border-cream-200 px-3 py-1 text-xs",
              page >= pageCount && "cursor-not-allowed opacity-50",
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
