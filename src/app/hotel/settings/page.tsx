"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Hotel } from "@/types/database";

export default function HotelSettingsPage() {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("hotels")
        .select("*")
        .eq("hotel_id", user.id)
        .single();

      const h = data as Hotel;
      setHotel(h);
      setName(h.name);
      setAddress(h.physical_address ?? "");
      setLatitude(h.latitude?.toString() ?? "");
      setLongitude(h.longitude?.toString() ?? "");
    })();
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hotel) return;
    setSaving(true);
    setSaved(false);

    await supabase
      .from("hotels")
      .update({
        name,
        physical_address: address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      })
      .eq("hotel_id", hotel.hotel_id);

    setSaving(false);
    setSaved(true);
  }

  if (!hotel) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold mb-4">Business settings</h2>

      <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 mb-4 text-sm">
        <p>
          Your commission rate: <strong>{hotel.commission_rate}%</strong>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Set by the platform admin. Changes only apply to new orders placed
          after the change — orders already in progress keep their original
          rate.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Business name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="0.4919"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="35.7419"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <p className="text-sm text-green-600">Saved!</p>}
      </form>
    </div>
  );
}
