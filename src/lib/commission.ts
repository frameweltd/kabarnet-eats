/**
 * Commission math — mirrors the logic in
 * supabase/migrations/0003_commission_logic.sql (handle_order_status_change).
 *
 * IMPORTANT: this file is for UI previews only (e.g. showing a hotel their
 * expected payout before confirming an order, or an admin dashboard summary).
 * The actual commission_records rows are always created by the database
 * trigger on order delivery — never trust a client-computed number for
 * money that actually changes hands. This keeps the two in sync so the
 * preview matches what the trigger will produce.
 */

export interface CommissionBreakdown {
  subtotal: number;
  commissionRate: number;
  commissionAmount: number;
  hotelPayoutAmount: number;
}

export function calculateCommission(
  subtotal: number,
  commissionRatePercent: number
): CommissionBreakdown {
  const commissionAmount = round2(subtotal * (commissionRatePercent / 100));
  const hotelPayoutAmount = round2(subtotal - commissionAmount);

  return {
    subtotal,
    commissionRate: commissionRatePercent,
    commissionAmount,
    hotelPayoutAmount,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount);
}
