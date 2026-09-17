import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no write access.
            // Safe to ignore if middleware refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely. Use ONLY in trusted
 * server contexts: M-Pesa callback handler, settlement cron job, admin
 * actions that need to write across role boundaries.
 * NEVER import this into anything that runs in the browser.
 */
export function createServiceClient() {
  const { createClient: createRawClient } = require("@supabase/supabase-js");
  return createRawClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
