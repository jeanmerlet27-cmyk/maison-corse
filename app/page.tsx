"use client";

import React, { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function overlaps(a1: string, a2: string, b1: string, b2: string) {
  return !(a2 < b1 || a1 > b2);
}

export default function Page() {
  const h = React.createElement;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);

  const [editing, setEditing] = useState<Reservation | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/reservations", { cache: "no-store" });
    const d = await r.json();
    setReservations(d.reservations || []);
  }

  useEffect(() => {
    load();
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }, []);

  const sorted = useMemo(
    () => [...reservations].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [reservations]
  );

  async function create() {
    setMessage(null);
    if (!name || !start || !end) return setMessage("Champs manquants.");
    if (end < start) return setMessage("Dates invalides.");

    const conflict = sorted.find(r => overlaps(start, end, r.start_date, r.end_date));
    if (conflict) return setMessage(`Conflit avec ${conflict.name}`);

    setLoading(true);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, start_date: start, end_date: end })
    });
    const d = await res.json();
    if (!res.ok) setMessage(d.error);
    else {
      setName(""); setStart(""); setEnd("");
      await load();
    }
    setLoading(false);
  }

  function openEdit(r: Reservation) {
    setEditing(r);
    setEditName(r.name);
    setEditStart(r.start_date);
    setEditEnd(r.end_date);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditLoading(true);
    const res = await fetch("/api/reservations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        name: editName,
        start_date: editStart,
        end_date: editEnd
      })
    });
    const d = await res.json();
    if (!res.ok) setMessage(d.error);
    else {
      setEditing(null);
      await load();
    }
    setEditLoading(false);
  }

  async function deleteReservation() {
    if (!editing) return;
    const ok = confirm(`Supprimer la réservation de ${editing.name} ?`);
    if (!ok) return;

    setEditLoading(true);
    await fetch("/api/reservations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id })
    });
    setEditing(null);
    await load();
    setEditLoading(false);
  }

  function calendar() {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const total = daysInMonth(year, month);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = i - offset + 1;
      if (d < 1 || d > total) {
        cells.push(h("div", { key: i }));
      } else {
        const dateIso = iso(new Date(year, month, d));
        const r = sorted.find(x => x.start_date <= dateIso && dateIso <= x.end_date);
        cells.push(
          h("button", {
            key: i,
            onClick: () => r && openEdit(r),
            style: {
              height: 70,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: r ? "#111" : "white",
              color: r ? "white" : "#111",
              cursor: r ? "pointer" : "default",
              padding: 8
            }
          },
          h("div", { style: { fontWeight: 700 } }, d),
          r ? h("div", { style: { fontSize: 12 } }, r.name) : null
          )
        );
      }
    }
    return h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 8,
        marginTop: 12
      }
    }, ...cells);
  }

  return h("div", { style: { maxWidth: 1100, margin: "30px auto", padding: 20, fontFamily: "system-ui" } },

    h("h1", null, "Maison Corse — Réservations"),

    h("div", { style: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 } },

      h("div", { style: { padding: 16, border: "1px solid #eee", borderRadius: 14 } },
        h("h2", null, "Calendrier"),
        h("div", { style: { display: "flex", gap: 8 } },
          h("select", { value: year, onChange: (e:any) => setYear(+e.target.value) },
            ...Array.from({ length: 5 }, (_, i) => h("option", { key: i, value: 2026 + i }, 2026 + i))
          ),
          h("select", { value: month, onChange: (e:any) => setMonth(+e.target.value) },
            ...MONTHS.map((m, i) => h("option", { key: i, value: i }, m))
          )
        ),
        calendar()
      ),

      h("div", null,

        h("div", { style: { padding: 16, border: "1px solid #eee", borderRadius: 14 } },
          h("h2", null, "Nouvelle réservation"),
          h("input", { placeholder: "Nom", value: name, onChange: (e:any) => setName(e.target.value) }),
          h("input", { type: "date", value: start, onChange: (e:any) => setStart(e.target.value) }),
          h("input", { type: "date", value: end, onChange: (e:any) => setEnd(e.target.value) }),
          h("button", { onClick: create }, loading ? "..." : "Réserver"),
          message ? h("p", null, message) : null
        ),

        editing ? h("div", { style: { marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 14 } },
          h("h3", null, "Modifier"),
          h("input", { value: editName, onChange: (e:any) => setEditName(e.target.value) }),
          h("input", { type: "date", value: editStart, onChange: (e:any) => setEditStart(e.target.value) }),
          h("input", { type: "date", value: editEnd, onChange: (e:any) => setEditEnd(e.target.value) }),
          h("button", { onClick: saveEdit }, editLoading ? "..." : "Enregistrer"),
          h("button", { onClick: deleteReservation, style: { color: "red" } }, "Supprimer"),
          h("button", { onClick: () => setEditing(null) }, "Annuler")
        ) : null
      )
    )
  );
}
