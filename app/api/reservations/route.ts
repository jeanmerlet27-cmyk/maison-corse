import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || aStart > bEnd);
}

function isIsoDate(s: string) {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ reservations: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const start_date = String(body?.start_date || "");
    const end_date = String(body?.end_date || "");

    if (!name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
    if (!isIsoDate(start_date) || !isIsoDate(end_date)) {
      return NextResponse.json({ error: "Format date invalide (YYYY-MM-DD)." }, { status: 400 });
    }
    if (end_date < start_date) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: existing, error: selError } = await supabase
      .from("reservations")
      .select("id,name,start_date,end_date");

    if (selError) throw selError;

    const conflict = (existing ?? []).find(r =>
      overlaps(start_date, end_date, r.start_date, r.end_date)
    );

    if (conflict) {
      return NextResponse.json(
        { error: `Conflit avec "${conflict.name}" (${conflict.start_date} → ${conflict.end_date}).` },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("reservations")
      .insert({ name, start_date, end_date })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, reservation: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT → modifier une réservation (id requis)
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const id = String(body?.id || "");
    const name = String(body?.name || "").trim();
    const start_date = String(body?.start_date || "");
    const end_date = String(body?.end_date || "");

    if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
    if (!isIsoDate(start_date) || !isIsoDate(end_date)) {
      return NextResponse.json({ error: "Format date invalide (YYYY-MM-DD)." }, { status: 400 });
    }
    if (end_date < start_date) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // check conflits en excluant soi-même
    const { data: existing, error: selError } = await supabase
      .from("reservations")
      .select("id,name,start_date,end_date");

    if (selError) throw selError;

    const conflict = (existing ?? []).find(r =>
      r.id !== id && overlaps(start_date, end_date, r.start_date, r.end_date)
    );

    if (conflict) {
      return NextResponse.json(
        { error: `Conflit avec "${conflict.name}" (${conflict.start_date} → ${conflict.end_date}).` },
        { status: 409 }
      );
    }

    const { data: updated, error: updError } = await supabase
      .from("reservations")
      .update({ name, start_date, end_date })
      .eq("id", id)
      .select("*")
      .single();

    if (updError) throw updError;

    return NextResponse.json({ ok: true, reservation: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
