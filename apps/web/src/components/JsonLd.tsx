/**
 * JsonLd — the single place that renders JSON-LD.
 *
 * JSON-LD is static, server-generated data (no user input), so
 * dangerouslySetInnerHTML here is safe; this is the only use of it
 * in the app. Keep it that way.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
