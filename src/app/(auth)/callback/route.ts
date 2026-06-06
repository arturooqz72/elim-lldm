import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawReturnUrl = searchParams.get("returnUrl") ?? "/";

  // Guard against open-redirect: only allow same-origin relative paths
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/";

  if (code) {
    // Build the redirect response first so Supabase can write cookies onto it
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
            // Write cookies onto both the request (for this handler) and the response (for the browser)
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectResponse;
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  if (returnUrl !== "/") loginUrl.searchParams.set("returnUrl", returnUrl);
  return NextResponse.redirect(loginUrl.toString());
}
