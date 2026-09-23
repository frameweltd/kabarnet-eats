"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/commission";
import type { Rider, RiderAvailability, Order } from "@/types/database";

export default function RiderDashboardPage() {
  const [rider, setRider] = useState<Rider | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: riderData } = await supabase
      .from("riders")
      .select("*")
      .eq("rider_id", user.id)
      .single();
    setRider(riderData as Rider);

    const { data: orderData } = await supabase
      .from("orders")
      .select("*")
      .eq("rider_id", user.id)
      .in("status", ["out_for_delivery"])
      .order("placed_at", { ascending: false });
    setOrders((orderData as Order[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function setAvailability(status: RiderAvailability) {
    if (!rider) return;
    await supabase
      .from("riders")
      .update({ availability_status: status })
      .eq("rider_id", rider.rider_id);
    loadData();
  }

  async function markDelivered(orderId: string) {
    await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("order_id", orderId);
    loadData();
  }

  if (!rider) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold mb-2">Your status</h2>
        <div className="flex gap-2">
          {(["available", "busy", "offline"] as RiderAvailability[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setAvailability(status)}
                className={`flex-1 text-sm py-2 rounded-md border capitalize ${
                  rider.availability_status === status
                    ? "bg-brand-600 text-white border-brand-600"
                    : "border-gray-300"
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Assigned deliveries</h2>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-sm">No active deliveries.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.order_id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <p className="font-medium">
                  Order #{order.order_id.slice(0, 8)}
                </p>
                <p className="text-sm text-gray-500">
                  {formatKES(order.total_amount)}
                </p>
                {order.delivery_landmark && (
                  <p className="text-sm mt-1">📍 {order.delivery_landmark}</p>
                )}
                {order.delivery_contact_phone && (
                  <p className="text-sm">☎ {order.delivery_contact_phone}</p>
                )}
                <button
                  onClick={() => markDelivered(order.order_id)}
                  className="mt-3 bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md"
                >
                  Mark delivered
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
