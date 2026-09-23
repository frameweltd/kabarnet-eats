"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/commission";
import type { Order, OrderItem } from "@/types/database";

type OrderWithItems = Order & { order_items: OrderItem[] };

const NEXT_STATUS: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "New order",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function HotelOrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  const loadOrders = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("hotel_id", user.id)
      .in("status", ["pending", "confirmed", "preparing", "out_for_delivery"])
      .order("placed_at", { ascending: false });

    setOrders((data as OrderWithItems[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrders();

    const intervalId = setInterval(() => {
      loadOrders();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadOrders]);

  async function advanceStatus(orderId: string, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("order_id", orderId);

    if (error) {
      alert("Could not update order: " + error.message);
      return;
    }
    loadOrders();
  }

  async function cancelOrder(orderId: string) {
    const reason = prompt("Reason for cancellation?");
    if (reason === null) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancellation_reason: reason })
      .eq("order_id", orderId);

    if (error) {
      alert("Could not cancel: " + error.message);
      return;
    }
    loadOrders();
  }

  if (loading) return <p className="text-gray-500">Loading orders...</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No active orders right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Active orders</h2>
      {orders.map((order) => (
        <div
          key={order.order_id}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block text-xs font-medium px-2 py-1 rounded bg-brand-100 text-brand-700">
                {STATUS_LABELS[order.status]}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                Order #{order.order_id.slice(0, 8)} -{" "}
                {new Date(order.placed_at).toLocaleString("en-KE")}
              </p>
            </div>
            <p className="font-semibold">{formatKES(order.total_amount)}</p>
          </div>

          <ul className="mt-3 text-sm text-gray-700 space-y-1">
            {order.order_items?.map((item) => (
              <li key={item.order_item_id}>
                {item.quantity}x {item.item_name_snapshot} -{" "}
                {formatKES(item.line_total)}
              </li>
            ))}
          </ul>

          {order.delivery_landmark && (
            <p className="mt-2 text-sm text-gray-500">
              Location: {order.delivery_landmark}
            </p>
          )}
          {order.delivery_contact_phone && (
            <p className="text-sm text-gray-500">
              Phone: {order.delivery_contact_phone}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {NEXT_STATUS[order.status] && (
              <button
                onClick={() => advanceStatus(order.order_id, order.status)}
                className="bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-brand-700"
              >
                Mark as {STATUS_LABELS[NEXT_STATUS[order.status]!]}
              </button>
            )}
            {order.status !== "delivered" && order.status !== "cancelled" && (
              <button
                onClick={() => cancelOrder(order.order_id)}
                className="text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
