import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Hotel } from "@/types/database";

export default async function HomePage() {
  const supabase = createClient();

  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .eq("status", "active")
    .order("name") as { data: Hotel[] | null };

  return (
    <main className="min-h-screen">
      <header className="bg-brand-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Kabarnet Eats</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/login" className="hover:underline">
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-white text-brand-700 px-3 py-1.5 rounded-md font-medium hover:bg-brand-50"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="text-xl font-semibold mb-4">
          Hotels & restaurants delivering in Kabarnet
        </h2>

        {!hotels || hotels.length === 0 ? (
          <p className="text-gray-500">
            No hotels are active yet. Check back soon, or{" "}
            <Link href="/signup?role=hotel" className="text-brand-600 underline">
              register your restaurant
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <Link
                key={hotel.hotel_id}
                href={`/customer/hotels/${hotel.hotel_id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg">{hotel.name}</h3>
                {hotel.physical_address && (
                  <p className="text-sm text-gray-500 mt-1">
                    {hotel.physical_address}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
