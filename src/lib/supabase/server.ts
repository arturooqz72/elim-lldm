import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// TODO: After running `pnpm supabase gen types typescript --project-id <id> > src/types/database.ts`
// import type { Database } from "@/types/database";
// and add <Database> generic to createServerClient() calls

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // Server Component — cookies set by middleware
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  // Plain client (no cookies) — if the user's session cookies were passed
  // through here, supabase-js would send the user's own access token as the
  // Authorization header instead of the service role key, so requests would
  // run as `authenticated` (subject to grants/RLS) rather than `service_role`
  // (full access, bypasses RLS). That silently breaks any admin mutation on
  // tables where `authenticated` lacks the relevant GRANT (e.g. UPDATE/DELETE
  // on `videos`) — the request "succeeds" but changes nothing.
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}
