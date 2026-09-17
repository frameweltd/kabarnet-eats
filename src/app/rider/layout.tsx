import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RiderLayout({
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
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="font-bold">Kabarnet Eats — Rider</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
