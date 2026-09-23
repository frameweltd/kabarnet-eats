import { createClient } from "@/lib/supabase/server";
import { formatKES } from "@/lib/commission";
import type { CommissionRecord, SettlementBatch } from "@/types/database";

export default async function HotelEarningsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pending } = await supabase
    .from("commission_records")
    .select("*")
    .eq("hotel_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false }) as { data: CommissionRecord[] | null };

  const { data: batches } = await supabase
    .from("settlement_batches")
    .select("*")
    .eq("hotel_id", user.id)
    .order("period_end", { ascending: false })
    .limit(10) as { data: SettlementBatch[] | null };

  const pendingTotal = (pending ?? []).reduce(
    (sum, r) => sum + Number(r.hotel_payout_amount),
    0
  );
  const pendingCommission = (pending ?? []).reduce(
    (sum, r) => sum + Number(r.commission_amount),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Pending payout</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Orders" value={(pending ?? []).length.toString()} />
          <StatCard label="You'll receive" value={formatKES(pendingTotal)} />
          <StatCard label="Commission owed" value={formatKES(pendingCommission)} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Settled weekly by the admin. &quot;You&apos;ll receive&quot; assumes
          orders were paid by M-Pesa. For cash orders, this is what you owe
          in commission instead — check with admin for your net position.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Past settlements</h2>
        {!batches || batches.length === 0 ? (
          <p className="text-gray-500 text-sm">No settlements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-lg border border-gray-200">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-3">Period</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Gross sales</th>
                  <th className="p-3">Commission</th>
                  <th className="p-3">Net payout</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.batch_id} className="border-b last:border-0">
                    <td className="p-3">
                      {b.period_start} – {b.period_end}
                    </td>
                    <td className="p-3">{b.total_orders}</td>
                    <td className="p-3">{formatKES(Number(b.gross_sales))}</td>
                    <td className="p-3">{formatKES(Number(b.total_commission))}</td>
                    <td className="p-3 font-medium">
                      {formatKES(Number(b.net_payout))}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          b.payout_status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {b.payout_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
