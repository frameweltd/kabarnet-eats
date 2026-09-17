"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dispute, DisputeStatus } from "@/types/database";

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const supabase = createClient();

  const loadDisputes = useCallback(async () => {
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });
    setDisputes((data as Dispute[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  async function resolveDispute(
    disputeId: string,
    status: DisputeStatus,
    orderId: string
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("disputes")
      .update({
        status,
        resolution_note: resolutionNote,
        resolved_by_admin_id: user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("dispute_id", disputeId);

    // If resolving with a refund, cancel the underlying order — the
    // commission-reversal trigger handles the accounting automatically.
    if (status === "resolved_refunded") {
      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          cancellation_reason: `Refunded via dispute resolution: ${resolutionNote}`,
        })
        .eq("order_id", orderId);
    }

    setResolvingId(null);
    setResolutionNote("");
    loadDisputes();
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Disputes</h2>
      {disputes.length === 0 ? (
        <p className="text-gray-500 text-sm">No disputes.</p>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <div
              key={dispute.dispute_id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 capitalize">
                    {dispute.reason.replace(/_/g, " ")}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    Order #{dispute.order_id.slice(0, 8)} · raised by{" "}
                    {dispute.raised_by_type} ·{" "}
                    {new Date(dispute.created_at).toLocaleString("en-KE")}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    dispute.status === "open"
                      ? "bg-amber-100 text-amber-700"
                      : dispute.status.startsWith("resolved")
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {dispute.status.replace(/_/g, " ")}
                </span>
              </div>

              <p className="text-sm mt-2">{dispute.description}</p>

              {dispute.resolution_note && (
                <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                  Resolution: {dispute.resolution_note}
                </p>
              )}

              {dispute.status === "open" || dispute.status === "investigating" ? (
                resolvingId === dispute.dispute_id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      placeholder="Resolution note"
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          resolveDispute(
                            dispute.dispute_id,
                            "resolved_refunded",
                            dispute.order_id
                          )
                        }
                        className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-md"
                      >
                        Resolve + Refund
                      </button>
                      <button
                        onClick={() =>
                          resolveDispute(
                            dispute.dispute_id,
                            "resolved_no_action",
                            dispute.order_id
                          )
                        }
                        className="border border-gray-300 text-xs px-3 py-1.5 rounded-md"
                      >
                        Resolve — No action
                      </button>
                      <button
                        onClick={() => setResolvingId(null)}
                        className="text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setResolvingId(dispute.dispute_id)}
                    className="mt-3 text-brand-600 text-sm underline"
                  >
                    Resolve
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
