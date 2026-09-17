import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HotelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("name, status")
    .eq("hotel_id", user.id)
    .single();

  if (!hotel) redirect("/login");

  const hotelData = hotel as { name: string; status: string };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold">{hotelData.name}</h1>
            {hotelData.status === "pending_approval" && (
              <p className="text-xs text-amber-600">
                Awaiting admin approval — not visible to customers yet
              </p>
            )}
            {hotelData.status === "suspended" && (
              <p className="text-xs text-red-600">Account suspended</p>
            )}
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/hotel" className="hover:text-brand-600">
              Orders
            </Link>
            <Link href="/hotel/menu" className="hover:text-brand-600">
              Menu
            </Link>
            <Link href="/hotel/earnings" className="hover:text-brand-600">
              Earnings
            </Link>
            <Link href="/hotel/settings" className="hover:text-brand-600">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
