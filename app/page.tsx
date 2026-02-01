"use client";

import React, { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || aStart > bEnd);
}

export default function Page() {
  const h = React.createElement;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReservations() {
    const res = await fetch("/api/reservations", { cache: "no-store" });
    const data = await res.json();
    setReservations(data.reservations || []);
  }

  useEffect(() => {
    loadReservations();
  }, []);

  const sorted = useMemo(() => {
    return [...reservations].sort((a, b) =>
      a.start_date.localeCompare(b.start_date)
    );
  }, [reservations]);

  async function submitReservation() {
    setMessage(null);

    if (!name || !start || !end) {
      setMessage("Merci de remplir tous les champs.");
      return;
    }

    if (end < start) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }

    const conflict = reservations.find(r =>
      overlaps(start, end, r.start_date, r.end_date)
    );

    if (conflict) {
      setMessage(
        `Conflit avec ${conflict.name} (${conflict.start_date} → ${conflict.end_date})`
      );
      return;
    }

    setLoading(true);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, start_date: start, end_date: end })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de la réservation.");
    } else {
      setName("");
      setStart("");
      setEnd("");
      setMessage("Réservation enregistrée ✅");
      await loadReservations();
    }

    setLoading(false);
  }

  return h(
    "div",
    { style: { maxWidth: 900, margin: "40px auto", padding: 20, fontFamily: "system-ui" } },
    h("h1", null, "Maison Corse — Réservations"),

    h(
      "div",
      { style: { marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "white" } },
      h("h2", { style: { marginTop: 0 } }, "Nouvelle réservation"),
      h(
        "div",
        { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
        h("input", {
          placeholder: "Nom",
          value: name,
          onChange: (e: any) => setName(e.target.value),
          style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" }
        }),
        h("input", {
          type: "date",
          value: start,
          onChange: (e: any) => setStart(e.target.value),
          style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" }
        }),
        h("input", {
          type: "date",
          value: end,
          onChange: (e: any) => setEnd(e.target.value),
          style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" }
        }),
        h(
          "button",
          {
            onClick: submitReservation,
            disabled: loading,
            style: {
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 700,
              cursor: "pointer"
            }
          },
          loading ? "..." : "Réserver"
        )
      ),
      message ? h("p", { style: { marginTop: 10 } }, message) : null
    ),

    h(
      "div",
      { style: { marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "white" } },
      h("h2", { style: { marginTop: 0 } }, "Réservations"),
      sorted.length === 0
        ? h("p", null, "Aucune réservation pour le moment.")
        : h(
            "ul",
            null,
            ...sorted.map(r =>
              h("li", { key: r.id }, `${r.name} — ${r.start_date} → ${r.end_date}`)
            )
          )
    )
  );
}
