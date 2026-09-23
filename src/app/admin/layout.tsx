import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string } | null)?.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold">Kabarnet Eats — Admin</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="hover:text-gray-300">
              Hotels
            </Link>
            <Link href="/admin/orders" className="hover:text-gray-300">
              Orders
            </Link>
            <Link href="/admin/settlements" className="hover:text-gray-300">
              Settlements
            </Link>
            <Link href="/admin/disputes" className="hover:text-gray-300">
              Disputes
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
