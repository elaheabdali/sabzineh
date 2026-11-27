import { plans } from "@/data/seed";

/**
 * Subscription plans (Week 6 wires enrolment + billing).
 * Week 1: read-only catalogue from seed data.
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

export function listPlans(kind?: PlanKind): PlanSummary[] {
  const all: PlanSummary[] = plans.map((p) => ({
    id: p.id,
    kind: p.kind as PlanKind,
    title: p.title,
    price: p.price,
    periodDays: p.periodDays,
    features: p.features as Record<string, unknown>,
  }));
  return kind ? all.filter((p) => p.kind === kind) : all;
}

export function getPlanById(id: string): PlanSummary | undefined {
  return listPlans().find((p) => p.id === id);
}

/** Commission rate for a vendor plan (0 for box plans). */
export function commissionRateForPlan(plan: PlanSummary): number {
  if (plan.kind !== "VENDOR") return 0;
  const rate = plan.features.commissionRate;
  return typeof rate === "number" ? rate : 0.12;
}
