import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    bible_reference,
    time_limit_seconds,
    points,
    order_index,
  } = body;

  if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("questions")
    .insert({
      question_set_id: setId,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      bible_reference: bible_reference ?? null,
      time_limit_seconds: time_limit_seconds ?? 30,
      points: points ?? 100,
      order_index: order_index ?? 0,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
