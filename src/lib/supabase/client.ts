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
