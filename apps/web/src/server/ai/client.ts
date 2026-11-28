import {
  generateProductDraft,
  type ProductDraft,
  type ProductDraftInput,
} from "@/features/ai/description";

/**
 * AI client (Phase 4) — a real OpenAI-compatible chat-completions
 * integration behind environment configuration:
 *
 *   AI_API_KEY   — when unset, every feature falls back to the
 *                  built-in template/heuristic implementation, so
 *                  the app runs identically with no key at all.
 *   AI_MODEL     — model name (default "gpt-4o-mini").
 *   AI_BASE_URL  — API base (default "https://api.openai.com/v1");
 *                  any OpenAI-compatible endpoint works.
 *
 * Failures (network, non-200, unparseable output) also fall back —
 * an AI outage must never break the vendor's product form. The
 * vendor always edits the draft before saving; nothing generated
 * here is ever auto-published.
 */

export interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function getAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: env.AI_MODEL?.trim() || "gpt-4o-mini",
    baseUrl: (env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
  };
}

export function isAiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAiConfig(env) !== null;
}

type FetchFn = typeof fetch;

async function chatCompletion(
  config: AiConfig,
  system: string,
  user: string,
  fetchFn: FetchFn,
): Promise<string | null> {
  try {
    const response = await fetchFn(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Product description + tags: real model output when configured
 * (strict JSON contract), template draft otherwise or on failure.
 * `source` says which path produced the draft, for honest logging.
 */
export async function generateProductDraftSmart(
  input: ProductDraftInput,
  options?: { config?: AiConfig | null; fetchFn?: FetchFn },
): Promise<{ draft: ProductDraft; source: "ai" | "template" }> {
  const config = options?.config !== undefined ? options.config : getAiConfig();
  if (config) {
    const locale = input.locale === "en" ? "en" : "fa";
    const system =
      locale === "fa"
        ? "تو یک کپی‌رایتر فروشگاه اینترنتی مواد غذایی ارگانیک هستی. فقط یک JSON معتبر با کلیدهای description (رشته، حداکثر ۳ جمله به فارسی) و tags (آرایه‌ای از حداکثر ۶ برچسب کوتاه فارسی) برگردان. هیچ متن دیگری ننویس."
        : "You are a copywriter for an organic food marketplace. Reply with valid JSON only: {\"description\": string (max 3 sentences), \"tags\": string[] (max 6 short tags)}. No other text.";
    const user = JSON.stringify({
      title: input.title,
      category: input.categoryName,
      vendor: input.vendorName ?? null,
      organic: !!input.organic,
      glutenFree: !!input.glutenFree,
      local: !!input.local,
      priceToman: input.price ?? null,
    });
    const content = await chatCompletion(config, system, user, options?.fetchFn ?? fetch);
    if (content) {
      try {
        const parsed = JSON.parse(content) as { description?: unknown; tags?: unknown };
        if (typeof parsed.description === "string" && parsed.description.trim()) {
          const tags = Array.isArray(parsed.tags)
            ? parsed.tags.filter((t): t is string => typeof t === "string").slice(0, 6)
            : [];
          return { draft: { description: parsed.description.trim(), tags }, source: "ai" };
        }
      } catch {
        // fall through to the template draft
      }
    }
  }
  return { draft: generateProductDraft(input), source: "template" };
}
