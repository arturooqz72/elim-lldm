import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getProfile } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  return (
    <div className="flex flex-col min-h-screen">
      <PublicHeader initialProfile={profile as Profile | null} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
