import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Création du client Supabase côté serveur
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// Vérifie si deux périodes se chevauchent
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || aStart > bEnd);
}

// GET : récupérer toutes les réservations
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
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// POST : créer une réservation
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const start_date = String(body?.start_date || "");
    const end_date = String(body?.end_date || "");

    if (!name) {
      return NextResponse.json({ error: "Nom requis." }, { status: 400 });
    }
    if (!start_date || !end_date) {
      return NextResponse.json({ error: "Dates requises." }, { status: 400 });
    }
    if (end_date < start_date) {
      return NextResponse.json(
        { error: "La date de fin doit être après la date de début." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Vérifier les conflits
    const { data: existing, error: selError } = await supabase
      .from("reservations")
      .select("name,start_date,end_date");

    if (selError) throw selError;

    const conflict = (existing ?? []).find(r =>
      overlaps(start_date, end_date, r.start_date, r.end_date)
    );

    if (conflict) {
      return NextResponse.json(
        {
          error: `Conflit avec "${conflict.name}" (${conflict.start_date} → ${conflict.end_date}).`
        },
        { status: 409 }
      );
    }

    // Insertion
    const { error: insertError } = await supabase
      .from("reservations")
      .insert({ name, start_date, end_date });

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
