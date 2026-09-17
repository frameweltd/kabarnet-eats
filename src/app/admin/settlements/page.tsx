"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/commission";

interface PendingPayoutRow {
  hotel_id: string;
  hotel_name: string;
  pending_orders: number;
  gross_sales: number;
  total_commission: number;
  net_payout_owed: number;
}

export default function AdminSettlementsPage() {
  const [rows, setRows] = useState<PendingPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState(defaultWeekStart());
  const [periodEnd, setPeriodEnd] = useState(defaultWeekEnd());
  const [generating, setGenerating] = useState<string | null>(null);
  const supabase = createClient();

  const loadPending = useCallback(async () => {
    const { data, error } = await supabase
      .from("hotel_pending_payouts")
      .select("*")
      .gt("pending_orders", 0);

    if (error) console.error(error);
    setRows((data as PendingPayoutRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function generateBatch(hotelId: string) {
    setGenerating(hotelId);
    const { error } = await supabase.rpc("generate_settlement_batch", {
      p_hotel_id: hotelId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (error) {
      alert(`Failed: ${error.message}`);
    } else {
      loadPending();
    }
    setGenerating(null);
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Pending settlements</h2>
      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs font-medium mb-1">
            Period start
          </label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Period end</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No pending payouts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white rounded-lg border border-gray-200">
            <thead>
              <tr className="text-left border-b">
                <th className="p-3">Hotel</th>
                <th className="p-3">Orders</th>
                <th className="p-3">Gross sales</th>
                <th className="p-3">Commission</th>
                <th className="p-3">Net payout</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.hotel_id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.hotel_name}</td>
                  <td className="p-3">{row.pending_orders}</td>
                  <td className="p-3">{formatKES(Number(row.gross_sales))}</td>
                  <td className="p-3">
                    {formatKES(Number(row.total_commission))}
                  </td>
                  <td className="p-3 font-medium">
                    {formatKES(Number(row.net_payout_owed))}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => generateBatch(row.hotel_id)}
                      disabled={generating === row.hotel_id}
                      className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
                    >
                      {generating === row.hotel_id
                        ? "Generating…"
                        : "Generate batch"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-3">
        Generating a batch locks in all pending commission records within the
        selected period as &quot;settled&quot; and creates a payout record.
        Actually sending the money (M-Pesa B2C or bank transfer) is a manual
        step outside this app for now — mark it paid afterward.
      </p>
    </div>
  );
}

function defaultWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function defaultWeekEnd(): string {
  return new Date().toISOString().split("T")[0];
}
