"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/commission";
import type { Order, OrderItem, Hotel, DisputeReason } from "@/types/database";

type OrderDetail = Order & {
  order_items: OrderItem[];
  hotels: Pick<Hotel, "name" | "phone">;
};

const STEPS = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

export default function CustomerOrderDetailPage({
  params,
}: {
  params: { orderId: string };
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const supabase = createClient();

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), hotels(name, phone)")
      .eq("order_id", params.orderId)
      .single();
    setOrder(data as OrderDetail);
  }, [params.orderId, supabase]);

  useEffect(() => {
    loadOrder();

    const channel = supabase
      .channel(`order-${params.orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `order_id=eq.${params.orderId}`,
        },
        () => loadOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrder, params.orderId, supabase]);

  if (!order) return <p className="text-gray-500">Loading…</p>;

  const currentStepIndex = STEPS.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold">{order.hotels?.name}</h2>
      <p className="text-sm text-gray-500 mb-6">
        Order #{order.order_id.slice(0, 8)} ·{" "}
        {new Date(order.placed_at).toLocaleString("en-KE")}
      </p>

      {isCancelled ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-medium">Order cancelled</p>
          {order.cancellation_reason && (
            <p className="text-sm text-red-600 mt-1">
              {order.cancellation_reason}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            {STEPS.map((step, i) => (
              <span
                key={step}
                className={i <= currentStepIndex ? "text-brand-600 font-medium" : ""}
              >
                {step.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{
                width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="font-medium mb-2">Items</h3>
        <ul className="text-sm space-y-1">
          {order.order_items?.map((item) => (
            <li key={item.order_item_id} className="flex justify-between">
              <span>
                {item.quantity}× {item.item_name_snapshot}
              </span>
              <span>{formatKES(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm">
          <span>Total</span>
          <span>{formatKES(order.total_amount)}</span>
        </div>
      </div>

      {order.hotels?.phone && (
        <p className="text-sm text-gray-500 mb-4">
          Restaurant contact: {order.hotels.phone}
        </p>
      )}

      {(order.status === "delivered" || order.status === "cancelled") && (
        <button
          onClick={() => setShowDispute(true)}
          className="text-sm text-red-600 underline"
        >
          Report a problem with this order
        </button>
      )}

      {showDispute && (
        <DisputeForm
          orderId={order.order_id}
          onClose={() => setShowDispute(false)}
        />
      )}
    </div>
  );
}

function DisputeForm({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason>("not_delivered");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("disputes").insert({
      order_id: orderId,
      raised_by_type: "customer",
      raised_by_id: user.id,
      reason,
      description,
    });

    setSubmitting(false);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        {done ? (
          <>
            <h3 className="font-semibold mb-2">Report submitted</h3>
            <p className="text-sm text-gray-600 mb-4">
              We&apos;ll look into it and get back to you.
            </p>
            <button
              onClick={onClose}
              className="w-full border border-gray-300 py-2 rounded-md text-sm"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h3 className="font-semibold mb-2">Report a problem</h3>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="not_delivered">Order not delivered</option>
              <option value="wrong_item">Wrong item received</option>
              <option value="quality_issue">Food quality issue</option>
              <option value="payment_issue">Payment issue</option>
              <option value="other">Other</option>
            </select>
            <textarea
              required
              placeholder="Describe what happened"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={4}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-brand-600 text-white py-2 rounded-md text-sm disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 py-2 rounded-md text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
