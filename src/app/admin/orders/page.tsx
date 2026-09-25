import { createClient } from "@/lib/supabase/server";
import { formatKES } from "@/lib/commission";
import { formatKenyaDateTime } from "@/lib/datetime";
import type { Order, Hotel, Customer } from "@/types/database";

type OrderRow = Order & {
  hotels: Pick<Hotel, "name">;
  customers: Pick<Customer, "name" | "phone">;
};

export default async function AdminOrdersPage() {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, hotels(name), customers(name, phone)")
    .order("placed_at", { ascending: false })
    .limit(100) as { data: OrderRow[] | null };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">All orders</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white rounded-lg border border-gray-200">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Placed</th>
              <th className="p-3">Hotel</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Total</th>
              <th className="p-3">Commission %</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((order) => (
              <tr key={order.order_id} className="border-b last:border-0">
                <td className="p-3 text-xs">
                  {formatKenyaDateTime(order.placed_at)}
                </td>
                <td className="p-3">{order.hotels?.name}</td>
                <td className="p-3">
                  {order.customers?.name}
                  <br />
                  <span className="text-xs text-gray-500">
                    {order.customers?.phone}
                  </span>
                </td>
                <td className="p-3">{formatKES(order.total_amount)}</td>
                <td className="p-3">{order.commission_rate_applied}%</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded text-xs bg-gray-100 capitalize">
                    {order.status.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
