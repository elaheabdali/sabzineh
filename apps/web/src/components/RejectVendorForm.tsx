"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { rejectVendorAction, type AdminActionState } from "@/server/admin/actions";

/** Reject a pending vendor with a reason (useActionState). */
export function RejectVendorForm({ vendorId }: { vendorId: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    rejectVendorAction,
    {},
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input
        type="text"
        name="reason"
        required
        minLength={2}
        placeholder={t("reason")}
        aria-label={t("reason")}
        className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        data-testid={`reject-vendor-${vendorId}`}
        className="cursor-pointer rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
      >
        {t("reject")}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs font-medium text-red-700">
          {state.error}
        </span>
      ) : null}
      {state.saved ? (
        <span role="status" className="text-xs font-medium text-leaf-700">
          ✓
        </span>
      ) : null}
    </form>
  );
}
