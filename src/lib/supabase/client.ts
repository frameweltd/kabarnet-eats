import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // IMPORTANT: @supabase/ssr's browser client authenticates normal
  // database queries via cookies, but the Realtime WebSocket connection
  // does NOT pick up that session automatically. Without explicitly
  // setting the access token on the realtime client, RLS-protected
  // tables (orders, etc.) will silently receive zero postgres_changes
  // events — no error, subscriptions just never fire. This keeps the
  // realtime auth token in sync with the actual logged-in session.
  client.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      client.realtime.setAuth(session.access_token);
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    client.realtime.setAuth(session?.access_token ?? "");
  });

  return client;
}
