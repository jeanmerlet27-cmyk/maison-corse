"use client";

import { useEffect, useMemo, useState } from "react";

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

  const sortedReservations = useMemo(() => {
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
      body: JSON.stringify({
        name,
        start_date: start,
        end_date: end
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de la réservation.");
    } else {
      setName("");
      setStart("");
      setEnd("");
      setMessage("Réservation enregistrée ✅");
      loadReservations();
    }

    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h1>🏠 Maison Corse — Réservations</h1>

      <section style={{ marginTop: 30 }}>
        <h2>Nouvelle réservation</

