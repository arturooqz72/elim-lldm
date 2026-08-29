import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendZohoMail } from "@/lib/mail/zoho";

async function maybeSendWelcomeEmail(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null }
) {
  if (!user.email) return;

  // Atomic guard: only rows still NULL get updated, so this only fires once
  // per user no matter how many times /callback runs (every OAuth login hits it).
  const { data: profile } = await supabase
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("display_name")
    .maybeSingle();

  if (!profile) return;

  const nombre = profile.display_name || "hermano/a";

  try {
    await sendZohoMail({
      to: user.email,
      subject: "Bienvenido a la comunidad Elim LLDM",
      text:
        `La Paz del Señor, ${nombre}:\n\n` +
        "Dios le pague por registrarse y ser parte de esta comunidad de Elim LLDM. " +
        "Cualquier pregunta o sugerencia sobre el contenido de esta página será tomada en cuenta — " +
        "crecer juntos es la meta de toda la comunidad LLDM.\n\n" +
        "Dios le bendiga.\n\n— Elim LLDM",
      html:
        `<p>La Paz del Señor, ${nombre}:</p>` +
        "<p>Dios le pague por registrarse y ser parte de esta comunidad de Elim LLDM. " +
        "Cualquier pregunta o sugerencia sobre el contenido de esta página será tomada en cuenta — " +
        "crecer juntos es la meta de toda la comunidad LLDM.</p>" +
        "<p>Dios le bendiga.</p><p>— Elim LLDM</p>",
    });
  } catch (err) {
    console.error("Error enviando correo de bienvenida:", err);
  }
}

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user && type !== "recovery") await maybeSendWelcomeEmail(supabase, data.user);
      return redirectResponse;
    }
  }

  // Token hash exchange (legacy magic link / OTP email)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "recovery" | "invite" | "magiclink",
    });
    if (!error) {
      if (data.user && type !== "recovery") await maybeSendWelcomeEmail(supabase, data.user);
      return redirectResponse;
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  if (returnUrl !== "/" && returnUrl !== "/update-password") {
    loginUrl.searchParams.set("returnUrl", returnUrl);
  }
  return NextResponse.redirect(loginUrl.toString());
}
