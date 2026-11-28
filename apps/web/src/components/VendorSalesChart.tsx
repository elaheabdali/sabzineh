import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor daily-sales chart (Phase 4) — a dependency-free SVG bar
 * chart rendered on the server. Each bar carries a <title> so the
 * values are available to screen readers and on hover; the whole
 * figure is labelled for assistive tech.
 */
export function VendorSalesChart({
  data,
  locale,
  label,
}: {
  data: { date: string; gross: number }[];
  locale: Locale;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.gross));
  const width = 560;
  const height = 160;
  const gap = 6;
  const barWidth = Math.max(8, (width - gap * (data.length + 1)) / data.length);
  return (
    <figure className="flex flex-col gap-2" data-testid="vendor-sales-chart">
      <figcaption className="text-sm font-bold text-ink-900">{label}</figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className="w-full rounded-2xl border border-cream-200 bg-white p-2"
      >
        {data.map((day, index) => {
          const barHeight = Math.round((day.gross / max) * (height - 30));
          const x = gap + index * (barWidth + gap);
          const y = height - 20 - barHeight;
          return (
            <g key={day.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                className="fill-leaf-600"
              >
                <title>{`${day.date}: ${formatPrice(day.gross, locale)}`}</title>
              </rect>
              <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize={9} fill="#666">
                {day.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
