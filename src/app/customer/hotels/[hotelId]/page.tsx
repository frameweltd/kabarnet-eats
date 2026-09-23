"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/commission";
import type { Hotel, MenuItem, CustomerAddress } from "@/types/database";

interface CartLine {
  item: MenuItem;
  quantity: number;
}

export default function HotelMenuBrowsePage({
  params,
}: {
  params: { hotelId: string };
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [contactPhone, setContactPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash">("mpesa");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: hotelData } = await supabase
        .from("hotels")
        .select("*")
        .eq("hotel_id", params.hotelId)
        .single();
      setHotel(hotelData as Hotel);

      const { data: itemsData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("hotel_id", params.hotelId)
        .eq("is_available", true)
        .order("category");
      setItems((itemsData as MenuItem[]) ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: addrData } = await supabase
          .from("customer_addresses")
          .select("*")
          .eq("customer_id", user.id);
        const addrs = (addrData as CustomerAddress[]) ?? [];
        setAddresses(addrs);
        const def = addrs.find((a) => a.is_default) ?? addrs[0];
        if (def) setSelectedAddressId(def.address_id);
      }
    })();
  }, [params.hotelId, supabase]);

  function addToCart(item: MenuItem) {
    setCart((prev) => ({
      ...prev,
      [item.item_id]: {
        item,
        quantity: (prev[item.item_id]?.quantity ?? 0) + 1,
      },
    }));
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = { ...prev };
      if (!next[itemId]) return prev;
      if (next[itemId].quantity <= 1) {
        delete next[itemId];
      } else {
        next[itemId] = { ...next[itemId], quantity: next[itemId].quantity - 1 };
      }
      return next;
    });
  }

  const cartLines = Object.values(cart);
  const subtotal = cartLines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0
  );
  const deliveryFee = subtotal > 0 ? 50 : 0;
  const total = subtotal + deliveryFee;

  async function placeOrder() {
    if (!hotel) return;
    if (cartLines.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (!selectedAddressId && !contactPhone) {
      setError("Add a delivery address or contact phone.");
      return;
    }

    setPlacing(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const selectedAddress = addresses.find(
      (a) => a.address_id === selectedAddressId
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: user.id,
        hotel_id: hotel.hotel_id,
        delivery_address_id: selectedAddressId || null,
        delivery_latitude: selectedAddress?.latitude ?? null,
        delivery_longitude: selectedAddress?.longitude ?? null,
        delivery_landmark: selectedAddress?.landmark_description ?? null,
        delivery_contact_phone: contactPhone || null,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      setError(orderError?.message ?? "Could not place order");
      setPlacing(false);
      return;
    }

    const orderId = (order as { order_id: string }).order_id;

    const orderItemsPayload = cartLines.map((line) => ({
      order_id: orderId,
      item_id: line.item.item_id,
      item_name_snapshot: line.item.name,
      price_at_order: line.item.price,
      quantity: line.quantity,
      line_total: line.item.price * line.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      setError(itemsError.message);
      setPlacing(false);
      return;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      method: paymentMethod,
      amount: total,
      status: "pending",
    });

    if (paymentError) {
      setError(
        "Order placed, but recording payment failed: " + paymentError.message + ". Please contact support."
      );
      setPlacing(false);
    }

    router.push("/customer/orders/" + orderId);
  }

  if (!hotel) return <p className="text-gray-500">Loading...</p>;

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || "Menu";
    acc[cat] = acc[cat] ? [...acc[cat], item] : [item];
    return acc;
  }, {});

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="text-xl font-bold">{hotel.name}</h2>
        <p className="text-sm text-gray-500 mb-6">{hotel.physical_address}</p>

        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="mb-6">
            <h3 className="font-medium text-gray-700 mb-2">{category}</h3>
            <div className="space-y-2">
              {catItems.map((item) => (
                <div
                  key={item.item_id}
                  className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-gray-500">
                        {item.description}
                      </p>
                    )}
                    <p className="text-sm font-semibold mt-1">
                      {formatKES(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cart[item.item_id] && (
                      <>
                        <button
                          onClick={() => removeFromCart(item.item_id)}
                          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600"
                        >
                          -
                        </button>
                        <span className="w-4 text-center">
                          {cart[item.item_id].quantity}
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(item)}
                      className="w-7 h-7 rounded-full bg-brand-600 text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 h-fit sticky top-6">
        <h3 className="font-semibold mb-3">Your order</h3>
        {cartLines.length === 0 ? (
          <p className="text-sm text-gray-500">Your cart is empty.</p>
        ) : (
          <>
            <ul className="text-sm space-y-1 mb-3">
              {cartLines.map((line) => (
                <li key={line.item.item_id} className="flex justify-between">
                  <span>
                    {line.quantity}x {line.item.name}
                  </span>
                  <span>{formatKES(line.item.price * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t pt-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatKES(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery fee</span>
                <span>{formatKES(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatKES(total)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {addresses.length > 0 ? (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Delivery address
                  </label>
                  <select
                    value={selectedAddressId}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {addresses.map((a) => (
                      <option key={a.address_id} value={a.address_id}>
                        {a.label || "Address"} - {a.landmark_description}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Contact phone for delivery
                  </label>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    No saved addresses -{" "}
                      <a
                      href="/customer/addresses"
                      className="text-brand-600 underline"
                    >
                      add one
                    </a>{" "}
                    for faster checkout next time.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  Payment method
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentMethod("mpesa")}
                    className={"flex-1 text-sm py-1.5 rounded-md border " + (paymentMethod === "mpesa" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300")}
                  >
                    M-Pesa
                  </button>
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={"flex-1 text-sm py-1.5 rounded-md border " + (paymentMethod === "cash" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300")}
                  >
                    Cash on delivery
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={placeOrder}
                disabled={placing}
                className="w-full bg-brand-600 text-white py-2 rounded-md font-medium disabled:opacity-50"
              >
                {placing ? "Placing order..." : "Place order"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
