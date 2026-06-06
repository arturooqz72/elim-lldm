import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawReturnUrl = searchParams.get("returnUrl") ?? "/";

  // Guard against open-redirect: only allow same-origin relative paths
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${returnUrl}`);
    }
  }

  // Preserve returnUrl so the user lands in the right place after re-trying
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  if (returnUrl !== "/") loginUrl.searchParams.set("returnUrl", returnUrl);
  return NextResponse.redirect(loginUrl.toString());
}
