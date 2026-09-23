"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/commission";
import type { MenuItem } from "@/types/database";

export default function HotelMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const supabase = createClient();

  const loadItems = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("hotel_id", user.id)
      .order("category")
      .order("name");

    setItems((data as MenuItem[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function toggleAvailability(item: MenuItem) {
    await supabase
      .from("menu_items")
      .update({ is_available: !item.is_available })
      .eq("item_id", item.item_id);
    loadItems();
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Remove this item from your menu?")) return;
    await supabase.from("menu_items").delete().eq("item_id", itemId);
    loadItems();
  }

  if (loading) return <p className="text-gray-500">Loading menu…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your menu</h2>
        <button
          onClick={() => {
            setEditingItem(null);
            setShowForm(true);
          }}
          className="bg-brand-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-brand-700"
        >
          + Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500">
          No menu items yet. Add your first dish to start receiving orders.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.item_id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{item.name}</h3>
                  {item.category && (
                    <p className="text-xs text-gray-500">{item.category}</p>
                  )}
                </div>
                <p className="font-semibold">{formatKES(item.price)}</p>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {item.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <button
                  onClick={() => toggleAvailability(item)}
                  className={`px-2 py-1 rounded ${
                    item.is_available
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.is_available ? "Available" : "Unavailable"}
                </button>
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setShowForm(true);
                  }}
                  className="text-brand-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteItem(item.item_id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <MenuItemForm
          item={editingItem}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadItems();
          }}
        />
      )}
    </div>
  );
}

function MenuItemForm({
  item,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      hotel_id: user.id,
      name,
      description,
      price: parseFloat(price),
      category,
    };

    const { error: saveError } = item
      ? await supabase
          .from("menu_items")
          .update(payload)
          .eq("item_id", item.item_id)
      : await supabase.from("menu_items").insert(payload);

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
        <h3 className="font-semibold mb-4">
          {item ? "Edit item" : "Add menu item"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Description (optional)"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0"
            placeholder="Price (KES)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Category (e.g. Breakfast, Grills)"
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

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
