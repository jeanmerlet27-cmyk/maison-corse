"use client";

import React, { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  created_at: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromIsoDate(s: string) {
  // s = YYYY-MM-DD
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function weekdayIndexMonFirst(d: Date) {
  // 0 = Monday ... 6 = Sunday
  const js = d.getDay(); // 0=Sun
  return (js + 6) % 7;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || aStart > bEnd);
}

function isDayInReservation(dayIso: string, r: Reservation) {
  return r.start_date <= dayIso && dayIso <= r.end_date;
}

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

export default function Page() {
  const h = React.createElement;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Création
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  // Calendrier
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0); // 0=Jan

  // Edition
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  async function loadReservations() {
    const res = await fetch("/api/reservations", { cache: "no-store" });
    const data = await res.json();
    setReservations(data.reservations || []);
  }

  useEffect(() => {
    loadReservations();
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }, []);

  const sorted = useMemo(() => {
    return [...reservations].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [reservations]);

  const calendarGrid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = weekdayIndexMonFirst(first); // 0..6
    const dim = daysInMonth(year, month);

    // 6 semaines x 7 jours = 42 cases
    const cells: { iso: string | null; label: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > dim) {
        cells.push({ iso: null, label: "" });
      } else {
        const d = new Date(year, month, dayNum);
        cells.push({ iso: toIsoDate(d), label: String(dayNum) });
      }
    }
    return cells;
  }, [year, month]);

  function reservationForDay(dayIso: string) {
    // si plusieurs se chevauchent (normalement impossible), on prend la première
    return sorted.find(r => isDayInReservation(dayIso, r)) || null;
  }

  async function createReservation() {
    setMessage(null);

    if (!name || !start || !end) {
      setMessage("Merci de remplir tous les champs.");
      return;
    }
    if (end < start) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }

    // check rapide côté client
    const conflict = sorted.find(r => overlaps(start, end, r.start_date, r.end_date));
    if (conflict) {
      setMessage(`Conflit avec ${conflict.name} (${conflict.start_date} → ${conflict.end_date})`);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, start_date: start, end_date: end })
    });

    const data = await res.json();
    if (!res.ok) setMessage(data.error || "Erreur lors de la réservation.");
    else {
      setName(""); setStart(""); setEnd("");
      setMessage("Réservation enregistrée.");
      await loadReservations();
    }
    setLoading(false);
  }

  function openEdit(r: Reservation) {
    setEditing(r);
    setEditName(r.name);
    setEditStart(r.start_date);
    setEditEnd(r.end_date);
    setMessage(null);
  }

  async function saveEdit() {
    if (!editing) return;

    setMessage(null);

    if (!editName || !editStart || !editEnd) {
      setMessage("Merci de remplir tous les champs d’édition.");
      return;
    }
    if (editEnd < editStart) {
      setMessage("La date de fin doit être après la date de début.");
      return;
    }

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

    const data = await res.json();
    if (!res.ok) setMessage(data.error || "Erreur lors de la modification.");
    else {
      setEditing(null);
      setMessage("Modification enregistrée.");
      await loadReservations();
    }

    setEditLoading(false);
  }

  function yearOptions() {
    const opts: any[] = [];
    for (let y = 2026; y <= 2030; y++) {
      opts.push(h("option", { key: y, value: y }, String(y)));
    }
    return opts;
  }

  function weekdayHeader() {
    const names = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    return h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 12, fontWeight: 700 } },
      ...names.map(n => h("div", { key: n, style: { textAlign: "center" } }, n))
    );
  }

  function calendarBody() {
    return h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 8 } },
      ...calendarGrid.map((c, idx) => {
        if (!c.iso) {
          return h("div", { key: idx, style: { height: 74, borderRadius: 12, background: "#f5f5f5" } });
        }
        const r = reservationForDay(c.iso);
        const isReserved = !!r;

        return h(
          "button",
          {
            key: idx,
            onClick: () => { if (r) openEdit(r); },
            disabled: !r,
            title: r ? `${r.name} (${r.start_date} → ${r.end_date})` : "",
            style: {
              height: 74,
              borderRadius: 12,
              border: "1px solid #e6e6e6",
              background: isReserved ? "#111" : "white",
              color: isReserved ? "white" : "#111",
              padding: 10,
              textAlign: "left",
              cursor: r ? "pointer" : "default"
            }
          },
          h("div", { style: { fontWeight: 800 } }, c.label),
          r ? h("div", { style: { marginTop: 6, fontSize: 12, opacity: 0.9 } }, r.name) : null
        );
      })
    );
  }

  function reservationsList() {
    return sorted.length === 0
      ? h("p", null, "Aucune réservation.")
      : h(
          "ul",
          null,
          ...sorted.map(r =>
            h(
              "li",
              { key: r.id, style: { marginBottom: 8 } },
              h("button", { onClick: () => openEdit(r), style: { border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer", padding: 0 } },
                `${r.name} — ${r.start_date} → ${r.end_date}`
              )
            )
          )
        );
  }

  function editPanel() {
    if (!editing) return null;

    return h(
      "div",
      { style: { marginTop: 16, padding: 14, border: "1px solid #ddd", borderRadius: 12, background: "white" } },
      h("h3", { style: { marginTop: 0 } }, "Modifier une réservation"),
      h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
        h("input", { value: editName, onChange: (e: any) => setEditName(e.target.value), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }),
        h("input", { type: "date", value: editStart, onChange: (e: any) => setEditStart(e.target.value), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }),
        h("input", { type: "date", value: editEnd, onChange: (e: any) => setEditEnd(e.target.value), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }),
        h("button", {
          onClick: saveEdit,
          disabled: editLoading,
          style: { padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", fontWeight: 700, cursor: "pointer" }
        }, editLoading ? "..." : "Enregistrer"),
        h("button", {
          onClick: () => setEditing(null),
          style: { padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }
        }, "Annuler")
      )
    );
  }

  return h(
    "div",
    { style: { maxWidth: 1100, margin: "30px auto", padding: 20, fontFamily: "system-ui" } },

    h("h1", null, "Maison Corse — Réservations"),

    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, alignItems: "start", marginTop: 16 } },

      // Colonne gauche: calendrier
      h(
        "div",
        { style: { padding: 16, border: "1px solid #eee", borderRadius: 14, background: "white" } },

        h("h2", { style: { marginTop: 0 } }, "Calendrier"),

        h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" } },
          h("select", { value: year, onChange: (e: any) => setYear(Number(e.target.value)), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }, ...yearOptions()),
          h("select", { value: month, onChange: (e: any) => setMonth(Number(e.target.value)), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } },
            ...MONTHS_FR.map((m, i) => h("option", { key: i, value: i }, m))
          ),
          h("button", {
            onClick: () => setMonth(m => (m + 11) % 12),
            style: { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }
          }, "◀"),
          h("button", {
            onClick: () => setMonth(m => (m + 1) % 12),
            style: { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }
          }, "▶")
        ),

        weekdayHeader(),
        calendarBody(),

        h("p", { style: { marginTop: 12, opacity: 0.75 } },
          "Clique sur un jour réservé pour ouvrir la réservation et modifier."
        )
      ),

      // Colonne droite: création + liste
      h(
        "div",
        null,
        h(
          "div",
          { style: { padding: 16, border: "1px solid #eee", borderRadius: 14, background: "white" } },
          h("h2", { style: { marginTop: 0 } }, "Nouvelle réservation"),
          h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
            h("input", { placeholder: "Nom", value: name, onChange: (e: any) => setName(e.target.value), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }),
            h("input", { type: "date", value: start, onChange: (e: any) => setStart(e.target.value), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }),
            h("input", { type: "date", value: end, onChange: (e: any) => setEnd(e.target.value), style: { padding: 10, borderRadius: 10, border: "1px solid #ddd" } }),
            h("button", { onClick: createReservation, disabled: loading, style: { padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", fontWeight: 700, cursor: "pointer" } }, loading ? "..." : "Réserver")
          ),
          message ? h("p", { style: { marginTop: 10 } }, message) : null
        ),

        editPanel(),

        h(
          "div",
          { style: { marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 14, background: "white" } },
          h("h2", { style: { marginTop: 0 } }, "Réservations"),
          reservationsList()
        )
      )
    )
  );
}
