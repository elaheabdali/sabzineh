import { describe, expect, it } from "vitest";
import { generateProductDraftSmart, getAiConfig } from "./client";

const INPUT = {
  title: "عسل طبیعی کوهستان",
  categoryName: "عسل",
  organic: true,
  price: 450_000,
  locale: "fa" as const,
};

describe("AI client (Phase 4)", () => {
  it("is unconfigured without an API key", () => {
    expect(getAiConfig({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getAiConfig({ AI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)?.model).toBe(
      "gpt-4o-mini",
    );
  });

  it("falls back to the template draft when no key is configured", async () => {
    const { draft, source } = await generateProductDraftSmart(INPUT, { config: null });
    expect(source).toBe("template");
    expect(draft.description.length).toBeGreaterThan(10);
  });

  it("uses the model output when the API returns valid JSON", async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ description: "توضیح هوش مصنوعی", tags: ["عسل", "طبیعی"] }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    const { draft, source } = await generateProductDraftSmart(INPUT, {
      config: { apiKey: "k", model: "m", baseUrl: "https://example.test/v1" },
      fetchFn: fetchFn as typeof fetch,
    });
    expect(source).toBe("ai");
    expect(draft.description).toBe("توضیح هوش مصنوعی");
    expect(draft.tags).toEqual(["عسل", "طبیعی"]);
  });

  it("falls back to the template on API failure or garbage output", async () => {
    const failing = async () => new Response("nope", { status: 500 });
    const a = await generateProductDraftSmart(INPUT, {
      config: { apiKey: "k", model: "m", baseUrl: "https://example.test/v1" },
      fetchFn: failing as typeof fetch,
    });
    expect(a.source).toBe("template");
    const garbage = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
        status: 200,
      });
    const b = await generateProductDraftSmart(INPUT, {
      config: { apiKey: "k", model: "m", baseUrl: "https://example.test/v1" },
      fetchFn: garbage as typeof fetch,
    });
    expect(b.source).toBe("template");
  });
});
