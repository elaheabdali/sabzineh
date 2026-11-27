/**
 * Category loading skeleton — same grid shape as the loaded page,
 * so the layout does not shift while the server renders the list.
 */
export default function CategoryLoading() {
  return (
    <div className="flex flex-col gap-6 pt-8" aria-busy="true" aria-label="Loading">
      <div className="h-5 w-48 animate-pulse rounded bg-cream-200" />
      <div className="h-8 w-64 animate-pulse rounded bg-cream-200" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="h-96 animate-pulse rounded-2xl bg-cream-200" />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-cream-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
