import { getBillingStore } from "./store";

/**
 * Subscription plans.
 *
 * Phase 4: plans are DB-backed and admin-managed (the Plan table /
 * billing store), replacing the Week 1 read-only seed catalogue.
 * The seed only bootstraps the memory adapter and prisma/seed.ts.
 * Lookups are async now; every caller already runs in an async
 * context (server components, route handlers, billing services).
 */
export type PlanKind = "BOX" | "VENDOR";

export interface PlanSummary {
  id: string;
  kind: PlanKind;
  title: string;
  price: number;
  periodDays: number;
  features: Record<string, unknown>;
}

export async function listPlans(kind?: PlanKind): Promise<PlanSummary[]> {
  const all = await getBillingStore().listPlans();
  const summaries: PlanSummary[] = all.map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    price: p.price,
    periodDays: p.periodDays,
    features: p.features,
  }));
  return kind ? summaries.filter((p) => p.kind === kind) : summaries;
}

export async function getPlanById(id: string): Promise<PlanSummary | undefined> {
  const plan = await getBillingStore().getPlan(id);
  if (!plan) return undefined;
  return {
    id: plan.id,
    kind: plan.kind,
    title: plan.title,
    price: plan.price,
    periodDays: plan.periodDays,
    features: plan.features,
  };
}

/** Commission rate for a vendor plan (0 for box plans). */
export function commissionRateForPlan(plan: PlanSummary): number {
  if (plan.kind !== "VENDOR") return 0;
  const rate = plan.features.commissionRate;
  return typeof rate === "number" ? rate : 0.12;
}
