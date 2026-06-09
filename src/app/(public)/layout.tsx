import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getProfile } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile: Profile | null = null;
  try {
    profile = (await getProfile()) as Profile | null;
  } catch {
    // cookies() unavailable in static context — navbar renders as unauthenticated
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PublicHeader initialProfile={profile} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
