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
  mpesa_orders: number;
  mpesa_payout_owed_to_hotel: number;
  cash_orders: number;
  cash_commission_owed_to_platform: number;
}

export default function AdminSettlementsPage() {
  const [rows, setRows] = useState<PendingPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState(defaultWeekStart());
  const [periodEnd, setPeriodEnd] = useState(defaultWeekEnd());
  const [generating, setGenerating] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

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

  const totalToCollect = rows.reduce(
    (sum, r) => sum + Number(r.cash_commission_owed_to_platform),
    0
  );
  const totalToPayOut = rows.reduce(
    (sum, r) => sum + Number(r.mpesa_payout_owed_to_hotel),
    0
  );

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Pending settlements</h2>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-lg">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs text-amber-700 font-medium">
            You need to COLLECT (cash orders)
          </p>
          <p className="text-xl font-semibold text-amber-900 mt-1">
            {formatKES(totalToCollect)}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Hotels collected this cash directly — they owe you this
            commission.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-700 font-medium">
            You need to PAY OUT (M-Pesa orders)
          </p>
          <p className="text-xl font-semibold text-blue-900 mt-1">
            {formatKES(totalToPayOut)}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            You collected this via M-Pesa — hotels are owed this back.
          </p>
        </div>
      </div>

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
                <th className="p-3">Cash orders</th>
                <th className="p-3 text-amber-700">Collect from hotel</th>
                <th className="p-3">M-Pesa orders</th>
                <th className="p-3 text-blue-700">Pay to hotel</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.hotel_id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.hotel_name}</td>
                  <td className="p-3">{row.cash_orders}</td>
                  <td className="p-3 text-amber-700 font-medium">
                    {row.cash_orders > 0
                      ? formatKES(Number(row.cash_commission_owed_to_platform))
                      : "—"}
                  </td>
                  <td className="p-3">{row.mpesa_orders}</td>
                  <td className="p-3 text-blue-700 font-medium">
                    {row.mpesa_orders > 0
                      ? formatKES(Number(row.mpesa_payout_owed_to_hotel))
                      : "—"}
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
      <div className="text-xs text-gray-500 mt-3 space-y-1">
        <p>
          <strong className="text-amber-700">Collect from hotel</strong>:
          customers paid the hotel directly in cash, so the hotel owes you
          this commission. Contact the hotel to collect it (cash, M-Pesa, or
          however you arrange it).
        </p>
        <p>
          <strong className="text-blue-700">Pay to hotel</strong>: customers
          paid via M-Pesa into your account, so you owe the hotel their share
          back.
        </p>
        <p>
          Generating a batch locks in all pending commission records within
          the selected period as &quot;settled&quot; for that hotel. Actually
          sending or collecting the money is a manual step outside this app —
          do that first, then generate the batch as your record of it.
        </p>
      </div>
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
