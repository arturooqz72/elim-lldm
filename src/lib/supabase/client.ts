import { createBrowserClient } from "@supabase/ssr";

// TODO: After running `pnpm supabase gen types typescript --project-id <id> > src/types/database.ts`
// import type { Database } from "@/types/database";
// and use createBrowserClient<Database>(...)

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Like `createClient`, but returns a fresh, non-singleton instance.
 *
 * The shared singleton's `initializePromise` can get stuck forever if its
 * initial token refresh (at construction time) never settles, which then
 * makes every future `getSession()` on that instance hang indefinitely
 * (it always awaits `initializePromise` first). A fresh instance gets its
 * own `initializePromise` against the current (valid) session cookie.
 * Use this for one-off flows (e.g. uploads) where a hung singleton would
 * otherwise block the whole operation.
 */
export function createFreshClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false }
  );
}
