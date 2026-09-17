"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = (searchParams.get("role") as UserRole) || "customer";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hotelAddress, setHotelAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message ?? "Signup failed");
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    // Create the shared profile row
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role,
      full_name: name,
      phone,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // Create the role-specific row
    if (role === "customer") {
      const { error: custError } = await supabase.from("customers").insert({
        customer_id: userId,
        name,
        phone,
        email,
      });
      if (custError) {
        setError(custError.message);
        setLoading(false);
        return;
      }
      router.push("/customer");
    } else if (role === "hotel") {
      const { error: hotelError } = await supabase.from("hotels").insert({
        hotel_id: userId,
        name,
        owner_name: name,
        phone,
        email,
        physical_address: hotelAddress,
        status: "pending_approval",
        commission_rate: 10.0,
      });
      if (hotelError) {
        setError(hotelError.message);
        setLoading(false);
        return;
      }
      router.push("/hotel");
    } else if (role === "rider") {
      const { error: riderError } = await supabase.from("riders").insert({
        rider_id: userId,
        name,
        phone,
      });
      if (riderError) {
        setError(riderError.message);
        setLoading(false);
        return;
      }
      router.push("/rider");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-xl font-bold mb-1">Create an account</h1>
        <p className="text-sm text-gray-500 mb-6">Join Kabarnet Eats</p>

        <div className="flex gap-2 mb-6">
          {(["customer", "hotel", "rider"] as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 text-sm py-2 rounded-md border capitalize ${
                role === r
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {role === "hotel" ? "Business name" : "Full name"}
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {role === "hotel" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Physical address
              </label>
              <input
                required
                value={hotelAddress}
                onChange={(e) => setHotelAddress(e.target.value)}
                placeholder="e.g. Kabarnet town, near the market"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2 rounded-md font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        {role === "hotel" && (
          <p className="text-xs text-gray-500 mt-4">
            Hotel accounts start as &quot;pending approval&quot; until the
            admin activates them.
          </p>
        )}
      </div>
    </main>
  );
}
