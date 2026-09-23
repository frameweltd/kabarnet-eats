import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Hotel } from "@/types/database";

export default async function CustomerBrowsePage() {
  const supabase = createClient();

  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .eq("status", "active")
    .order("name") as { data: Hotel[] | null };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Restaurants near you</h2>
      {!hotels || hotels.length === 0 ? (
        <p className="text-gray-500">No restaurants available right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <Link
              key={hotel.hotel_id}
              href={`/customer/hotels/${hotel.hotel_id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold">{hotel.name}</h3>
              {hotel.physical_address && (
                <p className="text-sm text-gray-500 mt-1">
                  {hotel.physical_address}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
