import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as string | null;
  const rawReturnUrl = searchParams.get("returnUrl") ?? "/";

  // Recovery flow always lands on /update-password
  const returnUrl =
    type === "recovery"
      ? "/update-password"
      : rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/";

  const redirectResponse = NextResponse.redirect(`${origin}${returnUrl}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // PKCE code exchange (OAuth + email confirmation + password reset)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectResponse;
  }

  // Token hash exchange (legacy magic link / OTP email)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "recovery" | "invite" | "magiclink",
    });
    if (!error) return redirectResponse;
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  if (returnUrl !== "/" && returnUrl !== "/update-password") {
    loginUrl.searchParams.set("returnUrl", returnUrl);
  }
  return NextResponse.redirect(loginUrl.toString());
}
