import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKES } from "@/lib/commission";
import { formatKenyaDateTime } from "@/lib/datetime";
import type { Order, Hotel } from "@/types/database";

type OrderWithHotel = Order & { hotels: Pick<Hotel, "name"> };

export default async function CustomerOrdersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orders } = await supabase
    .from("orders")
    .select("*, hotels(name)")
    .eq("customer_id", user.id)
    .order("placed_at", { ascending: false }) as { data: OrderWithHotel[] | null };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your orders</h2>
      {!orders || orders.length === 0 ? (
        <p className="text-gray-500">
          No orders yet.{" "}
          <Link href="/customer" className="text-brand-600 underline">
            Browse restaurants
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.order_id}
              href={`/customer/orders/${order.order_id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{order.hotels?.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatKenyaDateTime(order.placed_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatKES(order.total_amount)}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
