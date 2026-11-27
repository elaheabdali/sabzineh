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
}

/**
 * Server-paginated data table (admin panel). Sorting, filtering and
 * bulk actions are wired by the caller; Week 1 ships the shell with
 * real pagination + row selection so later weeks only add columns.
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
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-3 py-3 text-start font-semibold text-ink-900">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="px-3 py-8 text-center text-neutral-500">
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
        <p className="text-xs text-neutral-500" aria-live="polite">
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
