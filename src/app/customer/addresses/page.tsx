"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomerAddress } from "@/types/database";

export default function CustomerAddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  const loadAddresses = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    setAddresses((data as CustomerAddress[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  async function deleteAddress(id: string) {
    if (!confirm("Delete this address?")) return;
    await supabase.from("customer_addresses").delete().eq("address_id", id);
    loadAddresses();
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Saved addresses</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md"
        >
          + Add address
        </button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No saved addresses yet. Adding one speeds up checkout.
        </p>
      ) : (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <div
              key={addr.address_id}
              className="bg-white rounded-lg border border-gray-200 p-3 flex justify-between items-start"
            >
              <div>
                <p className="font-medium text-sm">
                  {addr.label || "Address"}{" "}
                  {addr.is_default && (
                    <span className="text-xs text-brand-600">(default)</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {addr.landmark_description}
                </p>
                <p className="text-xs text-gray-400">
                  {addr.latitude}, {addr.longitude}
                </p>
              </div>
              <button
                onClick={() => deleteAddress(addr.address_id)}
                className="text-red-600 text-sm hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AddressForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadAddresses();
          }}
        />
      )}
    </div>
  );
}

function AddressForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [landmark, setLandmark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      () => setError("Could not get your location — enter it manually.")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: saveError } = await supabase.from("customer_addresses").insert({
      customer_id: user.id,
      label,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      landmark_description: landmark,
    });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="font-semibold mb-4">Add delivery address</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Label (e.g. Home, Office)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Landmark description (e.g. near KCB, blue gate) — important for finding you!"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={useMyLocation}
            className="text-sm text-brand-600 underline"
          >
            Use my current location
          </button>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-600 text-white py-2 rounded-md text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
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
      </div>
    </div>
  );
}
