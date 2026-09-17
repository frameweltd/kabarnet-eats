import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link href="/customer" className="font-bold">
            Kabarnet Eats
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/customer" className="hover:text-brand-600">
              Browse
            </Link>
            <Link href="/customer/orders" className="hover:text-brand-600">
              My orders
            </Link>
            <Link href="/customer/addresses" className="hover:text-brand-600">
              Addresses
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
