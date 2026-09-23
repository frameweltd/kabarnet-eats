"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelStatus } from "@/types/database";

export default function AdminHotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRateFor, setEditingRateFor] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const supabase = createClient();

  const loadHotels = useCallback(async () => {
    const { data } = await supabase
      .from("hotels")
      .select("*")
      .order("created_at", { ascending: false });
    setHotels((data as Hotel[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadHotels();
  }, [loadHotels]);

  async function updateStatus(hotelId: string, status: HotelStatus) {
    await supabase.from("hotels").update({ status }).eq("hotel_id", hotelId);
    loadHotels();
  }

  async function updateCommissionRate(hotelId: string) {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      alert("Enter a valid rate between 0 and 100");
      return;
    }
    await supabase
      .from("hotels")
      .update({ commission_rate: rate })
      .eq("hotel_id", hotelId);
    setEditingRateFor(null);
    setNewRate("");
    loadHotels();
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Hotels & restaurants</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white rounded-lg border border-gray-200">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
              <th className="p-3">Commission</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <tr key={hotel.hotel_id} className="border-b last:border-0">
                <td className="p-3 font-medium">{hotel.name}</td>
                <td className="p-3">{hotel.phone}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      hotel.status === "active"
                        ? "bg-green-100 text-green-700"
                        : hotel.status === "suspended"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {hotel.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-3">
                  {editingRateFor === hotel.hotel_id ? (
                    <div className="flex gap-1 items-center">
                      <input
                        autoFocus
                        type="number"
                        step="0.1"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                        className="w-16 border rounded px-1 py-0.5 text-xs"
                      />
                      <button
                        onClick={() => updateCommissionRate(hotel.hotel_id)}
                        className="text-brand-600 text-xs"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingRateFor(hotel.hotel_id);
                        setNewRate(hotel.commission_rate.toString());
                      }}
                      className="underline"
                    >
                      {hotel.commission_rate}%
                    </button>
                  )}
                </td>
                <td className="p-3 space-x-2">
                  {hotel.status !== "active" && (
                    <button
                      onClick={() => updateStatus(hotel.hotel_id, "active")}
                      className="text-green-600 hover:underline"
                    >
                      Activate
                    </button>
                  )}
                  {hotel.status !== "suspended" && (
                    <button
                      onClick={() => updateStatus(hotel.hotel_id, "suspended")}
                      className="text-red-600 hover:underline"
                    >
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Commission rate changes apply only to new orders placed after the
        change — a full audit trail is kept automatically.
      </p>
    </div>
  );
}
